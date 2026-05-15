'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  id: string            // productId + variantLabel (key único)
  productId: string
  name: string
  image: string
  slug: string
  variantLabel?: string
  quantity: number
  unitPrice: number
}

interface CartState {
  items: CartItem[]
  isDrawerOpen: boolean

  // Acciones
  addItem: (item: Omit<CartItem, 'id' | 'quantity'>) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  openDrawer: () => void
  closeDrawer: () => void

  // Derivados
  totalItems: () => number
  totalPrice: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isDrawerOpen: false,

      addItem: (newItem) => {
        const itemId = `${newItem.productId}${newItem.variantLabel ? `-${newItem.variantLabel}` : ''}`

        set((state) => {
          const existing = state.items.find(i => i.id === itemId)
          if (existing) {
            return {
              items: state.items.map(i =>
                i.id === itemId ? { ...i, quantity: i.quantity + 1 } : i
              ),
            }
          }
          return { items: [...state.items, { ...newItem, id: itemId, quantity: 1 }] }
        })
      },

      removeItem: (id) =>
        set(state => ({ items: state.items.filter(i => i.id !== id) })),

      updateQuantity: (id, quantity) => {
        if (quantity < 1) {
          get().removeItem(id)
          return
        }
        set(state => ({
          items: state.items.map(i => i.id === id ? { ...i, quantity } : i),
        }))
      },

      clearCart: () => set({ items: [] }),

      openDrawer:  () => set({ isDrawerOpen: true }),
      closeDrawer: () => set({ isDrawerOpen: false }),

      totalItems:  () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      totalPrice:  () => get().items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
    }),
    {
      name: 'mkpets-cart',
      partialize: (state) => ({ items: state.items }), // Solo persistir items, no UI state
    }
  )
)
