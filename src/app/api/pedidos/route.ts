import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { generateOrderNumber } from '@/lib/utils'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

const createOrderSchema = z.object({
  paymentMethod: z.enum(['MERCADOPAGO', 'CASH_ON_DELIVERY']),
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

export async function POST(request: Request) {
  // 10 orders per IP per 10 minutes — prevents order flooding
  const rl = rateLimit(getClientIp(request), { limit: 10, windowMs: 10 * 60 * 1000 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Intentá en unos minutos.' },
      {
        status:  429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
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

    // SECURITY: look up actual prices from DB — never trust client-supplied prices
    const productIds = [...new Set(items.map(i => i.productId))]
    const dbProducts = await prisma.product.findMany({
      where:  { id: { in: productIds }, isActive: true },
      select: {
        id:        true,
        basePrice: true,
        variants:  { select: { label: true, price: true } },
      },
    })

    // Build price map: "productId" or "productId:variantLabel" → price
    const priceMap = new Map<string, number>()
    for (const p of dbProducts) {
      if (p.variants.length > 0) {
        for (const v of p.variants) {
          priceMap.set(`${p.id}:${v.label}`, Number(v.price))
        }
      } else {
        priceMap.set(p.id, Number(p.basePrice))
      }
    }

    // Validate every item exists and is purchasable
    const resolvedItems: { productId: string; variantLabel?: string; quantity: number; unitPrice: number }[] = []
    for (const item of items) {
      const key = item.variantLabel
        ? `${item.productId}:${item.variantLabel}`
        : item.productId

      const unitPrice = priceMap.get(key)
      if (unitPrice === undefined) {
        return NextResponse.json(
          { error: `Producto no disponible: ${item.productId}` },
          { status: 422 }
        )
      }
      resolvedItems.push({ ...item, unitPrice })
    }

    const total          = resolvedItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)
    const orderNumber    = generateOrderNumber()
    const canModifyUntil = new Date(Date.now() + 30 * 60 * 1000)

    const order = await prisma.order.create({
      data: {
        orderNumber,
        paymentMethod,
        customerName,
        address,
        phone,
        notes,
        total,
        canModifyUntil,
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

    return NextResponse.json({
      orderNumber: order.orderNumber,
      status:      order.status,
      total:       Number(order.total),
    }, { status: 201 })

  } catch {
    return NextResponse.json({ error: 'Error al crear el pedido' }, { status: 500 })
  }
}
