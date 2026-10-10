'use client'

import { useEffect } from 'react'
import { useCartStore } from '@/store/cart-store'
import { useToastStore } from '@/store/toast-store'
import type { ChatCard } from '@/lib/chat-types'

/**
 * Mounts a `window.MKPets` bridge that the Typebot custom-code block
 * can invoke without coupling Typebot to React/Zustand internals.
 *
 * Usage from inside a Typebot "Execute Code" block:
 *   window.MKPets.addToCart(card)        // adds the product card to the cart
 *   window.MKPets.openProduct(card.slug) // navigates to the product detail page
 */
declare global {
  interface Window {
    MKPets?: {
      addToCart:   (card: ChatCard) => void
      openProduct: (slug: string) => void
      openCart:    () => void
      version:     string
    }
  }
}

const BRIDGE_VERSION = '1.0.0'

export default function ChatBridge() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const bridge: NonNullable<Window['MKPets']> = {
      version: BRIDGE_VERSION,

      addToCart(card) {
        if (!card || typeof card !== 'object') {
          console.warn('[MKPets.addToCart] invalid card', card)
          return
        }
        const { productId, name, image, slug, variantLabel, unitPrice } = card
        if (!productId || !name || !slug || typeof unitPrice !== 'number') {
          console.warn('[MKPets.addToCart] missing required fields', card)
          return
        }

        useCartStore.getState().addItem({
          productId,
          name,
          image:        image || '',
          slug,
          variantLabel: variantLabel ?? undefined,
          unitPrice,
        })
        useToastStore.getState().addToast({
          message: `✓ ${name} agregado 🐾`,
          type:    'success',
        })
        useCartStore.getState().openDrawer()
      },

      openProduct(slug) {
        if (!slug) return
        window.location.href = `/producto/${slug}`
      },

      openCart() {
        useCartStore.getState().openDrawer()
      },
    }

    window.MKPets = bridge
    // Let any listener (Typebot embed scripts) know the bridge is ready
    window.dispatchEvent(new Event('mkpets:bridge-ready'))
  }, [])

  return null
}
