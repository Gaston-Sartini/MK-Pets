import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { logger } from '@/lib/logger'
import { syncMpPayment } from '@/lib/mp-payments'

/**
 * Valida la firma de MercadoPago.
 *
 * MP manda `x-signature: ts=<timestamp>,v1=<hmac>` y firma este texto (no el body):
 *   id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 * con HMAC-SHA256 usando la "clave secreta" de Tus integraciones → Webhooks.
 * https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
 */
function verifySignature(opts: {
  signatureHeader: string
  requestId:       string
  dataId:          string
  secret:          string
}): boolean {
  const parts = new Map(
    opts.signatureHeader.split(',').map(p => {
      const [k, ...v] = p.split('=')
      return [k.trim(), v.join('=').trim()] as const
    })
  )
  const ts = parts.get('ts')
  const v1 = parts.get('v1')
  if (!ts || !v1) return false

  // MP arma el manifest solo con los valores presentes
  let manifest = ''
  if (opts.dataId)    manifest += `id:${opts.dataId.toLowerCase()};`
  if (opts.requestId) manifest += `request-id:${opts.requestId};`
  manifest += `ts:${ts};`

  const expected = crypto.createHmac('sha256', opts.secret).update(manifest).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'))
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  const url     = new URL(request.url)
  const rawBody = await request.text()
  const secret  = process.env.MP_WEBHOOK_SECRET ?? ''

  // Notificaciones IPN (formato viejo, `?topic=payment&id=...`): MP no las firma.
  // Se responden 200 para que no las reintente; el estado del pago llega igual
  // por el webhook firmado y por la sincronización al volver del checkout.
  if (url.searchParams.has('topic')) {
    return NextResponse.json({ ok: true })
  }

  // SECURITY: fail closed — sin secreto configurado no se procesa ningún webhook.
  if (!secret) {
    logger.error('MP webhook secret not configured — rejecting request', { path: '/api/webhooks/mercadopago' })
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  let payload: { type?: string; data?: { id?: string | number } } = {}
  try {
    payload = rawBody ? JSON.parse(rawBody) : {}
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  // MP firma el `data.id` de la query string; el del body es el mismo valor.
  const dataId = url.searchParams.get('data.id') ?? String(payload.data?.id ?? '')

  const validSignature = verifySignature({
    signatureHeader: request.headers.get('x-signature') ?? '',
    requestId:       request.headers.get('x-request-id') ?? '',
    dataId,
    secret,
  })
  if (!validSignature) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
  }

  const type = payload.type ?? url.searchParams.get('type')
  if (type !== 'payment' || !dataId) {
    return NextResponse.json({ ok: true })
  }

  try {
    const result = await syncMpPayment(dataId)
    if (!result.ok && result.reason === 'mp_unreachable') {
      // 502 → MP reintenta la notificación más tarde
      return NextResponse.json({ error: 'Error consultando pago' }, { status: 502 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.error('MP webhook processing error', {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Error procesando webhook' }, { status: 500 })
  }
}
