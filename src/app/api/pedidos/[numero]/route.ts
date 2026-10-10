import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { canModifyOrder } from '@/lib/utils'
import { restoreStock, takeStock } from '@/lib/stock'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export async function GET(
  request: Request,
  { params }: { params: { numero: string } }
) {
  // El número de pedido es la credencial para ver datos personales: frenamos el tanteo.
  const rl = rateLimit(`order-get:${getClientIp(request)}`, { limit: 60, windowMs: 10 * 60 * 1000 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiadas solicitudes. Intentá en unos minutos.' }, { status: 429 })
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber: params.numero },
    select: {
      id:              true,
      orderNumber:     true,
      status:          true,
      paymentMethod:   true,
      paymentStatus:   true,
      customerName:    true,
      address:         true,
      phone:           true,
      notes:           true,
      total:           true,
      canModifyUntil:  true,
      createdAt:       true,
      items: {
        select: {
          id:           true,
          quantity:     true,
          unitPrice:    true,
          variantLabel: true,
          product: {
            select: { id: true, name: true, images: true, slug: true },
          },
        },
      },
    },
  })

  if (!order) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }

  return NextResponse.json({
    ...order,
    total: Number(order.total),
    items: order.items.map(i => ({ ...i, unitPrice: Number(i.unitPrice) })),
    canModify: canModifyOrder(order.canModifyUntil),
  })
}

class StockError extends Error {}

// Only accepts item IDs + new quantities — prices come from the DB
const modifySchema = z.object({
  items: z.array(z.object({
    id:       z.string().cuid(),   // OrderItem.id — must belong to this order
    quantity: z.number().int().min(0).max(100),
  })).min(1).max(50),
})

export async function PATCH(
  request: Request,
  { params }: { params: { numero: string } }
) {
  const order = await prisma.order.findUnique({
    where:  { orderNumber: params.numero },
    select: {
      id:             true,
      canModifyUntil: true,
      status:         true,
      paymentStatus:  true,
      items: {
        select: { id: true, unitPrice: true, productId: true, variantLabel: true, quantity: true },
      },
    },
  })

  if (!order) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
  }

  if (!canModifyOrder(order.canModifyUntil)) {
    return NextResponse.json(
      { error: 'El tiempo para modificar este pedido ha expirado (30 minutos)' },
      { status: 409 }
    )
  }

  if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
    return NextResponse.json(
      { error: 'El pedido ya está en preparación y no puede modificarse' },
      { status: 409 }
    )
  }

  // Con el pago ya acreditado, cambiar cantidades dejaría el total distinto a lo cobrado.
  if (order.paymentStatus === 'APPROVED') {
    return NextResponse.json(
      { error: 'El pedido ya está pago. Para cambiarlo escribinos por WhatsApp.' },
      { status: 409 }
    )
  }

  const body   = await request.json().catch(() => null)
  const parsed = modifySchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // SECURITY: verify all submitted item IDs belong to this order
  const orderItemIds = new Set(order.items.map(i => i.id))
  const invalidId    = parsed.data.items.find(i => !orderItemIds.has(i.id))
  if (invalidId) {
    return NextResponse.json(
      { error: 'Item no pertenece a este pedido' },
      { status: 403 }
    )
  }

  // Build quantity map from request
  const qtyMap = new Map(parsed.data.items.map(i => [i.id, i.quantity]))

  // SECURITY: use prices from DB, ignore any client-supplied price
  const priceMap = new Map(order.items.map(i => [i.id, Number(i.unitPrice)]))

  const activeItems = order.items.filter(i => (qtyMap.get(i.id) ?? 0) > 0)
  if (activeItems.length === 0) {
    return NextResponse.json(
      { error: 'El pedido debe tener al menos un producto' },
      { status: 422 }
    )
  }

  const newTotal = activeItems.reduce(
    (sum, i) => sum + priceMap.get(i.id)! * qtyMap.get(i.id)!,
    0
  )

  // El stock se descontó al crear el pedido: acá se ajusta solo la diferencia.
  try {
    await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        const newQty = qtyMap.get(item.id) ?? 0
        const delta  = newQty - item.quantity
        const line   = { productId: item.productId, variantLabel: item.variantLabel, quantity: Math.abs(delta) }

        if (delta > 0 && !(await takeStock(tx, line))) {
          throw new StockError('No hay stock suficiente para sumar esa cantidad.')
        }
        if (delta < 0) await restoreStock(tx, [line])

        if (newQty === 0) {
          await tx.orderItem.delete({ where: { id: item.id } })
        } else if (delta !== 0) {
          await tx.orderItem.update({ where: { id: item.id }, data: { quantity: newQty } })
        }
      }

      await tx.order.update({ where: { id: order.id }, data: { total: newTotal } })
    })
  } catch (err) {
    if (err instanceof StockError) {
      return NextResponse.json({ error: err.message }, { status: 422 })
    }
    logger.error('Error modifying order', { error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: 'No se pudo modificar el pedido' }, { status: 500 })
  }

  return NextResponse.json({ orderNumber: params.numero, total: newTotal })
}
