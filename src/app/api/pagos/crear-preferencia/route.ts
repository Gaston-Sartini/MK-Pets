import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createMpPreference } from '@/lib/mercadopago'

const schema = z.object({
  orderNumber: z.string().min(10).max(30),
  items: z.array(z.object({
    id:         z.string(),
    title:      z.string().max(255),
    quantity:   z.number().int().positive(),
    unit_price: z.number().positive(),
  })).min(1),
  total: z.number().positive(),
})

export async function POST(request: Request) {
  try {
    const body   = await request.json()
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const preference = await createMpPreference(parsed.data)

    return NextResponse.json({
      preferenceId: preference.id,
      initPoint:    preference.init_point,       // redirect URL para el cliente
      sandboxUrl:   preference.sandbox_init_point,
    })

  } catch (err) {
    console.error('[MP] Error creando preferencia:', err)
    return NextResponse.json(
      { error: 'No se pudo crear el pago. Intentá de nuevo o elegí pagar al recibir.' },
      { status: 502 }
    )
  }
}
