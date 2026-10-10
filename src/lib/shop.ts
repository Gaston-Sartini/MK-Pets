/** Datos del negocio que se repiten en la tienda. */

/** WhatsApp de MK-Pets en formato internacional, sin "+" (lo que espera wa.me). */
export const SHOP_WHATSAPP = process.env.NEXT_PUBLIC_SHOP_WHATSAPP || '5491166698395'

export const SHOP_TIMEZONE = 'America/Argentina/Buenos_Aires'

/** URL pública del sitio, sin barra final (evita `//pedido/...` al armar links). */
export function getBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '')
}

export function whatsappLink(text?: string): string {
  const base = `https://wa.me/${SHOP_WHATSAPP}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}
