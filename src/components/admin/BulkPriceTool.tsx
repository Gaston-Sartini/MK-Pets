'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatPrice } from '@/lib/utils'
import { ROUND_OPTIONS, matchesPriceFilter, priceChanges, type PricedProduct, type RoundTo } from '@/lib/pricing'
import { useConfirm } from '@/components/admin/ConfirmDialog'

interface Props {
  products: PricedProduct[]
  categories: { id: string; name: string; emoji: string | null }[]
}

export function BulkPriceTool({ products, categories }: Props) {
  const router = useRouter()
  const { confirm, dialog } = useConfirm()
  const [categoryId, setCategoryId] = useState('')
  const [text, setText]             = useState('')
  const [percentText, setPercent]   = useState('10')
  const [roundTo, setRoundTo]       = useState<RoundTo>(100)
  const [saving, setSaving]         = useState(false)
  const [message, setMessage]       = useState<{ ok: boolean; text: string } | null>(null)

  const percent = Number(percentText.replace(',', '.'))
  const valid   = Number.isFinite(percent) && percent !== 0 && percent >= -90 && percent <= 500

  const changes = useMemo(
    () => (valid ? priceChanges(products.filter(p => matchesPriceFilter(p, categoryId, text)), percent, roundTo) : []),
    [products, categoryId, text, percent, roundTo, valid],
  )

  async function apply() {
    if (!valid || changes.length === 0) return
    const scope = `${changes.length} ${changes.length === 1 ? 'precio' : 'precios'}`
    if (!(await confirm({
      title: `¿${percent > 0 ? 'Subir' : 'Bajar'} ${scope} un ${Math.abs(percent)} %?`,
      detail: 'Se aplica ahora en la tienda. Para volver atrás hay que hacer el cambio inverso.',
      confirmLabel: 'Sí, aplicar',
      danger: percent < 0,
    }))) return

    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/precios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId, text, percent, roundTo, expected: changes.length }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'No se pudieron actualizar los precios')
      setMessage({ ok: true, text: `Listo: se actualizaron ${data.updated} precios.` })
      router.refresh()
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'No se pudieron actualizar los precios' })
    } finally {
      setSaving(false)
    }
  }

  const field = 'w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-mk-orange/40 focus:border-mk-orange'

  return (
    <div>
      {dialog}

      <div className="bg-white rounded-xl border border-gray-200 p-5 grid gap-4 md:grid-cols-4">
        <div>
          <label htmlFor="bp-cat" className="block text-xs font-semibold text-gray-600 mb-1">Categoría</label>
          <select id="bp-cat" value={categoryId} onChange={e => setCategoryId(e.target.value)} className={field}>
            <option value="">Todas</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="bp-text" className="block text-xs font-semibold text-gray-600 mb-1">Marca o nombre (opcional)</label>
          <input id="bp-text" value={text} onChange={e => setText(e.target.value)} placeholder="ej: purina" className={field} />
        </div>
        <div>
          <label htmlFor="bp-pct" className="block text-xs font-semibold text-gray-600 mb-1">Porcentaje</label>
          <input
            id="bp-pct" inputMode="decimal" value={percentText} onChange={e => setPercent(e.target.value)}
            aria-invalid={!valid} aria-describedby="bp-pct-hint" className={`${field} ${valid ? '' : 'border-red-400'}`}
          />
          <p id="bp-pct-hint" className="mt-1 text-xs text-mk-mid">Positivo sube, negativo baja. Ej: 12 o -5</p>
        </div>
        <div>
          <label htmlFor="bp-round" className="block text-xs font-semibold text-gray-600 mb-1">Redondear a</label>
          <select id="bp-round" value={roundTo} onChange={e => setRoundTo(Number(e.target.value) as RoundTo)} className={field}>
            {ROUND_OPTIONS.map(r => <option key={r} value={r}>{r === 1 ? 'Sin redondear' : `múltiplos de $${r}`}</option>)}
          </select>
        </div>
      </div>

      {message && (
        <div role={message.ok ? 'status' : 'alert'} className={`mt-4 px-4 py-3 rounded-lg text-sm border ${message.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-4">
        <p className="text-sm text-mk-mid">
          {!valid ? 'Escribí un porcentaje distinto de 0.' : changes.length === 0 ? 'Ningún producto coincide con ese filtro.' : `Vista previa: ${changes.length} ${changes.length === 1 ? 'precio cambia' : 'precios cambian'}.`}
        </p>
        <button
          type="button" onClick={apply} disabled={!valid || changes.length === 0 || saving}
          className="bg-mk-orange hover:bg-mk-orange-dark text-white font-bold px-5 py-2.5 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Aplicando…' : 'Aplicar a la tienda'}
        </button>
      </div>

      {changes.length > 0 && (
        <div className="mt-3 bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Producto</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Hoy</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Queda en</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {changes.map(c => (
                <tr key={`${c.productId}:${c.variantLabel ?? ''}`} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-2.5 text-mk-dark">
                    {c.name}{c.variantLabel && <span className="text-mk-mid"> · {c.variantLabel}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right text-mk-mid">{formatPrice(c.before)}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-mk-dark">{formatPrice(c.after)}</td>
                  <td className={`px-4 py-2.5 text-right text-xs font-semibold ${c.after >= c.before ? 'text-green-700' : 'text-red-700'}`}>
                    {c.after >= c.before ? '+' : '−'}{formatPrice(Math.abs(c.after - c.before))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
