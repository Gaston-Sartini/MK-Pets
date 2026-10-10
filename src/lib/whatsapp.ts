import { logger } from '@/lib/logger'
import { getBaseUrl } from '@/lib/shop'
import { formatPrice } from '@/lib/utils'

export interface OrderNotificationPayload {
  orderNumber:      string
  customerName:     string
  phone:            string
  total:            number
  notes?:           string | null
  paymentMethod?:   'MERCADOPAGO' | 'CASH_ON_DELIVERY'
  isPendingPayment?: boolean   // true = pedido MP que todavía no se pagó
  items: Array<{
    name:          string
    variantLabel?: string | null
    quantity:      number
    unitPrice:     number
  }>
}

/**
 * Normaliza teléfonos argentinos al formato que espera Evolution API: 549 + área + número.
 * Acepta lo que la gente realmente escribe: "011 15 6669-8395", "+54 9 11 6669 8395",
 * "1166698395", "15 6669 8395" (asume AMBA cuando falta el código de área).
 */
export function normalizeArgPhone(raw: string): string {
  let d = raw.replace(/\D/g, '')

  if (d.startsWith('549')) return d
  if (d.startsWith('54'))  d = d.slice(2)
  if (d.startsWith('0'))   d = d.slice(1)

  // "15" después del código de área (2 a 4 dígitos) es el prefijo de celular viejo: se descarta
  if (d.length > 10) {
    const m = d.match(/^(\d{2,4})15(\d{6,8})$/)
    if (m && (m[1] + m[2]).length === 10) d = m[1] + m[2]
  }
  // "15 xxxx xxxx" sin código de área → celular de AMBA
  if (d.length === 10 && d.startsWith('15')) d = '11' + d.slice(2)
  if (d.length === 8) d = '11' + d

  return '549' + d
}

/** Texto del WhatsApp que recibe el cliente. Formato WhatsApp: *negrita*, _cursiva_. */
export function buildOrderMessage(p: OrderNotificationPayload): string {
  const firstName = p.customerName.trim().split(/\s+/)[0]
  const lines = p.items.map(i => {
    const name = i.variantLabel ? `${i.name} (${i.variantLabel})` : i.name
    return `• ${i.quantity} × ${name}: ${formatPrice(i.unitPrice * i.quantity)}`
  }).join('\n')

  const detail = `*Pedido ${p.orderNumber}*\n${lines}\n\n*Total: ${formatPrice(p.total)}*`
  const notes  = p.notes?.trim() ? `\n\nNos dejaste esta indicación:\n_${p.notes.trim()}_` : ''
  const link   = getBaseUrl() ? `\n\nPodés ver tu pedido acá:\n${getBaseUrl()}/pedido/${p.orderNumber}` : ''

  if (p.paymentMethod === 'MERCADOPAGO') {
    return p.isPendingPayment
      ? `👋 ¡Hola ${firstName}! Recibimos tu pedido en MK-Pets.\n\n${detail}${notes}\n\nTe falta completar el pago con MercadoPago. Reservamos tus productos por 90 minutos.${link}`
      : `✅ ¡Hola ${firstName}! Recibimos tu pago. Ya estamos preparando tu pedido 🐾\n\n${detail}${notes}\n\nTe escribimos por acá para coordinar la entrega.${link}`
  }

  const alias = process.env.TRANSFER_ALIAS
  const payment = alias
    ? `Pagás al recibir, en efectivo o por transferencia al alias *${alias}*. Si transferís, mandanos el comprobante por acá.`
    : 'Pagás al recibir, en efectivo o por transferencia.'

  return `👋 ¡Hola ${firstName}! Gracias por tu pedido en MK-Pets 🐾\n\n${detail}${notes}\n\n${payment}\n\nTe escribimos por acá para coordinar la entrega.${link}`
}

/** Envío directo por Evolution API (sin n8n en el medio). */
async function sendViaEvolution(number: string, text: string): Promise<Response> {
  const baseUrl  = process.env.EVOLUTION_API_URL!.replace(/\/+$/, '')
  const instance = encodeURIComponent(process.env.EVOLUTION_INSTANCE ?? 'mi-bot')

  return fetch(`${baseUrl}/message/sendText/${instance}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', apikey: process.env.EVOLUTION_API_KEY ?? '' },
    body:    JSON.stringify({ number, text }),
    signal:  AbortSignal.timeout(6000),
  })
}

/** Envío vía n8n: n8n arma el mensaje y llama a Evolution. */
async function sendViaN8n(payload: OrderNotificationPayload): Promise<Response> {
  return fetch(process.env.N8N_ORDER_WEBHOOK_URL!, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      // n8n valida este header para que nadie más pueda disparar mensajes
      ...(process.env.N8N_WEBHOOK_SECRET && { 'x-mkpets-secret': process.env.N8N_WEBHOOK_SECRET }),
    },
    body:   JSON.stringify({ ...payload, message: buildOrderMessage(payload) }),
    signal: AbortSignal.timeout(4000),
  })
}

/**
 * Manda al cliente el WhatsApp de su pedido. Nunca lanza: un fallo en la
 * notificación no puede hacer fallar el pedido.
 *
 * Usa Evolution API directo si está configurado EVOLUTION_API_URL; si no, el
 * webhook de n8n (N8N_ORDER_WEBHOOK_URL). Sin ninguno de los dos, no hace nada.
 *
 * Hay que hacerle `await`: en serverless (Netlify/Vercel) la función se congela
 * apenas se devuelve la respuesta y un fetch "suelto" se pierde. El timeout
 * acota cuánto puede demorar la respuesta al cliente si el servicio está caído.
 */
export async function notifyOrderWhatsApp(payload: OrderNotificationPayload): Promise<boolean> {
  const direct = Boolean(process.env.EVOLUTION_API_URL)
  if (!direct && !process.env.N8N_ORDER_WEBHOOK_URL) return false

  const normalized: OrderNotificationPayload = { ...payload, phone: normalizeArgPhone(payload.phone) }

  try {
    const res = direct
      ? await sendViaEvolution(normalized.phone, buildOrderMessage(normalized))
      : await sendViaN8n(normalized)

    if (!res.ok) {
      logger.error('WhatsApp notification rejected', {
        orderNumber: payload.orderNumber, via: direct ? 'evolution' : 'n8n', status: res.status,
      })
      return false
    }
    return true
  } catch (err) {
    logger.error('WhatsApp notification failed', {
      orderNumber: payload.orderNumber, via: direct ? 'evolution' : 'n8n', error: String(err),
    })
    return false
  }
}
