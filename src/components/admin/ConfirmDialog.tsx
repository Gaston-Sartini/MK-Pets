'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface Ask {
  title: string
  detail?: string
  confirmLabel?: string
  danger?: boolean
}

/**
 * Confirmación propia del panel, en reemplazo del cuadro del navegador
 * (`confirm()`), que no se puede personalizar ni manejar con teclado de forma
 * predecible.
 *
 *   const { confirm, dialog } = useConfirm()
 *   if (await confirm({ title: '¿Cancelar el pedido?', danger: true })) …
 *   return <>{dialog}…</>
 */
export function useConfirm() {
  const [ask, setAsk] = useState<Ask | null>(null)
  const resolver = useRef<((ok: boolean) => void) | null>(null)

  const confirm = useCallback((question: Ask) => {
    setAsk(question)
    return new Promise<boolean>(resolve => { resolver.current = resolve })
  }, [])

  const close = useCallback((ok: boolean) => {
    resolver.current?.(ok)
    resolver.current = null
    setAsk(null)
  }, [])

  useEffect(() => {
    if (!ask) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ask, close])

  const dialog = ask ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40" onClick={() => close(false)}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-sm bg-white rounded-xl shadow-xl p-5"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="font-display font-bold text-lg text-mk-dark">{ask.title}</h2>
        {ask.detail && <p className="mt-2 text-sm text-mk-mid">{ask.detail}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => close(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-mk-dark hover:bg-gray-50">
            No, volver
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => close(true)}
            className={`px-4 py-2 rounded-lg text-sm font-bold text-white ${ask.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-mk-orange hover:bg-mk-orange-dark'}`}
          >
            {ask.confirmLabel ?? 'Sí, confirmar'}
          </button>
        </div>
      </div>
    </div>
  ) : null

  return { confirm, dialog }
}
