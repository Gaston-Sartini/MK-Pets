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

// Categorías que son alimento aunque se llamen por el animal ("Gatos", "Perros", "Húmedos")
const FOOD_CATEGORY = /gat|perr|h[uú]med|aliment|balancead/i
// Cómo se nombra en una frase un rubro cuyo nombre solo no se lee bien
const RUBRO_WORDING: [RegExp, string][] = [
  [/higiene|arena|sanitari/i, 'productos de higiene'],
  [/salud|farmacia/i, 'productos de salud'],
]

/**
 * Lo que vende la tienda hoy, en una frase: "alimentos, snacks y productos de higiene".
 * Sale de las categorías que tienen productos activos, así los textos del sitio nunca
 * prometen un rubro vacío y suman solos uno nuevo (p. ej. "juguetes") cuando se carga.
 */
export function describeCatalog(categoryNames: string[]): string {
  const rubros: string[] = []
  for (const name of categoryNames) {
    const rubro = FOOD_CATEGORY.test(name)
      ? 'alimentos'
      : RUBRO_WORDING.find(([re]) => re.test(name))?.[1] ?? name.trim().toLowerCase()
    if (rubro && !rubros.includes(rubro)) rubros.push(rubro)
  }
  if (rubros.length === 0) return 'productos'
  // Los alimentos van primero: es lo principal de la tienda
  rubros.sort((a, b) => Number(b === 'alimentos') - Number(a === 'alimentos'))
  if (rubros.length === 1) return rubros[0]
  const last = rubros[rubros.length - 1]
  return `${rubros.slice(0, -1).join(', ')} ${/^h?i(?!e)/i.test(last) ? 'e' : 'y'} ${last}`
}

/** La misma frase con mayúscula inicial, para empezar una oración. */
export function describeCatalogTitle(categoryNames: string[]): string {
  const text = describeCatalog(categoryNames)
  return text.charAt(0).toUpperCase() + text.slice(1)
}
