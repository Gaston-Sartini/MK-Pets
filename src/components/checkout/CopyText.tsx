'use client'

import { useState } from 'react'

/** Texto destacado que se copia al portapapeles al tocarlo (alias, CBU, etc.). */
export function CopyText({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copiar ${label}: ${value}`}
      className="inline-flex items-center gap-1.5 font-bold text-mk-dark bg-mk-orange-light border border-mk-orange/30
                 rounded-chip px-2 py-0.5 hover:bg-mk-orange/20 transition-colors"
    >
      {value}
      <span className="text-xs font-semibold text-mk-orange-dark" aria-live="polite">
        {copied ? '¡Copiado!' : 'Copiar'}
      </span>
    </button>
  )
}
