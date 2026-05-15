import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { logger } from '@/lib/logger'

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  // timingSafeEqual prevents timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  const rawBody   = await request.text()
  const signature = request.headers.get('x-signature') ?? ''
  const secret    = process.env.MP_WEBHOOK_SECRET ?? ''

  // SECURITY: fail closed — if secret is not configured, reject all webhooks.
  // Previously the condition `if (secret && ...)` would skip verification when secret was empty,
  // allowing forged webhook payloads to mark orders as paid.
  if (!secret) {
    logger.error('MP webhook secret not configured — rejecting request', { path: '/api/webhooks/mercadopago' })
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  if (!verifySignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
  }

  let payload: { type: string; data?: { id?: string } }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  if (payload.type !== 'payment') {
    return NextResponse.json({ ok: true })
  }

  const paymentId = payload.data?.id
  if (!paymentId) return NextResponse.json({ ok: true })

  try {
    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } }
    )

    if (!mpResponse.ok) {
      logger.error('MP API error fetching payment', { paymentId, status: mpResponse.status })
      return NextResponse.json({ error: 'Error consultando pago' }, { status: 502 })
    }

    const payment = await mpResponse.json()

    const orderNumber: string = payment.external_reference
    if (!orderNumber) return NextResponse.json({ ok: true })

    const mpStatus: string = payment.status

    const paymentStatus =
      mpStatus === 'approved' ? 'APPROVED' :
      mpStatus === 'rejected' ? 'REJECTED' : 'PENDING'

    const orderStatus =
      mpStatus === 'approved' ? 'CONFIRMED' : 'PENDING'

    await prisma.order.update({
      where: { orderNumber },
      data: {
        paymentStatus,
        status:      orderStatus,
        mpPaymentId: String(paymentId),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.error('MP webhook processing error', {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Error procesando webhook' }, { status: 500 })
  }
}
