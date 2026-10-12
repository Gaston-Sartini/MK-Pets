import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { generateOrderNumber } from '@/lib/utils'
import { rateLimitShared, getClientIp } from '@/lib/rate-limit'
import { notifyOrderWhatsApp, notifyOwner } from '@/lib/whatsapp'
import { logger } from '@/lib/logger'
import { takeStock } from '@/lib/stock'
import { enabledPaymentMethods } from '@/lib/shop'

const createOrderSchema = z.object({
  paymentMethod: z.enum(['TRANSFER', 'CASH_ON_DELIVERY', 'MERCADOPAGO']),
  customerName:  z.string().min(3).max(100),
  address:       z.string().min(10).max(200),
  phone:         z.string().min(8).max(20),
  notes:         z.string().max(500).optional(),
  items: z.array(z.object({
    productId:    z.string().cuid(),
    variantLabel: z.string().max(100).optional(),
    quantity:     z.number().int().positive().max(100),
    // unitPrice del cliente se ignora — solo quantity y productId/variant importan
  })).min(1).max(50),
})

// Con cuántas unidades (o menos) se avisa a la tienda
const LOW_STOCK_NOTICE = 3

class StockError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StockError'
  }
}

export async function POST(request: Request) {
  // 10 orders per IP per 10 minutes — prevents order flooding
  const rl = await rateLimitShared(`order:${getClientIp(request)}`, { limit: 10, windowMs: 10 * 60 * 1000 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Intentá en unos minutos.' },
      {
        status:  429,
        headers: { 'Retry-After': '600' },
      }
    )
  }

  try {
    const body   = await request.json()
    const parsed = createOrderSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { paymentMethod, customerName, address, phone, notes, items } = parsed.data

    // El checkout solo ofrece los medios habilitados; esto frena un request armado a mano.
    if (!enabledPaymentMethods().includes(paymentMethod)) {
      return NextResponse.json({ error: 'Ese medio de pago no está disponible.' }, { status: 400 })
    }

    // SECURITY: look up actual prices from DB — never trust client-supplied prices
    const productIds = [...new Set(items.map(i => i.productId))]
    const dbProducts = await prisma.product.findMany({
      where:  { id: { in: productIds }, isActive: true },
      select: {
        id:        true,
        name:      true,
        basePrice: true,
        stock:     true,
        variants:  { select: { label: true, price: true, stock: true } },
      },
    })

    // Build price, name and stock maps: "productId" or "productId:variantLabel" → value
    const priceMap = new Map<string, number>()
    const nameMap  = new Map<string, string>()
    const stockMap = new Map<string, number>()
    for (const p of dbProducts) {
      nameMap.set(p.id, p.name)
      if (p.variants.length > 0) {
        for (const v of p.variants) {
          priceMap.set(`${p.id}:${v.label}`, Number(v.price))
          stockMap.set(`${p.id}:${v.label}`, v.stock)
        }
      } else {
        priceMap.set(p.id, Number(p.basePrice))
        stockMap.set(p.id, p.stock)
      }
    }

    // Validate every item exists, is purchasable, and has sufficient stock
    const resolvedItems: { productId: string; variantLabel?: string; quantity: number; unitPrice: number }[] = []
    for (const item of items) {
      const key = item.variantLabel
        ? `${item.productId}:${item.variantLabel}`
        : item.productId

      const unitPrice = priceMap.get(key)
      if (unitPrice === undefined) {
        return NextResponse.json(
          { error: 'Uno de los productos del carrito ya no está disponible. Actualizá el carrito e intentá de nuevo.' },
          { status: 422 }
        )
      }

      // Early stock check for UX — definitive check is atomic inside the transaction below
      const availableStock = stockMap.get(key) ?? 0
      if (availableStock < item.quantity) {
        const productName = nameMap.get(item.productId) ?? item.productId
        const variant     = item.variantLabel ? ` (${item.variantLabel})` : ''
        return NextResponse.json(
          { error: `Stock insuficiente para "${productName}"${variant}. Disponible: ${availableStock}` },
          { status: 422 }
        )
      }

      resolvedItems.push({ ...item, unitPrice })
    }

    const total          = resolvedItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)
    const orderNumber    = generateOrderNumber()
    const canModifyUntil = new Date(Date.now() + 30 * 60 * 1000)

    // Atomic: decrement stock and create order in a single transaction.
    // Uses updateMany with `stock >= quantity` in the WHERE clause so the
    // check and decrement are one DB operation — safe under concurrent orders.
    const order = await prisma.$transaction(async (tx) => {
      for (const item of resolvedItems) {
        const ok = await takeStock(tx, {
          productId:    item.productId,
          variantLabel: item.variantLabel ?? null,
          quantity:     item.quantity,
        })
        if (!ok) {
          const variant = item.variantLabel ? ` (${item.variantLabel})` : ''
          throw new StockError(`Stock insuficiente para "${nameMap.get(item.productId)}"${variant}`)
        }
      }

      return tx.order.create({
        data: {
          orderNumber,
          paymentMethod,
          customerName,
          address,
          phone,
          notes,
          total,
          canModifyUntil,
          // Efectivo queda confirmado al instante. Transferencia y MP quedan
          // pendientes hasta que entra la plata (el admin marca "pago recibido").
          status:        paymentMethod === 'CASH_ON_DELIVERY' ? 'CONFIRMED' : 'PENDING',
          paymentStatus: 'PENDING',
          items: {
            create: resolvedItems.map(i => ({
              productId:    i.productId,
              variantLabel: i.variantLabel ?? null,
              quantity:     i.quantity,
              unitPrice:    i.unitPrice,
            })),
          },
        },
        select: { orderNumber: true, status: true, total: true },
      })
    })

    // Aviso al cliente (y al dueño si está OWNER_WHATSAPP). El texto depende del
    // medio de pago: ver buildOrderMessage.
    await notifyOrderWhatsApp({
      orderNumber,
      customerName,
      phone,
      address,
      total,
      notes,
      paymentMethod,
      isPendingPayment: paymentMethod === 'MERCADOPAGO',
      items: resolvedItems.map(i => ({
        name:         nameMap.get(i.productId) ?? 'Producto',
        variantLabel: i.variantLabel,
        quantity:     i.quantity,
        unitPrice:    i.unitPrice,
      })),
    })

    // Lo que este pedido dejó con pocas unidades: la tienda se entera sin abrir el panel
    const low = resolvedItems
      .map(i => {
        const key  = i.variantLabel ? `${i.productId}:${i.variantLabel}` : i.productId
        const left = (stockMap.get(key) ?? 0) - i.quantity
        return { name: `${nameMap.get(i.productId) ?? 'Producto'}${i.variantLabel ? ` (${i.variantLabel})` : ''}`, left }
      })
      .filter(i => i.left <= LOW_STOCK_NOTICE)
    if (low.length > 0) {
      await notifyOwner(
        `⚠️ Poco stock después del pedido ${orderNumber}:\n` +
          low.map(i => `• ${i.name}: ${i.left === 0 ? 'sin stock' : i.left === 1 ? 'queda 1' : `quedan ${i.left}`}`).join('\n'),
        { orderNumber, event: 'low-stock' },
      )
    }

    return NextResponse.json({
      orderNumber: order.orderNumber,
      status:      order.status,
      total:       Number(order.total),
    }, { status: 201 })

  } catch (err) {
    if (err instanceof StockError) {
      return NextResponse.json({ error: err.message }, { status: 422 })
    }
    logger.error('Error creating order', { error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: 'Error al crear el pedido' }, { status: 500 })
  }
}
