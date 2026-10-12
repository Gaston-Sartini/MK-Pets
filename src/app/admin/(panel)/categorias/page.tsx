'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react'
import { useConfirm } from '@/components/admin/ConfirmDialog'

interface Category { id: string; name: string; slug: string; emoji: string | null; order: number }
interface EditState { name: string; emoji: string; order: string }

const EMPTY: EditState = { name: '', emoji: '', order: '0' }

export default function AdminCategoriasPage() {
  const [cats, setCats]         = useState<Category[]>([])
  const [loading, setLoading]   = useState(true)
  const [editId, setEditId]     = useState<string | null>(null)
  const [editData, setEditData] = useState<EditState>(EMPTY)
  const [showNew, setShowNew]   = useState(false)
  const [newData, setNewData]   = useState<EditState>(EMPTY)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const { confirm, dialog }     = useConfirm()

  useEffect(() => { loadCats() }, [])

  const loadCats = async () => {
    setLoading(true)
    const data = await fetch('/api/admin/categorias').then(r => r.json())
    setCats(data)
    setLoading(false)
  }

  const startEdit = (c: Category) => {
    setEditId(c.id)
    setEditData({ name: c.name, emoji: c.emoji ?? '', order: String(c.order) })
  }

  const saveEdit = async () => {
    if (!editId) return
    setSaving(true); setError('')
    const res = await fetch(`/api/admin/categorias/${editId}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name: editData.name, emoji: editData.emoji, order: parseInt(editData.order) }),
    })
    setSaving(false)
    if (res.ok) { setEditId(null); loadCats() }
    else setError((await res.json()).error ?? 'Error')
  }

  const deletecat = async (id: string, name: string) => {
    if (!(await confirm({
      title: `¿Eliminar la categoría "${name}"?`,
      detail: 'Solo se puede si no tiene productos asignados.',
      confirmLabel: 'Sí, eliminar',
      danger: true,
    }))) return
    const res = await fetch(`/api/admin/categorias/${id}`, { method: 'DELETE' })
    if (res.ok) loadCats()
    else setError((await res.json()).error ?? 'Error al eliminar')
  }

  const createCat = async () => {
    setSaving(true); setError('')
    const res = await fetch('/api/admin/categorias', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name: newData.name, emoji: newData.emoji, order: parseInt(newData.order) }),
    })
    setSaving(false)
    if (res.ok) { setShowNew(false); setNewData(EMPTY); loadCats() }
    else setError((await res.json()).error ?? 'Error')
  }

  const inputClass = 'border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-mk-orange focus:border-transparent'

  if (loading) return <div className="flex items-center justify-center h-64 text-mk-mid">Cargando...</div>

  return (
    <div>
      {dialog}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl text-mk-dark">Categorías</h1>
        <button onClick={() => { setShowNew(true); setError('') }}
          className="flex items-center gap-2 bg-mk-orange hover:bg-mk-orange-dark text-white font-bold px-4 py-2.5 rounded-lg transition-colors text-sm">
          <Plus className="w-4 h-4" /> Nueva categoría
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Emoji</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Nombre</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Slug</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Orden</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {/* NEW ROW */}
            {showNew && (
              <tr className="border-b border-gray-100 bg-orange-50">
                <td className="px-4 py-3">
                  <input value={newData.emoji} onChange={e => setNewData(p => ({ ...p, emoji: e.target.value }))}
                    placeholder="🐾" className={`${inputClass} w-16`} />
                </td>
                <td className="px-4 py-3">
                  <input value={newData.name} onChange={e => setNewData(p => ({ ...p, name: e.target.value }))}
                    placeholder="Nombre" className={`${inputClass} w-48`} />
                </td>
                <td className="px-4 py-3 text-mk-mid text-xs italic">auto</td>
                <td className="px-4 py-3">
                  <input type="number" value={newData.order} onChange={e => setNewData(p => ({ ...p, order: e.target.value }))}
                    className={`${inputClass} w-16`} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <button aria-label="Guardar la categoría nueva" title="Guardar la categoría nueva" onClick={createCat} disabled={saving}
                      className="flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-900 px-2 py-1 rounded hover:bg-green-50">
                      <Save className="w-3.5 h-3.5" /> Guardar
                    </button>
                    <button aria-label="Descartar la categoría nueva" title="Descartar la categoría nueva" onClick={() => { setShowNew(false); setNewData(EMPTY) }}
                      className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {cats.length === 0 && !showNew ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-mk-mid">No hay categorías.</td>
              </tr>
            ) : cats.map(c => (
              <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                {editId === c.id ? (
                  <>
                    <td className="px-4 py-3">
                      <input value={editData.emoji} onChange={e => setEditData(p => ({ ...p, emoji: e.target.value }))}
                        className={`${inputClass} w-16`} />
                    </td>
                    <td className="px-4 py-3">
                      <input value={editData.name} onChange={e => setEditData(p => ({ ...p, name: e.target.value }))}
                        className={`${inputClass} w-48`} />
                    </td>
                    <td className="px-4 py-3 text-mk-mid text-xs italic">auto</td>
                    <td className="px-4 py-3">
                      <input type="number" value={editData.order} onChange={e => setEditData(p => ({ ...p, order: e.target.value }))}
                        className={`${inputClass} w-16`} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button aria-label="Guardar los cambios" title="Guardar los cambios" onClick={saveEdit} disabled={saving}
                          className="flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-900 px-2 py-1 rounded hover:bg-green-50">
                          <Save className="w-3.5 h-3.5" /> Guardar
                        </button>
                        <button aria-label="Descartar los cambios" title="Descartar los cambios" onClick={() => setEditId(null)}
                          className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 text-xl">{c.emoji ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-mk-dark">{c.name}</td>
                    <td className="px-4 py-3 text-mk-mid font-mono text-xs">{c.slug}</td>
                    <td className="px-4 py-3 text-mk-mid">{c.order}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button aria-label={`Editar la categoría ${c.name}`} title="Editar" onClick={() => startEdit(c)}
                          className="p-1.5 text-mk-orange hover:bg-orange-50 rounded-lg transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button aria-label={`Eliminar la categoría ${c.name}`} title="Eliminar" onClick={() => deletecat(c.id, c.name)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
