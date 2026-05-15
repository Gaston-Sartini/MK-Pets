import MercadoPagoConfig, { Preference, Payment } from 'mercadopago'

// Singleton del cliente MP — reutilizado entre invocaciones serverless
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
  options: { timeout: 5000 },
})

export const mpPreference = new Preference(client)
export const mpPayment    = new Payment(client)

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
  total:       number
}) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL!

  const response = await mpPreference.create({
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
        failure: `${baseUrl}/checkout?error=payment_failed&order=${opts.orderNumber}`,
        pending: `${baseUrl}/pedido/${opts.orderNumber}?mp=pending`,
      },
      auto_return:       'approved',
      notification_url:  `${baseUrl}/api/webhooks/mercadopago`,
      statement_descriptor: 'MK-PETS',
      metadata: { order_number: opts.orderNumber },
    },
  })

  return response
}
