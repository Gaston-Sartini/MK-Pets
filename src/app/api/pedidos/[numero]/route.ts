import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { canModifyOrder } from '@/lib/utils'

export async function GET(
  _request: Request,
  { params }: { params: { numero: string } }
) {
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
      items: {
        select: { id: true, unitPrice: true, productId: true, variantLabel: true },
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

  const body   = await request.json()
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

  await prisma.$transaction([
    prisma.orderItem.deleteMany({ where: { orderId: order.id } }),
    prisma.orderItem.createMany({
      data: activeItems.map(i => ({
        orderId:      order.id,
        productId:    i.productId,
        variantLabel: i.variantLabel,
        quantity:     qtyMap.get(i.id)!,
        unitPrice:    priceMap.get(i.id)!,
      })),
    }),
    prisma.order.update({
      where: { id: order.id },
      data:  { total: newTotal },
    }),
  ])

  return NextResponse.json({ orderNumber: params.numero, total: newTotal })
}
