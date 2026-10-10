import { logger } from '@/lib/logger'
import { getBaseUrl, PAYMENT_METHOD_LABEL, type PaymentMethod } from '@/lib/shop'
import { formatPrice } from '@/lib/utils'

export interface OrderNotificationPayload {
  orderNumber:      string
  customerName:     string
  phone:            string
  total:            number
  notes?:           string | null
  address?:         string
  paymentMethod?:   PaymentMethod
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

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0]
}

function orderLink(orderNumber: string): string {
  return getBaseUrl() ? `\n\nPodés ver tu pedido acá:\n${getBaseUrl()}/pedido/${orderNumber}` : ''
}

function itemLines(items: OrderNotificationPayload['items']): string {
  return items.map(i => {
    const name = i.variantLabel ? `${i.name} (${i.variantLabel})` : i.name
    return `• ${i.quantity} × ${name}: ${formatPrice(i.unitPrice * i.quantity)}`
  }).join('\n')
}

/** Texto del WhatsApp que recibe el cliente al hacer el pedido. Formato WhatsApp: *negrita*, _cursiva_. */
export function buildOrderMessage(p: OrderNotificationPayload): string {
  const name   = firstName(p.customerName)
  const detail = `*Pedido ${p.orderNumber}*\n${itemLines(p.items)}\n\n*Total: ${formatPrice(p.total)}*`
  const notes  = p.notes?.trim() ? `\n\nNos dejaste esta indicación:\n_${p.notes.trim()}_` : ''
  const link   = orderLink(p.orderNumber)

  if (p.paymentMethod === 'MERCADOPAGO') {
    return p.isPendingPayment
      ? `👋 ¡Hola ${name}! Recibimos tu pedido en MK-Pets.\n\n${detail}${notes}\n\nTe falta completar el pago con MercadoPago. Reservamos tus productos por 90 minutos.${link}`
      : `✅ ¡Hola ${name}! Recibimos tu pago. Ya estamos preparando tu pedido 🐾\n\n${detail}${notes}\n\nTe escribimos por acá para coordinar la entrega.${link}`
  }

  if (p.paymentMethod === 'TRANSFER') {
    const alias = process.env.TRANSFER_ALIAS
    const how   = alias
      ? `Para confirmarlo, transferí *${formatPrice(p.total)}* al alias *${alias}* y mandanos el comprobante por acá.`
      : `Para confirmarlo, respondé este mensaje y te pasamos los datos para transferir *${formatPrice(p.total)}*.`
    return `👋 ¡Hola ${name}! Gracias por tu pedido en MK-Pets 🐾\n\n${detail}${notes}\n\n${how}${link}`
  }

  return `👋 ¡Hola ${name}! Gracias por tu pedido en MK-Pets 🐾\n\n${detail}${notes}\n\nPagás en efectivo cuando te lo entregamos. Te escribimos por acá para coordinar la entrega.${link}`
}

/** Aviso interno para quien atiende la tienda: entró un pedido. */
export function buildOwnerMessage(p: OrderNotificationPayload): string {
  const method = p.paymentMethod ? PAYMENT_METHOD_LABEL[p.paymentMethod] : 'Sin especificar'
  const notes  = p.notes?.trim() ? `\n📝 ${p.notes.trim()}` : ''
  const admin  = getBaseUrl() ? `\n\n${getBaseUrl()}/admin/pedidos` : ''

  return `🛒 *Nuevo pedido ${p.orderNumber}*\n\n` +
    `👤 ${p.customerName} — wa.me/${normalizeArgPhone(p.phone)}\n` +
    (p.address ? `📍 ${p.address}\n` : '') +
    `💰 ${formatPrice(p.total)} · ${method}${notes}\n\n` +
    `${itemLines(p.items)}${admin}`
}

export type CustomerUpdate = 'PAYMENT_RECEIVED' | 'PREPARING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'

