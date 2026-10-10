import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createMpPreference } from '@/lib/mercadopago'
import { logger } from '@/lib/logger'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

// SECURITY: el cliente manda SOLO el número de pedido. Los ítems y precios que
// se cobran salen de la base — si vinieran del browser, cualquiera podría pagar
// $1 por un pedido de $100.000.
const schema = z.object({
  orderNumber: z.string().min(10).max(30),
})

export async function POST(request: Request) {
  const rl = rateLimit(`mp-pref:${getClientIp(request)}`, { limit: 20, windowMs: 10 * 60 * 1000 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiadas solicitudes. Intentá en unos minutos.' }, { status: 429 })
  }

  try {
    const parsed = schema.safeParse(await request.json().catch(() => null))

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const order = await prisma.order.findUnique({
      where:  { orderNumber: parsed.data.orderNumber },
      select: {
        orderNumber:   true,
        status:        true,
        paymentMethod: true,
        paymentStatus: true,
        createdAt:     true,
        items: {
          select: {
            productId:    true,
            variantLabel: true,
            quantity:     true,
            unitPrice:    true,
            product:      { select: { name: true } },
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    }
    if (order.paymentMethod !== 'MERCADOPAGO') {
      return NextResponse.json({ error: 'Este pedido no se paga con MercadoPago' }, { status: 409 })
    }
    if (order.paymentStatus === 'APPROVED') {
      return NextResponse.json({ error: 'Este pedido ya está pago' }, { status: 409 })
    }
    if (order.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'El pedido fue cancelado. Armá uno nuevo desde la tienda.' },
        { status: 409 }
      )
    }

    const preference = await createMpPreference({
      orderNumber: order.orderNumber,
      createdAt:   order.createdAt,
      items: order.items.map(i => ({
        id:         i.productId,
        title:      (i.product.name + (i.variantLabel ? ` (${i.variantLabel})` : '')).slice(0, 255),
        quantity:   i.quantity,
        unit_price: Number(i.unitPrice),
      })),
    })

    return NextResponse.json({
      preferenceId: preference.id,
      initPoint:    preference.init_point,       // redirect URL para el cliente
      sandboxUrl:   preference.sandbox_init_point,
    })

  } catch (err) {
    logger.error('Error creando preferencia MP', { error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json(
      { error: 'No se pudo crear el pago. Intentá de nuevo o elegí pagar al recibir.' },
      { status: 502 }
    )
  }
}
