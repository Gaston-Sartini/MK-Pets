'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Save } from 'lucide-react'

interface Variant { label: string; price: string; stock: string }

interface FormData {
  name: string; slug: string; description: string
  categoryId: string; basePrice: string; stock: string
  badge: string; isActive: boolean; isFeatured: boolean
  images: string[]
}

interface Props {
  productId?: string
  initial?: Partial<FormData> & { variants?: Variant[] }
}

function generateSlug(name: string) {
  return name.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

const EMPTY: FormData = {
  name: '', slug: '', description: '',
  categoryId: '', basePrice: '', stock: '',
  badge: '', isActive: true, isFeatured: false,
  images: ['', '', '', '', ''],
}

export default function ProductForm({ productId, initial }: Props) {
  const router = useRouter()
  const [form, setForm]         = useState<FormData>({
    ...EMPTY,
    ...(initial ?? {}),
    images: initial?.images?.length
      ? [...initial.images, ...Array(5).fill('')].slice(0, 5)
      : EMPTY.images,
  })
  const [variants, setVariants] = useState<Variant[]>(initial?.variants ?? [])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    fetch('/api/admin/categorias')
      .then(r => r.json())
      .then(setCategories)
      .catch(() => {})
  }, [])

  const setField = (key: keyof FormData, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleNameChange = (name: string) =>
    setForm(prev => ({ ...prev, name, slug: generateSlug(name) }))

  const setImage = (i: number, value: string) => {
    const imgs = [...form.images]
    imgs[i] = value
    setField('images', imgs)
  }

  const addVariant    = () => setVariants(v => [...v, { label: '', price: '', stock: '' }])
  const removeVariant = (i: number) => setVariants(v => v.filter((_, idx) => idx !== i))
  const setVariant    = (i: number, key: keyof Variant, value: string) =>
    setVariants(v => v.map((vv, idx) => idx === i ? { ...vv, [key]: value } : vv))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const url    = productId ? `/api/admin/productos/${productId}` : '/api/admin/productos'
    const method = productId ? 'PUT' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          images:   form.images.filter(Boolean),
          variants: variants.filter(v => v.label && v.price),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Error al guardar')
        return
      }

      router.push('/admin/productos')
      router.refresh()
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!productId) return
    if (!confirm('¿Eliminar este producto? Esta acción no se puede deshacer.')) return

    const res = await fetch(`/api/admin/productos/${productId}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/admin/productos')
      router.refresh()
    } else {
      const data = await res.json()
      setError(data.error ?? 'Error al eliminar')
    }
  }

  const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mk-orange focus:border-transparent'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* BASIC INFO */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-display font-bold text-base text-mk-dark mb-4">Información básica</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Nombre *</label>
            <input type="text" required value={form.name}
              onChange={e => handleNameChange(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Slug (URL)</label>
            <input type="text" required value={form.slug}
              onChange={e => setField('slug', e.target.value)} className={inputClass} />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Descripción</label>
            <textarea rows={3} value={form.description}
              onChange={e => setField('description', e.target.value)}
              className={inputClass} />
          </div>
        </div>
      </div>

      {/* PRICING & STOCK */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-display font-bold text-base text-mk-dark mb-4">Precio y stock</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Precio base (ARS) *</label>
            <input type="number" required min="0" step="0.01" value={form.basePrice}
              onChange={e => setField('basePrice', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Stock *</label>
            <input type="number" required min="0" value={form.stock}
              onChange={e => setField('stock', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Categoría *</label>
            <select required value={form.categoryId}
              onChange={e => setField('categoryId', e.target.value)} className={inputClass}>
              <option value="">Seleccioná una categoría</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* VARIANTS */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-base text-mk-dark">Variantes (opcional)</h2>
          <button type="button" onClick={addVariant}
            className="flex items-center gap-1.5 text-sm text-mk-orange font-medium hover:text-mk-orange-dark">
            <Plus className="w-4 h-4" /> Agregar variante
          </button>
        </div>
        {variants.length === 0 ? (
          <p className="text-mk-mid text-sm">Sin variantes. El producto se vende con el precio base.</p>
        ) : (
          <div className="space-y-3">
            {variants.map((v, i) => (
              <div key={i} className="grid grid-cols-3 gap-3 items-end">
                <div>
                  {i === 0 && <label className={labelClass}>Etiqueta</label>}
                  <input type="text" placeholder="ej: 1kg" value={v.label}
                    onChange={e => setVariant(i, 'label', e.target.value)} className={inputClass} />
                </div>
                <div>
                  {i === 0 && <label className={labelClass}>Precio (ARS)</label>}
                  <input type="number" min="0" step="0.01" placeholder="0" value={v.price}
                    onChange={e => setVariant(i, 'price', e.target.value)} className={inputClass} />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    {i === 0 && <label className={labelClass}>Stock</label>}
                    <input type="number" min="0" placeholder="0" value={v.stock}
                      onChange={e => setVariant(i, 'stock', e.target.value)} className={inputClass} />
                  </div>
                  <button type="button" onClick={() => removeVariant(i)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors mb-0.5">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* IMAGES */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-display font-bold text-base text-mk-dark mb-4">Imágenes (URLs)</h2>
        <div className="space-y-2">
          {form.images.map((url, i) => (
            <div key={i} className="flex items-center gap-3">
              {url
                ? <img src={url} alt="" className="w-10 h-10 object-cover rounded border" onError={e => (e.currentTarget.style.display='none')} />
                : <div className="w-10 h-10 rounded border border-dashed border-gray-300 bg-gray-50" />
              }
              <input type="url" value={url} placeholder={`URL imagen ${i + 1}`}
                onChange={e => setImage(i, e.target.value)}
                className={`${inputClass} flex-1`} />
            </div>
          ))}
        </div>
        <p className="text-xs text-mk-mid mt-2">Copiá la URL pública desde Supabase Storage.</p>
      </div>

      {/* FLAGS */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-display font-bold text-base text-mk-dark mb-4">Configuración</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Badge / etiqueta</label>
            <select value={form.badge} onChange={e => setField('badge', e.target.value)} className={inputClass}>
              <option value="">Sin badge</option>
              <option value="new">NUEVO</option>
              <option value="sale">OFERTA</option>
              <option value="hot">MÁS VENDIDO</option>
            </select>
          </div>
          <div className="flex items-end gap-6 pb-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isFeatured}
                onChange={e => setField('isFeatured', e.target.checked)}
                className="w-4 h-4 accent-mk-orange rounded" />
              <span className="text-sm font-medium text-gray-700">Destacado (home)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isActive}
                onChange={e => setField('isActive', e.target.checked)}
                className="w-4 h-4 accent-mk-orange rounded" />
              <span className="text-sm font-medium text-gray-700">Activo (visible)</span>
            </label>
          </div>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 bg-mk-orange hover:bg-mk-orange-dark text-white font-bold px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50">
            <Save className="w-4 h-4" />
            {loading ? 'Guardando...' : productId ? 'Guardar cambios' : 'Crear producto'}
          </button>
          <button type="button" onClick={() => router.push('/admin/productos')}
            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
            Cancelar
          </button>
        </div>
        {productId && (
          <button type="button" onClick={handleDelete}
            className="flex items-center gap-2 text-red-600 hover:bg-red-50 px-4 py-2.5 rounded-lg transition-colors text-sm font-medium">
            <Trash2 className="w-4 h-4" />
            Eliminar producto
          </button>
        )}
      </div>
    </form>
  )
}
