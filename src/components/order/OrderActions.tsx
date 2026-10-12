'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/store/cart-store'
import { useToastStore } from '@/store/toast-store'

/** Cancelar el pedido propio, mientras todavía se puede modificar. Pide confirmar en el mismo botón. */
export function CancelOrderButton({ orderNumber }: { orderNumber: string }) {
  const router = useRouter()
  const { addToast } = useToastStore()
  const [asking, setAsking]   = useState(false)
  const [working, setWorking] = useState(false)

  async function cancel() {
    setWorking(true)
    try {
      const res = await fetch(`/api/pedidos/${orderNumber}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'No se pudo cancelar el pedido')
      addToast({ type: 'success', message: 'Pedido cancelado' })
      router.refresh()
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'No se pudo cancelar el pedido' })
    } finally {
      setWorking(false)
      setAsking(false)
    }
  }

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className="btn-ghost text-center text-mk-error">
        Cancelar pedido
      </button>
    )
  }

  return (
    <div className="rounded-card border border-red-200 bg-red-50 p-4 text-center" role="alertdialog" aria-label="Confirmar cancelación">
      <p className="text-sm text-red-800 font-semibold mb-3">¿Cancelamos este pedido? No se puede deshacer.</p>
      <div className="flex gap-2 justify-center">
        <button type="button" onClick={cancel} disabled={working} className="px-4 py-2 rounded-pill bg-mk-error text-white text-sm font-bold disabled:opacity-60">
          {working ? 'Cancelando…' : 'Sí, cancelar'}
        </button>
        <button type="button" onClick={() => setAsking(false)} disabled={working} className="px-4 py-2 rounded-pill border border-gray-300 bg-white text-sm font-medium text-mk-dark">
          No, dejarlo
        </button>
      </div>
    </div>
  )
}

export interface ReorderItem {
  productId: string
  name: string
  image: string
  slug: string
  variantLabel: string | null
  unitPrice: number
  quantity: number
}

/** Volver a cargar en el carrito lo mismo de un pedido anterior. Precio y stock se revisan al confirmar. */
export function ReorderButton({ items }: { items: ReorderItem[] }) {
  const { addItem, updateQuantity, openDrawer } = useCartStore()
  const { addToast } = useToastStore()

  function reorder() {
    for (const item of items) {
      const id = `${item.productId}${item.variantLabel ? `-${item.variantLabel}` : ''}`
      const inCart = useCartStore.getState().items.find(i => i.id === id)?.quantity ?? 0
      addItem({
        productId: item.productId, name: item.name, image: item.image, slug: item.slug,
        variantLabel: item.variantLabel ?? undefined, unitPrice: item.unitPrice,
      })
      updateQuantity(id, inCart + item.quantity)
    }
    addToast({ type: 'success', message: 'Sumamos los productos al carrito 🐾' })
    openDrawer()
  }

  return (
    <button type="button" onClick={reorder} className="btn-secondary text-center">
      🔁 Pedir lo mismo otra vez
    </button>
  )
}
