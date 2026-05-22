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

export interface ChatResponse {
  reply:        string
  cards:        ChatCard[]
  suggestions?: string[]
}