/** Mensaje al cliente cuando el admin cambia algo de su pedido. */
export function buildStatusMessage(update: CustomerUpdate, order: { orderNumber: string; customerName: string }): string {
  const name = firstName(order.customerName)
  const n    = order.orderNumber
  const link = orderLink(n)

  switch (update) {
    case 'PAYMENT_RECEIVED': return `✅ ¡Hola ${name}! Recibimos el pago de tu pedido *${n}*. Ya lo estamos preparando 🐾${link}`
    case 'PREPARING':        return `📦 ¡Hola ${name}! Estamos preparando tu pedido *${n}*. Te avisamos cuando salga.${link}`
    case 'SHIPPED':          return `🚚 ¡Hola ${name}! Tu pedido *${n}* está en camino. ¡Ya casi llega!${link}`
    case 'DELIVERED':        return `🎉 ¡Hola ${name}! Entregamos tu pedido *${n}*. Gracias por comprar en MK-Pets 🐾 Cualquier cosa, escribinos por acá.`
    case 'CANCELLED':        return `Hola ${name}, tu pedido *${n}* fue cancelado. Si fue un error o querés retomarlo, respondé este mensaje y lo resolvemos.`
  }
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(process.env.EVOLUTION_API_URL || process.env.N8N_ORDER_WEBHOOK_URL)
}

/**
 * Manda un texto por WhatsApp. Nunca lanza: un fallo de mensajería no puede
 * hacer fallar un pedido ni un cambio de estado.
 *
 * Usa Evolution API directo si está EVOLUTION_API_URL; si no, el webhook de n8n
 * (workflow infra/n8n/workflow-whatsapp-pedido.json, que solo reenvía el texto).
 *
 * Hay que hacerle `await`: en serverless (Netlify/Vercel) la función se congela
 * apenas se devuelve la respuesta y un fetch "suelto" se pierde. El timeout
 * acota cuánto puede demorar la respuesta si el servicio está caído.
 */
export async function sendWhatsApp(rawPhone: string, text: string, context: Record<string, unknown> = {}): Promise<boolean> {
  if (!isWhatsAppConfigured()) return false

  const number = normalizeArgPhone(rawPhone)
  const direct = Boolean(process.env.EVOLUTION_API_URL)

  try {
    const res = direct
      ? await fetch(
          `${process.env.EVOLUTION_API_URL!.replace(/\/+$/, '')}/message/sendText/${encodeURIComponent(process.env.EVOLUTION_INSTANCE ?? 'mi-bot')}`,
          {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', apikey: process.env.EVOLUTION_API_KEY ?? '' },
            body:    JSON.stringify({ number, text }),
            signal:  AbortSignal.timeout(6000),
          },
        )
      : await fetch(process.env.N8N_ORDER_WEBHOOK_URL!, {
          method:  'POST',
          headers: {
            'Content-Type': 'application/json',
            // n8n valida este header para que nadie más pueda disparar mensajes
            ...(process.env.N8N_WEBHOOK_SECRET && { 'x-mkpets-secret': process.env.N8N_WEBHOOK_SECRET }),
          },
          body:   JSON.stringify({ phone: number, message: text }),
          signal: AbortSignal.timeout(4000),
        })

    if (!res.ok) {
      logger.error('WhatsApp rejected', { ...context, via: direct ? 'evolution' : 'n8n', status: res.status })
      return false
    }
    return true
  } catch (err) {
    logger.error('WhatsApp failed', { ...context, via: direct ? 'evolution' : 'n8n', error: String(err) })
    return false
  }
}

/**
 * Avisos de un pedido nuevo: al cliente y, si está configurado OWNER_WHATSAPP,
 * a quien atiende la tienda. Se mandan en paralelo.
 */
export async function notifyOrderWhatsApp(payload: OrderNotificationPayload): Promise<boolean> {
  if (!isWhatsAppConfigured()) return false

  const context = { orderNumber: payload.orderNumber }
  const owner   = process.env.OWNER_WHATSAPP
  // El aviso al dueño va una sola vez por pedido: no se repite cuando MP confirma el pago.
  const notifyOwner = owner && !(payload.paymentMethod === 'MERCADOPAGO' && payload.isPendingPayment === false)

  const [customerOk] = await Promise.all([
    sendWhatsApp(payload.phone, buildOrderMessage(payload), { ...context, to: 'customer' }),
    notifyOwner ? sendWhatsApp(owner, buildOwnerMessage(payload), { ...context, to: 'owner' }) : Promise.resolve(false),
  ])
  return customerOk
}
