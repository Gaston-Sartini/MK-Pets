'use client'

import { useRef, useState } from 'react'
import { HeroBanner } from '@/components/layout/HeroBanner'
import { useConfirm } from '@/components/admin/ConfirmDialog'
import { autoHeroDescription, DEFAULT_HERO, type HeroContent } from '@/lib/site-content'

const MAX_BADGES = 6

const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mk-orange'
const label = 'block text-sm font-semibold text-gray-700 mb-1'
const hint  = 'text-xs text-gray-500 mt-1'

/** Ancho y alto reales de la foto, para que la portada le reserve el lugar justo y no "salte". */
function imageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload  = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url) }
    img.onerror = () => { reject(new Error('No se pudo leer la imagen')); URL.revokeObjectURL(url) }
    img.src = url
  })
}

export function HeroEditor({ initial, offer }: { initial: HeroContent; offer: string }) {
  const [form, setForm]           = useState<HeroContent>(initial)
  const [saved, setSaved]         = useState<HeroContent>(initial)
  const [saving, setSaving]       = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState('')
  const [notice, setNotice]       = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const { confirm, dialog } = useConfirm()

  const dirty = JSON.stringify(form) !== JSON.stringify(saved)
  const set = <K extends keyof HeroContent>(key: K, value: HeroContent[K]) => {
    setNotice('')
    setForm(prev => ({ ...prev, [key]: value }))
  }
  const setBadge = (i: number, field: 'icon' | 'text', value: string) =>
    set('badges', form.badges.map((b, j) => (j === i ? { ...b, [field]: value } : b)))

  async function upload(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    setError('')
    setUploading(true)
    try {
      const size = await imageSize(file)
      if (size.width < 400) throw new Error(`La imagen es muy chica (${size.width} px de ancho). Usá una de 800 px o más.`)
      const fd = new FormData()
      fd.append('file', file)
      const res  = await fetch('/api/admin/upload', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'No se pudo subir la imagen')
      set('image', { url: data.url, ...size })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir la imagen')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function save() {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const res  = await fetch('/api/admin/portada', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'No se pudo guardar')
      setSaved(form)
      setNotice('Listo: la portada ya se ve así en la tienda.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  async function restoreDefaults() {
    const ok = await confirm({
      title:        '¿Volver a la portada original?',
      detail:       'Se cargan los textos y la imagen de fábrica en el formulario. No se publica hasta que toques "Guardar".',
      confirmLabel: 'Cargar la original',
    })
    if (ok) setForm(DEFAULT_HERO)
  }

  return (
    <div>
      {dialog}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* TEXTOS */}
        <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-display font-bold text-base text-mk-dark">Textos</h2>

          <div>
            <label className={label} htmlFor="hero-tagline">Frase de arriba (naranja, en mayúsculas)</label>
            <input id="hero-tagline" className={input} value={form.tagline} maxLength={80}
                   onChange={e => set('tagline', e.target.value)} />
          </div>

          <div>
            <label className={label} htmlFor="hero-title">Título grande</label>
            <textarea id="hero-title" className={input} rows={2} value={form.title} maxLength={80}
                      onChange={e => set('title', e.target.value)} />
            <p className={hint}>Cada renglón que escribas es un renglón en la portada (hasta 3).</p>
          </div>

          <div>
            <label className={label} htmlFor="hero-highlight">Debajo del título (naranja)</label>
            <input id="hero-highlight" className={input} value={form.highlight} maxLength={60}
                   onChange={e => set('highlight', e.target.value)} />
            <p className={hint}>Si lo dejás vacío, no se muestra.</p>
          </div>

          <div>
            <label className={label} htmlFor="hero-description">Descripción</label>
            <textarea id="hero-description" className={input} rows={3} value={form.description} maxLength={220}
                      placeholder={autoHeroDescription(offer)}
                      onChange={e => set('description', e.target.value)} />
            <p className={hint}>
              Si la dejás vacía se arma sola con las categorías que tienen productos (hoy diría lo que ves en gris).
            </p>
          </div>
        </section>

        {/* IMAGEN Y GARANTÍAS */}
        <div className="space-y-6">
          <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="font-display font-bold text-base text-mk-dark">Imagen</h2>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                      className="px-4 py-2 rounded-lg bg-mk-orange text-white text-sm font-bold disabled:opacity-60">
                {uploading ? 'Subiendo…' : 'Cambiar imagen'}
              </button>
              {form.image && (
                <button type="button" onClick={() => set('image', null)}
                        className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium">
                  Usar la imagen original
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden"
                     onChange={e => upload(e.target.files)} />
            </div>
            <p className={hint}>JPG, PNG o WebP de hasta 5 MB. Ideal: horizontal, de 1200 px de ancho o más.</p>
            <div>
              <label className={label} htmlFor="hero-alt">Qué muestra la imagen</label>
              <input id="hero-alt" className={input} value={form.imageAlt} maxLength={150}
                     onChange={e => set('imageAlt', e.target.value)} />
              <p className={hint}>No se ve en la portada: lo leen Google y las personas que usan lector de pantalla.</p>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h2 className="font-display font-bold text-base text-mk-dark">Garantías (debajo de los botones)</h2>
            {form.badges.map((badge, i) => (
              <div key={i} className="flex gap-2">
                <input aria-label={`Emoji de la garantía ${i + 1}`} className="w-16 shrink-0 border border-gray-300 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-mk-orange" value={badge.icon} maxLength={8}
                       onChange={e => setBadge(i, 'icon', e.target.value)} />
                <input aria-label={`Texto de la garantía ${i + 1}`} className={input} value={badge.text} maxLength={40}
                       onChange={e => setBadge(i, 'text', e.target.value)} />
                <button type="button" onClick={() => set('badges', form.badges.filter((_, j) => j !== i))}
                        aria-label={`Sacar la garantía ${i + 1}`}
                        className="px-3 rounded-lg border border-gray-300 text-gray-500 hover:text-mk-error">✕</button>
              </div>
            ))}
            {form.badges.length < MAX_BADGES && (
              <button type="button" onClick={() => set('badges', [...form.badges, { icon: '✅', text: '' }])}
                      className="text-sm font-semibold text-mk-orange">+ Agregar garantía</button>
            )}
          </section>
        </div>
      </div>

      {/* ACCIONES */}
      <div className="sticky bottom-0 z-10 mt-6 -mx-4 md:mx-0 px-4 py-3 bg-gray-50/95 border-t border-gray-200 flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={saving || !dirty}
                className="px-5 py-2.5 rounded-lg bg-mk-orange text-white font-bold disabled:opacity-50">
          {saving ? 'Guardando…' : 'Guardar y publicar'}
        </button>
        {dirty && (
          <button type="button" onClick={() => { setForm(saved); setError('') }}
                  className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium">Descartar cambios</button>
        )}
        <button type="button" onClick={restoreDefaults} className="text-sm text-gray-500 underline ml-auto">
          Volver a la portada original
        </button>
        {error  && <p role="alert"  className="w-full text-sm text-mk-error">{error}</p>}
        {notice && <p role="status" className="w-full text-sm text-green-700">{notice}</p>}
        {dirty && !error && <p className="w-full text-xs text-gray-500">Hay cambios sin guardar: la tienda todavía muestra la versión anterior.</p>}
      </div>

      {/* VISTA PREVIA */}
      <h2 className="font-display font-bold text-sm uppercase tracking-wide text-mk-mid mt-8 mb-3">Vista previa</h2>
      <div className="rounded-xl border border-gray-200 overflow-hidden pointer-events-none select-none" aria-hidden="true">
        <HeroBanner offer={offer} content={form} />
      </div>
      <p className={hint}>En el celular la imagen va arriba del texto.</p>
    </div>
  )
}
