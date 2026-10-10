import MercadoPagoConfig, { Preference } from 'mercadopago'
import { getBaseUrl } from '@/lib/shop'

/** Minutos que el cliente tiene para pagar antes de que MP rechace el pago. */
export const MP_PAYMENT_WINDOW_MINUTES = 90

export interface MpItem {
  id:         string
  title:      string
  quantity:   number
  unit_price: number
}

/** Crea una preferencia de pago en MercadoPago */
export async function createMpPreference(opts: {
  orderNumber: string
  items:       MpItem[]
  createdAt:   Date
}) {
  // El cliente se crea por llamada: así un token faltante falla acá con un error
  // claro y no al importar el módulo (que rompería el build).
  const accessToken = process.env.MP_ACCESS_TOKEN
  if (!accessToken) throw new Error('MP_ACCESS_TOKEN no configurado')

  const client  = new MercadoPagoConfig({ accessToken, options: { timeout: 5000 } })
  const baseUrl = getBaseUrl()
  const isHttps = baseUrl.startsWith('https://')

  // Los pedidos MP sin pagar se cancelan solos a las 2 h (ver expire_unpaid_orders
  // en la base). La preferencia vence antes para que nadie pague un pedido ya cancelado.
  const expiresAt = new Date(opts.createdAt.getTime() + MP_PAYMENT_WINDOW_MINUTES * 60 * 1000)

  return new Preference(client).create({
    body: {
      items: opts.items.map(i => ({
        id:          i.id,
        title:       i.title,
        quantity:    i.quantity,
        unit_price:  i.unit_price,
        currency_id: 'ARS',
      })),
      external_reference: opts.orderNumber,
      back_urls: {
        success: `${baseUrl}/pedido/${opts.orderNumber}?mp=success`,
        failure: `${baseUrl}/pedido/${opts.orderNumber}?mp=failure`,
        pending: `${baseUrl}/pedido/${opts.orderNumber}?mp=pending`,
      },
      // MP rechaza auto_return y notification_url si no son https (caso localhost)
      ...(isHttps && {
        auto_return:      'approved' as const,
        notification_url: `${baseUrl}/api/webhooks/mercadopago`,
      }),
      expires:              true,
      expiration_date_to:   expiresAt.toISOString(),
      statement_descriptor: 'MK-PETS',
      metadata: { order_number: opts.orderNumber },
    },
  })
}
