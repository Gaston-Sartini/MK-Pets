'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Save, Upload, Loader2, X } from 'lucide-react'
import { useConfirm } from '@/components/admin/ConfirmDialog'

interface Variant { label: string; price: string; originalPrice: string; stock: string }

interface FormData {
  name: string; slug: string; description: string
  categoryId: string; basePrice: string; originalPrice: string; stock: string
  badge: string; isActive: boolean; isFeatured: boolean
  images: string[]
}

interface Props {
  productId?: string
  initial?: Partial<FormData> & { variants?: Variant[] }
}

const MAX_IMAGES = 5

function generateSlug(name: string) {
  return name.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

const EMPTY: FormData = {
  name: '', slug: '', description: '',
  categoryId: '', basePrice: '', originalPrice: '', stock: '',
  badge: '', isActive: true, isFeatured: false,
  images: [],
}

/**
 * Extract the storage path from a Supabase public URL.
 * Returns null if the URL isn't a Supabase storage URL we own.
 * Example URL:
 *   https://<ref>.supabase.co/storage/v1/object/public/products/2026-05/uuid.jpg
 *   → "2026-05/uuid.jpg"
 */
function extractStoragePath(url: string): string | null {
  const marker = '/storage/v1/object/public/products/'
  const i = url.indexOf(marker)
  if (i === -1) return null
  return url.slice(i + marker.length)
}

export default function ProductForm({ productId, initial }: Props) {
  const router = useRouter()
  const { confirm, dialog } = useConfirm()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<FormData>({
    ...EMPTY,
    ...(initial ?? {}),
    images: (initial?.images ?? []).filter(Boolean).slice(0, MAX_IMAGES),
  })
  const [variants, setVariants]     = useState<Variant[]>(initial?.variants ?? [])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading]       = useState(false)
  const [uploading, setUploading]   = useState(false)
  const [error, setError]           = useState('')

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

  /** Upload one or more files. Stops if image limit is reached. */
  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setError('')

    const remaining = MAX_IMAGES - form.images.length
    if (remaining <= 0) {
      setError(`Máximo ${MAX_IMAGES} imágenes por producto.`)
      return
    }

    const toUpload = Array.from(files).slice(0, remaining)
    setUploading(true)

    try {
      const uploaded: string[] = []
      for (const file of toUpload) {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error ?? `Error al subir ${file.name}`)
        }
        const data = await res.json()
        uploaded.push(data.url)
      }
      setForm(prev => ({ ...prev, images: [...prev.images, ...uploaded] }))
    } catch (err: any) {
      setError(err.message ?? 'Error al subir la imagen')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  /** Remove an image, and best-effort delete from storage if it's one of ours. */
  const removeImage = async (index: number) => {
    const url = form.images[index]
    setForm(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }))

    const path = extractStoragePath(url)
    if (path) {
      // Fire and forget — UI is already updated. If it fails we just leave
      // an orphan file in the bucket; the user can clean up later.
      fetch('/api/admin/upload', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ path }),
      }).catch(() => {})
    }
  }

  const addVariant    = () => setVariants(v => [...v, { label: '', price: '', originalPrice: '', stock: '' }])
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
          // Empty string → null so the DB stores NULL instead of trying to parse "" as a number
          originalPrice: form.originalPrice.trim() === '' ? null : form.originalPrice,
          images:   form.images.filter(Boolean),
          variants: variants
            .filter(v => v.label && v.price)
            .map(v => ({
              ...v,
              originalPrice: v.originalPrice.trim() === '' ? null : v.originalPrice,
            })),
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
    if (!(await confirm({
      title: '¿Eliminar este producto?',
      detail: 'Se borra con sus fotos y no se puede deshacer. Si tiene pedidos, conviene desactivarlo.',
      confirmLabel: 'Sí, eliminar',
      danger: true,
    }))) return

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

  const canAddMore = form.images.length < MAX_IMAGES

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {dialog}
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
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Precio actual (ARS) *</label>
            <input type="number" required min="0" step="0.01" value={form.basePrice}
              onChange={e => setField('basePrice', e.target.value)} className={inputClass} />
            <p className="text-xs text-mk-mid mt-1">Es el precio que el cliente paga.</p>
          </div>
          <div>
            <label className={labelClass}>Precio antes (opcional, para tachado)</label>
            <input type="number" min="0" step="0.01" value={form.originalPrice}
              placeholder="Dejá vacío si no está en promo"
              onChange={e => setField('originalPrice', e.target.value)} className={inputClass} />
            <p className="text-xs text-mk-mid mt-1">
              Si lo llenás, aparece tachado al lado del precio actual y se muestra el % off.
            </p>
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
              <div key={i} className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
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
                <div>
                  {i === 0 && <label className={labelClass}>Precio antes</label>}
                  <input type="number" min="0" step="0.01" placeholder="—" value={v.originalPrice}
                    onChange={e => setVariant(i, 'originalPrice', e.target.value)} className={inputClass} />
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-base text-mk-dark">
            Imágenes
            <span className="ml-2 text-xs font-body font-normal text-mk-mid">
              ({form.images.length} / {MAX_IMAGES})
            </span>
          </h2>
        </div>

        {/* PREVIEW GRID */}
        {form.images.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-4">
            {form.images.map((url, i) => (
              <div key={url + i} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Imagen ${i + 1}`}
                  className="w-full h-full object-cover"
                  onError={e => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 p-1 bg-white/95 hover:bg-red-500 hover:text-white text-red-600 rounded-full shadow-sm transition-colors"
                  aria-label={`Eliminar imagen ${i + 1}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                {i === 0 && (
                  <span className="absolute bottom-1 left-1 bg-mk-orange text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                    Principal
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* UPLOAD BUTTON */}
        {canAddMore && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              multiple
              className="hidden"
              onChange={e => handleUpload(e.target.files)}
              disabled={uploading}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full flex flex-col items-center justify-center gap-2 py-8 border-2 border-dashed border-gray-300 hover:border-mk-orange hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-6 h-6 text-mk-orange animate-spin" />
                  <span className="text-sm text-mk-mid">Subiendo...</span>
                </>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-mk-mid" />
                  <span className="text-sm font-medium text-mk-dark">
                    Hacé clic para subir imágenes
                  </span>
                  <span className="text-xs text-mk-mid">
                    JPG, PNG, WebP — máx. 5 MB cada una
                  </span>
                </>
              )}
            </button>
          </div>
        )}

        {!canAddMore && (
          <p className="text-xs text-mk-mid text-center py-2">
            Llegaste al límite de {MAX_IMAGES} imágenes. Eliminá alguna para subir otra.
          </p>
        )}

        <p className="text-xs text-mk-mid mt-3">
          La primera imagen es la principal y se muestra en el catálogo. Las imágenes se guardan en Supabase Storage.
        </p>
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
          <button type="submit" disabled={loading || uploading}
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
