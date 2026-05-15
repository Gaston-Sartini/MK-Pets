'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { useCartStore } from '@/store/cart-store'
import { useToastStore } from '@/store/toast-store'
import { formatPrice, cn } from '@/lib/utils'
import type { Product, ProductVariant } from '@/types'

const BADGE_LABEL: Record<string, string> = {
  new: 'NUEVO', sale: 'OFERTA', hot: 'MÁS VENDIDO',
}

function ProductCard({ product }: { product: Product }) {
  const [selected, setSelected] = useState<ProductVariant | null>(
    product.variants[0] ?? null
  )
  const { addItem, openDrawer } = useCartStore()
  const { addToast }            = useToastStore()

  const displayPrice = selected?.price ?? product.basePrice

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault()
    addItem({
      productId:    product.id,
      name:         product.name,
      image:        product.images[0] ?? '',
      slug:         product.slug,
      variantLabel: selected?.label,
      unitPrice:    displayPrice,
    })
    addToast({ message: `✓ ${product.name} agregado 🐾`, type: 'success' })
    openDrawer()
  }

  return (
    <div className="product-card group">
      {/* IMAGEN */}
      <Link href={`/producto/${product.slug}`} className="block relative aspect-square bg-mk-light">
        {product.images[0] ? (
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            className="object-contain p-3 transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl opacity-30">🐾</div>
        )}
        {product.badge && (
          <span className={`absolute top-2 left-2 badge-${product.badge}`}>
            {BADGE_LABEL[product.badge]}
          </span>
        )}
      </Link>

      {/* CONTENIDO */}
      <div className="p-3 flex flex-col gap-2">
        <Link href={`/producto/${product.slug}`}>
          <h3 className="font-display font-bold text-sm text-mk-dark leading-tight line-clamp-2
                         hover:text-mk-orange transition-colors">
            {product.name}
          </h3>
        </Link>

        {/* VARIANTES */}
        {product.variants.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {product.variants.map(v => (
              <button
                key={v.id}
                onClick={() => setSelected(v)}
                className={cn(
                  'text-xs px-2 py-0.5 rounded-lg border font-body font-medium transition-colors',
                  selected?.id === v.id
                    ? 'bg-mk-orange text-white border-mk-orange'
                    : 'text-mk-mid border-gray-200 hover:border-mk-orange hover:text-mk-orange'
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}

        <p className="font-display font-black text-xl text-mk-orange">
          {formatPrice(displayPrice)}
        </p>

        <button
          onClick={handleAdd}
          className="w-full py-2 rounded-pill bg-mk-orange text-white
                     font-display font-bold text-sm
                     transition-all duration-200 hover:bg-mk-orange-dark
                     active:scale-95 focus-visible:outline-none
                     focus-visible:ring-2 focus-visible:ring-mk-orange focus-visible:ring-offset-1"
        >
          + Agregar
        </button>
      </div>
    </div>
  )
}

export function ProductGrid({ products }: { products: Product[] }) {
  if (products.length === 0) return null
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5
                    gap-3 sm:gap-4 lg:gap-5">
      {products.map(p => <ProductCard key={p.id} product={p} />)}
    </div>
  )
}
