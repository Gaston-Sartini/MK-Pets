/** Formato de las respuestas del chat vendedor (/api/chat) que consume el sitio. */

export type CardAction  = 'addToCart' | 'openProduct'
export type ProductBadge = 'NUEVO' | 'OFERTA' | 'MÁS VENDIDO' | null

export interface ChatCard {
  productId:      string
  variantLabel?:  string | null
  name:           string
  image:          string
  slug:           string
  unitPrice:      number
  originalPrice?: number | null
  badge?:         ProductBadge
  stock?:         number
  ctaLabel:       string
  ctaAction:      CardAction
}

/**
 * Acción que el frontend debe ejecutar automáticamente al recibir la
 * respuesta. Ej: el bot decide agregar un producto al carrito sin que el
 * usuario tenga que clickear "Agregar al carrito".
 *
 * El servidor valida que el producto exista en el catálogo antes de mandarla.
 */
export interface ChatActionAddToCart {
  type:         'addToCart'
  productId:    string
  name:         string
  image?:       string
  slug:         string
  unitPrice:    number
  variantLabel?: string | null
  /** Unidades a sumar. Si falta, 1. */
  quantity?:    number
}

/** El cliente pidió sacar algo del carrito ("sacame el whiskas", "mejor cambialo por el grande"). */
export interface ChatActionRemoveFromCart {
  type:         'removeFromCart'
  productId:    string
  name:         string
  variantLabel?: string | null
  /** Unidades a sacar. Si falta, se saca la línea entera. */
  quantity?:    number
}

export type ChatAction = ChatActionAddToCart | ChatActionRemoveFromCart

export interface ChatResponse {
  reply:        string
  cards:        ChatCard[]
  suggestions?: string[]
  /** Acciones que el frontend ejecuta automáticamente sin click del usuario. */
  actions?:     ChatAction[]
}
