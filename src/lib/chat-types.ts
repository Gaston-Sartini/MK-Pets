/**
 * Wire format between n8n (the AI agent) → Typebot → this frontend.
 * See docs/n8n-system-prompt.md for the contract the agent must produce.
 */

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
 * El productId DEBE existir en el catálogo y haber sido mostrado al cliente
 * en turnos previos (el backend valida esto contra staticData.shownProducts).
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
