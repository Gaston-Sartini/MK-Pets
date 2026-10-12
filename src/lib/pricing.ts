/**
 * Aumento (o rebaja) masivo de precios.
 *
 * La misma cuenta se usa para la vista previa del panel y para aplicar el cambio
 * en el servidor: lo que el dueño ve es exactamente lo que se guarda.
 */

export const ROUND_OPTIONS = [1, 10, 50, 100, 500] as const
export type RoundTo = (typeof ROUND_OPTIONS)[number]

/** Precio con el porcentaje aplicado y redondeado al múltiplo elegido. Nunca baja de ese múltiplo. */
export function applyIncrease(price: number, percent: number, roundTo: RoundTo = 100): number {
  const raw = price * (1 + percent / 100)
  return Math.max(roundTo, Math.round(raw / roundTo) * roundTo)
}

export interface PricedVariant { label: string; price: number; originalPrice: number | null }
export interface PricedProduct {
  id: string
  name: string
  categoryId: string
  basePrice: number
  originalPrice: number | null
  variants: PricedVariant[]
}

export interface PriceChange {
  productId: string
  name: string
  variantLabel: string | null
  before: number
  after: number
  /** Precio "antes" tachado: sube en la misma proporción para no inventar un descuento más grande */
  originalBefore: number | null
  originalAfter: number | null
}

const plain = (text: string) => text.toLowerCase().normalize('NFD').replace(/[^a-z0-9 ]/g, '')

/** ¿El producto entra en el aumento? Por categoría (vacío = todas) y por texto en el nombre (marca). */
export function matchesPriceFilter(p: Pick<PricedProduct, 'name' | 'categoryId'>, categoryId: string, text: string): boolean {
  if (categoryId && p.categoryId !== categoryId) return false
  const words = plain(text).split(' ').filter(Boolean)
  const name  = plain(p.name)
  return words.every(w => name.includes(w))
}

/** Todos los precios que cambian, uno por producto sin variantes o por variante. */
export function priceChanges(products: PricedProduct[], percent: number, roundTo: RoundTo): PriceChange[] {
  const scale = (value: number | null) => (value === null ? null : applyIncrease(value, percent, roundTo))
  return products.flatMap<PriceChange>(p => (p.variants.length
    ? p.variants.map(v => ({
        productId: p.id, name: p.name, variantLabel: v.label,
        before: v.price, after: applyIncrease(v.price, percent, roundTo),
        originalBefore: v.originalPrice, originalAfter: scale(v.originalPrice),
      }))
    : [{
        productId: p.id, name: p.name, variantLabel: null,
        before: p.basePrice, after: applyIncrease(p.basePrice, percent, roundTo),
        originalBefore: p.originalPrice, originalAfter: scale(p.originalPrice),
      }]))
}
