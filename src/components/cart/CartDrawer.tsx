'use client'

import { useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import Link from 'next/link'
import { X, Trash2, Plus, Minus, ShoppingBag } from 'lucide-react'
import { useCartStore } from '@/store/cart-store'
import { formatPrice, cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

// Focusable elements selector for focus trap
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export function CartDrawer() {
  const {
    items, isDrawerOpen,
    closeDrawer, removeItem, updateQuantity,
    totalItems, totalPrice,
  } = useCartStore()

  const router      = useRouter()
  const panelRef    = useRef<HTMLDivElement>(null)
  const triggerRef  = useRef<HTMLElement | null>(null)

  // Lock body scroll
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isDrawerOpen])

  // Save trigger & move focus into dialog on open
  useEffect(() => {
    if (isDrawerOpen) {
      triggerRef.current = document.activeElement as HTMLElement
      // Move focus to first focusable element inside the panel
      requestAnimationFrame(() => {
        const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)
        first?.focus()
      })
    } else {
      // Restore focus to the element that triggered the drawer
      triggerRef.current?.focus()
    }
  }, [isDrawerOpen])

  // ESC to close + focus trap
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isDrawerOpen || !panelRef.current) return

    if (e.key === 'Escape') {
      e.preventDefault()
      closeDrawer()
      return
    }

    // Focus trap: wrap Tab/Shift+Tab inside the dialog
    if (e.key === 'Tab') {
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (focusable.length === 0) return

      const first = focusable[0]
      const last  = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
  }, [isDrawerOpen, closeDrawer])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleCheckout = () => {
    closeDrawer()
    router.push('/checkout')
  }

  if (!isDrawerOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-drawer-title"
    >
      {/* OVERLAY */}
      <div
        className="absolute inset-0 bg-black/50 animate-fade-in"
        onClick={closeDrawer}
        aria-hidden="true"
      />

      {/* PANEL */}
      <div
        ref={panelRef}
        className="relative flex flex-col w-full max-w-[420px] h-full bg-white
                   shadow-drawer animate-slide-in-right"
      >

        {/* HEADER */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-mk-orange" aria-hidden="true" />
            <h2 id="cart-drawer-title" className="font-display font-bold text-mk-dark text-lg">
              Tu carrito
            </h2>
            {totalItems() > 0 && (
              <span className="text-sm font-body text-mk-mid font-normal" aria-live="polite">
                ({totalItems()} {totalItems() === 1 ? 'ítem' : 'ítems'})
              </span>
            )}
          </div>
          <button
            onClick={closeDrawer}
            className="p-1.5 text-mk-mid hover:text-mk-dark hover:bg-gray-100
                       rounded-lg transition-colors"
            aria-label="Cerrar carrito"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* ITEMS */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <EmptyCart onClose={closeDrawer} />
          ) : (
            <ul className="divide-y divide-gray-50 p-2" aria-label="Productos en el carrito">
              {items.map(item => (
                <CartItem
                  key={item.id}
                  item={item}
                  onRemove={() => removeItem(item.id)}
                  onUpdateQty={(qty) => updateQuantity(item.id, qty)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* FOOTER */}
        {items.length > 0 && (
          <div className="border-t border-gray-100 p-4 bg-white space-y-3">

            <div className="flex items-center gap-2 bg-mk-green-pale rounded-xl px-3 py-2">
              <span className="text-base" aria-hidden="true">🚚</span>
              <span className="text-xs font-body text-mk-green font-medium">
                Envío gratis a CABA incluido en tu pedido
              </span>
            </div>

            <div className="space-y-1.5 font-tabular">
              <div className="flex justify-between text-sm font-body text-mk-mid">
                <span>Subtotal</span>
                <span aria-label={`Subtotal: ${formatPrice(totalPrice())} pesos`}>
                  {formatPrice(totalPrice())}
                </span>
              </div>
              <div className="flex justify-between text-sm font-body text-mk-green font-bold">
                <span>Envío</span>
                <span>GRATIS</span>
              </div>
              <div className="flex justify-between font-display font-black text-mk-dark text-lg
                              border-t border-gray-100 pt-2">
                <span>Total</span>
                <span className="text-mk-orange" aria-label={`Total: ${formatPrice(totalPrice())} pesos`}>
                  {formatPrice(totalPrice())}
                </span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              className="btn-primary w-full py-3.5 text-base"
            >
              Ir al checkout →
            </button>
            <button
              onClick={closeDrawer}
              className="btn-ghost w-full text-center"
            >
              Seguir comprando
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

// ── SUB-COMPONENTES ────────────────────────────────────────────────────────

function CartItem({
  item,
  onRemove,
  onUpdateQty,
}: {
  item: { id: string; name: string; image: string; variantLabel?: string; quantity: number; unitPrice: number }
  onRemove: () => void
  onUpdateQty: (qty: number) => void
}) {
  return (
    <li className="flex gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
      <div className="relative w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100">
        <Image
          src={item.image}
          alt=""
          fill
          className="object-contain p-1"
          sizes="64px"
          aria-hidden="true"
        />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-display font-bold text-sm text-mk-dark leading-tight line-clamp-2">
          {item.name}
        </p>
        {item.variantLabel && (
          <p className="text-xs font-body text-mk-mid mt-0.5">{item.variantLabel}</p>
        )}
        <p className="font-display font-black text-mk-orange text-base mt-1 font-tabular"
           aria-label={`Precio: ${formatPrice(item.unitPrice * item.quantity)} pesos`}>
          {formatPrice(item.unitPrice * item.quantity)}
        </p>
      </div>

      <div className="flex flex-col items-end justify-between gap-2 flex-shrink-0">
        <button
          onClick={onRemove}
          className="p-1 text-gray-300 hover:text-mk-error transition-colors"
          aria-label={`Eliminar ${item.name} del carrito`}
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>

        {/* quantity stepper — use spinbutton pattern */}
        <div
          role="group"
          aria-label={`Cantidad de ${item.name}`}
          className="flex items-center gap-1"
        >
          <button
            onClick={() => onUpdateQty(item.quantity - 1)}
            disabled={item.quantity <= 1}
            className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center
                       text-mk-mid hover:border-mk-orange hover:text-mk-orange
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label={`Reducir cantidad de ${item.name}`}
          >
            <Minus className="w-3 h-3" aria-hidden="true" />
          </button>

          <span
            aria-label={`${item.quantity} ${item.quantity === 1 ? 'unidad' : 'unidades'}`}
            className="w-6 text-center font-display font-bold text-sm text-mk-dark"
          >
            {item.quantity}
          </span>

          <button
            onClick={() => onUpdateQty(item.quantity + 1)}
            className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center
                       text-mk-mid hover:border-mk-orange hover:text-mk-orange transition-colors"
            aria-label={`Aumentar cantidad de ${item.name}`}
          >
            <Plus className="w-3 h-3" aria-hidden="true" />
          </button>
        </div>
      </div>
    </li>
  )
}

function EmptyCart({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
      <span className="text-6xl" aria-hidden="true">🛒</span>
      <h3 className="font-display font-bold text-mk-dark text-lg">
        Tu carrito está vacío
      </h3>
      <p className="font-body text-mk-mid text-sm max-w-[220px]">
        ¡Tu mascota está esperando! Explorá nuestros productos y encontrá lo que necesita.
      </p>
      <button onClick={onClose} className="btn-secondary">
        Ver productos
      </button>
    </div>
  )
}
