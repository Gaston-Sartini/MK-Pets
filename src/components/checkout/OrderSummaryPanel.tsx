'use client'

import Image from 'next/image'
import { formatPrice } from '@/lib/utils'
import type { CartItem } from '@/store/cart-store'

interface Props {
  items: CartItem[]
  total: number
}

export function OrderSummaryPanel({ items, total }: Props) {
  return (
    <div className="bg-white rounded-card shadow-card p-5">
      <h3 className="font-bold text-mk-dark mb-4">Tu pedido</h3>

      <ul className="space-y-3 mb-4">
        {items.map(item => (
          <li key={item.id} className="flex gap-3 items-start">
            <div className="relative w-14 h-14 rounded-chip overflow-hidden flex-shrink-0 bg-mk-light">
              {item.image ? (
                <Image
                  src={item.image}
                  alt={item.name}
                  fill
                  className="object-cover"
                  sizes="56px"
                />
              ) : (
                <span className="flex items-center justify-center w-full h-full text-2xl">🐾</span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-mk-dark leading-tight line-clamp-2">{item.name}</p>
              {item.variantLabel && (
                <p className="text-xs text-mk-mid mt-0.5">{item.variantLabel}</p>
              )}
              <p className="text-xs text-mk-mid mt-0.5">x{item.quantity}</p>
            </div>

            <p className="font-bold text-sm text-mk-dark flex-shrink-0">
              ${formatPrice(item.unitPrice * item.quantity)}
            </p>
          </li>
        ))}
      </ul>

      <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
        <span className="font-semibold text-mk-dark">Total</span>
        <span className="font-bold text-xl text-mk-orange">${formatPrice(total)}</span>
      </div>

      <div className="mt-4 flex flex-col gap-1.5">
        {[
          { icon: '🚚', text: 'Envío a CABA' },
          { icon: '🔒', text: 'Compra 100% segura' },
        ].map(b => (
          <div key={b.text} className="trust-badge">
            <span>{b.icon}</span>
            <span className="text-xs font-medium text-mk-mid">{b.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
