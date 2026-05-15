'use client'

import { useState } from 'react'
import { useCartStore } from '@/store/cart-store'
import { useToastStore } from '@/store/toast-store'
import { formatPrice } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Product, ProductVariant } from '@/types'

interface Props { product: Product }

export function AddToCartButton({ product }: Props) {
  const [selected, setSelected] = useState<ProductVariant | null>(
    product.variants[0] ?? null
  )
  const { addItem, openDrawer } = useCartStore()
  const { addToast }            = useToastStore()

  const displayPrice = selected?.price ?? product.basePrice

  const handleAdd = () => {
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
      <p className="font-display font-black text-4xl text-mk-orange">
        {formatPrice(displayPrice)}
      </p>

      {/* BOTÓN */}
      <button onClick={handleAdd} className="btn-primary w-full text-lg py-4">
        + Agregar al carrito
      </button>
    </div>
  )
}
