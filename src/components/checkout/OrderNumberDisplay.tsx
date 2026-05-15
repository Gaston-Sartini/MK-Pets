'use client'

import { useState } from 'react'

interface Props {
  orderNumber: string
}

export function OrderNumberDisplay({ orderNumber }: Props) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(orderNumber)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <div className="bg-mk-orange-light border border-mk-orange/30 rounded-card p-4 text-center">
      <p className="text-sm text-mk-mid font-medium mb-1">Tu número de pedido</p>
      <p className="font-bold text-2xl text-mk-orange tracking-wider">{orderNumber}</p>
      <p className="text-xs text-mk-mid mt-1 mb-3">Guardalo para consultar o modificar tu pedido</p>
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-mk-orange-dark hover:text-mk-orange transition-colors"
        aria-label="Copiar número de pedido"
      >
        {copied ? (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            ¡Copiado!
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            Copiar código
          </>
        )}
      </button>
    </div>
  )
}
