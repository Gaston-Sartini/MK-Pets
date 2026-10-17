import { logger } from '@/lib/logger'
import { getBaseUrl, PAYMENT_METHOD_LABEL, type PaymentMethod } from '@/lib/shop'
import { formatPrice } from '@/lib/utils'
import { normalizeArgPhone } from '@/lib/phone'

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

// Vive en phone.ts para que también lo pueda usar el navegador (panel del admin)
export { normalizeArgPhone }

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
  return Boolean(process.env.EVOLUTION_API_URL)
}

function evolutionUrl(path: string): string {
  return `${process.env.EVOLUTION_API_URL!.replace(/\/+$/, '')}/${path}/${encodeURIComponent(process.env.EVOLUTION_INSTANCE ?? 'mi-bot')}`
}

function evolutionPost(path: string, body: Record<string, unknown>, timeoutMs: number) {
  return fetch(evolutionUrl(path), {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', apikey: process.env.EVOLUTION_API_KEY ?? '' },
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(timeoutMs),
  })
}

/** Lo que contestó Evolution cuando rechazó un envío (p. ej. "Connection Closed"), para el registro. */
async function evolutionError(res: Response): Promise<string> {
  const body = await res.text().catch(() => '')
  try {
    const message = JSON.parse(body)?.response?.message
    if (message) return String(Array.isArray(message) ? message.join('; ') : message).slice(0, 200)
  } catch { /* no era JSON */ }
  return body.slice(0, 200)
}

/**
 * Manda un texto por WhatsApp. Nunca lanza: un fallo de mensajería no puede
 * hacer fallar un pedido ni un cambio de estado.
 *
 * Lo envía por Evolution API (EVOLUTION_API_URL). Si la primera vez no contesta
 * a tiempo, reintenta una vez: después de días sin uso, el primer envío tarda más.
 *
 * Hay que hacerle `await` (o llamarlo dentro de `after()`): en serverless
 * (Netlify/Vercel) un fetch "suelto" se pierde cuando la función termina.
 */
export async function sendWhatsApp(
  rawPhone: string,
  text: string,
  context: Record<string, unknown> = {},
  opts: { imageUrl?: string | null } = {},
): Promise<boolean> {
  if (!isWhatsAppConfigured()) return false

  const number = normalizeArgPhone(rawPhone)
  const via = 'evolution'

  // Con imagen, el texto viaja como epígrafe. Si la imagen falla (URL caída,
  // Evolution no la puede bajar), se manda igual el texto solo: lo importante
  // es que el cliente reciba el detalle del pedido.
  if (opts.imageUrl) {
    try {
      const withImage = await evolutionPost('message/sendMedia', {
        number,
        mediatype: 'image',
        mimetype:  'image/png',
        media:     opts.imageUrl,
        fileName:  'mk-pets-pedido.png',
        caption:   text,
      }, 20_000)
      if (withImage.ok) {
        logger.info('WhatsApp sent', { ...context, via, withImage: true })
        return true
      }
      logger.warn('WhatsApp image failed — falling back to text', { ...context, status: withImage.status, error: await evolutionError(withImage) })
    } catch (err) {
      logger.warn('WhatsApp image failed — falling back to text', { ...context, status: 'network', error: String(err) })
    }
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await evolutionPost('message/sendText', { number, text }, 15_000)
      if (res.ok) {
        logger.info('WhatsApp sent', { ...context, via, attempt })
        return true
      }
      // Evolution contestó que no: reintentar no cambia nada (sesión caída, número inválido)
      logger.error('WhatsApp rejected', { ...context, via, status: res.status, error: await evolutionError(res) })
      return false
    } catch (err) {
      logger.error('WhatsApp failed', { ...context, via, attempt, error: String(err) })
    }
  }
  return false
}

/**
 * ¿Está saliendo WhatsApp? Evolution puede decir "conectado" con la conexión a
 * WhatsApp muerta por dentro (pasó en octubre de 2026: todos los envíos
 * respondían "Connection Closed"). Por eso, además del estado, se hace una
 * consulta real: preguntar si un número inventado tiene WhatsApp. No manda
 * nada a nadie, pero necesita la conexión viva.
 */
