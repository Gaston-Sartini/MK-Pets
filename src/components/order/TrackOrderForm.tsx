'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getCachedOrderNumber } from '@/lib/order-cache'

/** Acepta el número como lo pegue la persona: con espacios, en minúscula o sin el "MKP-". */
export function normalizeOrderNumber(raw: string): string | null {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9-]/g, '')
  const match = clean.match(/^(?:MKP-?)?(\d{8})-?([A-Z0-9]{6,12})$/)
  return match ? `MKP-${match[1]}-${match[2]}` : null
}

export function TrackOrderForm() {
  const router = useRouter()
  const [value, setValue]   = useState('')
  const [error, setError]   = useState<string | null>(null)
  const [busy, setBusy]     = useState(false)
  const [last, setLast]     = useState<string | null>(null)

  // El último pedido hecho desde este dispositivo
  useEffect(() => { setLast(getCachedOrderNumber()) }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const orderNumber = normalizeOrderNumber(value)
    if (!orderNumber) {
      setError('Ese número no parece de un pedido. Empieza con MKP- y lo encontrás en el WhatsApp que te mandamos.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/pedidos/${orderNumber}`)
      if (res.status === 404) { setError('No encontramos un pedido con ese número. Revisá que esté completo.'); return }
      if (res.status === 429) { setError('Probaste muchas veces seguidas. Esperá unos minutos.'); return }
      if (!res.ok) { setError('No pudimos buscarlo ahora. Probá de nuevo en un rato.'); return }
      router.push(`/pedido/${orderNumber}`)
    } catch {
      setError('No pudimos buscarlo ahora. Probá de nuevo en un rato.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <form onSubmit={submit} noValidate>
        <label htmlFor="orderNumber" className="block text-sm font-semibold text-mk-dark mb-1">Número de pedido</label>
        <input
          id="orderNumber"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          placeholder="MKP-20261012-ABCD1234"
          value={value}
          onChange={e => setValue(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? 'err-orderNumber' : undefined}
          className={['input-field', error ? 'border-mk-error ring-1 ring-mk-error' : ''].join(' ')}
        />
        {error && <p id="err-orderNumber" role="alert" className="mt-1 text-xs text-mk-error">{error}</p>}
        <button type="submit" disabled={busy || !value.trim()} className="btn-primary w-full mt-4 disabled:opacity-60">
          {busy ? 'Buscando…' : 'Ver mi pedido'}
        </button>
      </form>

      {last && (
        <p className="mt-5 text-sm text-mk-mid text-center">
          Tu último pedido desde este dispositivo:{' '}
          <Link href={`/pedido/${last}`} className="font-semibold text-mk-orange hover:underline">{last}</Link>
        </p>
      )}
    </div>
  )
}
