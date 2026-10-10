/** Datos del negocio que se repiten en la tienda. */

/** WhatsApp de MK-Pets en formato internacional, sin "+" (lo que espera wa.me). */
export const SHOP_WHATSAPP = process.env.NEXT_PUBLIC_SHOP_WHATSAPP || '5491166698395'

export const SHOP_TIMEZONE = 'America/Argentina/Buenos_Aires'

/**
 * MercadoPago está apagado por defecto (la comisión no les cierra por ahora).
 * Para volver a ofrecerlo: NEXT_PUBLIC_ENABLE_MERCADOPAGO="true" + las claves de MP.
 */
export const MP_ENABLED = process.env.NEXT_PUBLIC_ENABLE_MERCADOPAGO === 'true'

export type PaymentMethod = 'TRANSFER' | 'CASH_ON_DELIVERY' | 'MERCADOPAGO'

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  TRANSFER:         'Transferencia',
  CASH_ON_DELIVERY: 'Efectivo al recibir',
  MERCADOPAGO:      'MercadoPago',
}

/** Medios de pago que se ofrecen en el checkout, en el orden en que se muestran. */
export function enabledPaymentMethods(): PaymentMethod[] {
  return MP_ENABLED
    ? ['TRANSFER', 'CASH_ON_DELIVERY', 'MERCADOPAGO']
    : ['TRANSFER', 'CASH_ON_DELIVERY']
}

/** URL pública del sitio, sin barra final (evita `//pedido/...` al armar links). */
export function getBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '')
}

export function whatsappLink(text?: string): string {
  const base = `https://wa.me/${SHOP_WHATSAPP}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}