export async function whatsAppHealth(): Promise<{ ok: boolean; detail: string }> {
  if (!isWhatsAppConfigured()) return { ok: false, detail: 'WhatsApp no está configurado' }
  try {
    const state = await fetch(evolutionUrl('instance/connectionState'), {
      headers: { apikey: process.env.EVOLUTION_API_KEY ?? '' },
      signal:  AbortSignal.timeout(8_000),
      cache:   'no-store',
    })
    if (!state.ok) return { ok: false, detail: `El servidor de WhatsApp respondió ${state.status}` }
    const current = (await state.json().catch(() => null))?.instance?.state
    if (current !== 'open') return { ok: false, detail: `La sesión de WhatsApp está "${current ?? 'desconocida'}": hay que volver a vincular el teléfono` }

    // Número al azar: si se repite, Evolution contesta de memoria sin usar la conexión
    const probe = `54911${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`
    const res = await evolutionPost('chat/whatsappNumbers', { numbers: [probe] }, 10_000)
    if (res.ok) return { ok: true, detail: 'Conectado' }
    return { ok: false, detail: `La conexión con WhatsApp está caída (${await evolutionError(res)})` }
  } catch (err) {
    return { ok: false, detail: `El servidor de WhatsApp no responde (${String(err).slice(0, 80)})` }
  }
}

/** Link para mandar a mano, desde el WhatsApp de la tienda, un mensaje que no salió solo. */
export function manualWhatsAppLink(rawPhone: string, text: string): string {
  return `https://wa.me/${normalizeArgPhone(rawPhone)}?text=${encodeURIComponent(text)}`
}

/**
 * Imagen "Resumen de pedido" que encabeza el WhatsApp de un pedido nuevo.
 * Evolution la descarga por URL, así que tiene que ser pública: en producción es
 * la del propio sitio; en local (donde el sitio es localhost y Evolution no lo
 * alcanza desde Docker) se configura WHATSAPP_ORDER_IMAGE_URL.
 */
export function orderImageUrl(): string | null {
  if (process.env.WHATSAPP_ORDER_IMAGE_URL) return process.env.WHATSAPP_ORDER_IMAGE_URL
  const base = getBaseUrl()
  return base.startsWith('https://') ? `${base}/logo_resumen_compra.png` : null
}

/**
 * Aviso a quien atiende la tienda (OWNER_WHATSAPP). Para lo que el dueño tiene que
 * saber sin abrir el panel: el cliente cambió o canceló su pedido, queda poco stock.
 * Nunca frena la operación que lo dispara: si falla, se registra y se sigue.
 */
export async function notifyOwner(text: string, context: Record<string, unknown> = {}): Promise<boolean> {
  const owner = process.env.OWNER_WHATSAPP
  if (!owner || !isWhatsAppConfigured()) return false
  return sendWhatsApp(owner, text, { ...context, to: 'owner' }).catch(() => false)
}

/**
 * Avisos de un pedido nuevo: al cliente y, si está configurado OWNER_WHATSAPP,
 * a quien atiende la tienda.
 */
export async function notifyOrderWhatsApp(payload: OrderNotificationPayload): Promise<boolean> {
  if (!isWhatsAppConfigured()) return false

  const context = { orderNumber: payload.orderNumber }
  const owner   = process.env.OWNER_WHATSAPP
  // El aviso al dueño va una sola vez por pedido: no se repite cuando MP confirma el pago.
  const notifyOwner = owner && !(payload.paymentMethod === 'MERCADOPAGO' && payload.isPendingPayment === false)

  // De a uno: dos envíos a la vez al mismo número (cuando el dueño prueba con el
  // suyo) se trababan. Como corre después de responder, la demora no la ve nadie.
  const customerOk = await sendWhatsApp(payload.phone, buildOrderMessage(payload), { ...context, to: 'customer' }, { imageUrl: orderImageUrl() })
  if (notifyOwner) await sendWhatsApp(owner, buildOwnerMessage(payload), { ...context, to: 'owner' })
  return customerOk
}
