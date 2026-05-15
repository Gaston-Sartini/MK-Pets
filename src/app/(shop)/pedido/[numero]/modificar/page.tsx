'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { formatPrice, canModifyOrder } from '@/lib/utils'
import { useToastStore } from '@/store/toast-store'

interface OrderItem {
  id:           string
  quantity:     number
  unitPrice:    number
  variantLabel: string | null
  product: {
    id:     string
    name:   string
    images: string[]
    slug:   string
  }
}

interface OrderData {
  orderNumber:    string
  status:         string
  canModifyUntil: string
  canModify:      boolean
  total:          number
  items:          OrderItem[]
}

export default function ModifyOrderPage() {
  const params   = useParams<{ numero: string }>()
  const router   = useRouter()
  const { addToast } = useToastStore()

  const [order, setOrder]         = useState<OrderData | null>(null)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving]   = useState(false)

  useEffect(() => {
    fetch(`/api/pedidos/${params.numero}`)
      .then(r => r.json())
      .then((data: OrderData) => {
        if (!data.canModify) {
          router.replace(`/pedido/${params.numero}`)
          return
        }
        setOrder(data)
        const initial: Record<string, number> = {}
        data.items.forEach(i => { initial[i.id] = i.quantity })
        setQuantities(initial)
      })
      .catch(() => router.replace(`/pedido/${params.numero}`))
      .finally(() => setIsLoading(false))
  }, [params.numero, router])

  function changeQty(itemId: string, delta: number) {
    setQuantities(prev => {
      const next = (prev[itemId] ?? 1) + delta
      if (next < 0) return prev
      return { ...prev, [itemId]: next }
    })
  }

  async function handleSave() {
    if (!order) return

    const activeItems = order.items.filter(i => (quantities[i.id] ?? 0) > 0)
    if (activeItems.length === 0) {
      addToast({ type: 'error', message: 'El pedido debe tener al menos un producto' })
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch(`/api/pedidos/${params.numero}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: activeItems.map(i => ({
            id:       i.id,
            quantity: quantities[i.id],
          })),
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'No se pudo guardar el pedido')
      }

      addToast({ type: 'success', message: '¡Pedido actualizado! 🐾' })
      router.push(`/pedido/${params.numero}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado'
      addToast({ type: 'error', message: msg })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-mk-light flex items-center justify-center">
        <div className="animate-pulse text-mk-orange text-4xl">🐾</div>
      </main>
    )
  }

  if (!order) return null

  const newTotal = order.items.reduce(
    (sum, i) => sum + i.unitPrice * (quantities[i.id] ?? 0),
    0
  )

  return (
    <main className="min-h-screen bg-mk-light py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Link
          href={`/pedido/${params.numero}`}
          className="inline-flex items-center gap-1 text-sm text-mk-mid hover:text-mk-orange mb-6 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver al pedido
        </Link>

        <h1 className="text-2xl font-bold text-mk-dark mb-2">Modificar pedido</h1>
        <p className="text-sm text-mk-mid mb-6">
          Podés ajustar las cantidades. Los productos con cantidad 0 se eliminan del pedido.
        </p>

        <div className="bg-white rounded-card shadow-card p-5 space-y-4">
          {order.items.map(item => {
            const qty = quantities[item.id] ?? 0
            return (
              <div key={item.id} className="flex gap-3 items-center">
                <div className="relative w-14 h-14 rounded-chip overflow-hidden bg-mk-light flex-shrink-0">
                  {item.product.images?.[0] ? (
                    <Image
                      src={item.product.images[0]}
                      alt={item.product.name}
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  ) : (
                    <span className="flex items-center justify-center w-full h-full text-xl">🐾</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-mk-dark line-clamp-2">{item.product.name}</p>
                  {item.variantLabel && (
                    <p className="text-xs text-mk-mid">{item.variantLabel}</p>
                  )}
                  <p className="text-xs text-mk-mid">${formatPrice(item.unitPrice)} c/u</p>
                </div>

                {/* Quantity control */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => changeQty(item.id, -1)}
                    className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:border-mk-orange hover:text-mk-orange transition-colors text-lg font-bold"
                    aria-label="Disminuir cantidad"
                  >
                    −
                  </button>
                  <span className={['w-6 text-center font-bold text-sm', qty === 0 ? 'text-mk-error' : 'text-mk-dark'].join(' ')}>
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => changeQty(item.id, +1)}
                    className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:border-mk-orange hover:text-mk-orange transition-colors text-lg font-bold"
                    aria-label="Aumentar cantidad"
                  >
                    +
                  </button>
                </div>

                <p className="font-bold text-sm text-mk-dark w-20 text-right flex-shrink-0">
                  ${formatPrice(item.unitPrice * qty)}
                </p>
              </div>
            )
          })}
        </div>

        {/* New total */}
        <div className="mt-4 bg-mk-orange-light border border-mk-orange/20 rounded-card px-5 py-3 flex justify-between items-center">
          <span className="font-semibold text-mk-dark">Nuevo total</span>
          <span className="font-bold text-xl text-mk-orange">${formatPrice(newTotal)}</span>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Guardando...' : 'Guardar cambios 🐾'}
          </button>
          <Link href={`/pedido/${params.numero}`} className="btn-ghost text-center">
            Cancelar
          </Link>
        </div>
      </div>
    </main>
  )
}
