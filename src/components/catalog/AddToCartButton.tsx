'use client'

import { useState } from 'react'
import { useCartStore } from '@/store/cart-store'
import { useToastStore } from '@/store/toast-store'
import { cn } from '@/lib/utils'
import { PriceDisplay } from './PriceDisplay'
import type { Product, ProductVariant } from '@/types'

interface Props { product: Product }

export function AddToCartButton({ product }: Props) {
  const [selected, setSelected] = useState<ProductVariant | null>(
    product.variants[0] ?? null
  )
  const { addItem, openDrawer } = useCartStore()
  const { addToast }            = useToastStore()

  // Con variantes, el stock que vale es el de la variante elegida
  const stock           = selected ? selected.stock : product.stock
  const displayPrice    = selected?.price         ?? product.basePrice
  const displayOriginal = selected?.originalPrice ?? product.originalPrice

  const handleAdd = () => {
    if (stock <= 0) return
    addItem({
      productId:    product.id,
      name:         product.name,
      image:        product.images[0] ?? '/placeholder-product.png',
      slug:         product.slug,
      variantLabel: selected?.label,
      unitPrice:    displayPrice,
    })
    addToast({ message: `✓ ${product.name} agregado al carrito`, type: 'success' })
    openDrawer()
  }

  return (
    <div className="flex flex-col gap-3">
      {/* SELECTOR DE VARIANTE */}
      {product.variants.length > 1 && (
        <div>
          <p className="text-xs font-body font-medium text-mk-mid uppercase tracking-wide mb-2">
            Variante
          </p>
          <div className="flex flex-wrap gap-2">
            {product.variants.map(v => (
              <button
                key={v.id}
                onClick={() => setSelected(v)}
                aria-label={`${product.name}, ${v.label}`}
                aria-pressed={selected?.id === v.id}
                className={cn(
                  'px-3 py-1.5 rounded-chip text-sm font-body font-medium border-2',
                  'transition-all duration-150',
                  selected?.id === v.id
                    ? 'border-mk-orange bg-mk-orange text-white'
                    : 'border-gray-200 text-mk-mid hover:border-mk-orange hover:text-mk-orange'
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* PRECIO */}
      <PriceDisplay currentPrice={displayPrice} originalPrice={displayOriginal} size="lg" />

      {/* BOTÓN */}
      {stock > 0 && stock <= 3 && (
        <p className="text-sm font-body font-medium text-mk-error -mt-1">
          {stock === 1 ? 'Queda 1 unidad' : `Quedan ${stock} unidades`}
        </p>
      )}

      <button
        onClick={handleAdd}
        disabled={stock <= 0}
        className="btn-primary w-full text-lg py-4 disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        {stock <= 0 ? 'Sin stock por ahora' : '+ Agregar al carrito'}
      </button>
    </div>
  )
}
