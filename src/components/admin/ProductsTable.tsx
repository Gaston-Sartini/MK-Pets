'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Pencil, Eye, EyeOff } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { searchScore } from '@/lib/search'

export interface AdminProductRow {
  id: string
  name: string
  images: string[] | null
  basePrice: number
  stock: number
  isActive: boolean
  badge: string | null
  category: { name: string; emoji: string | null } | null
  variants: { label: string; stock: number }[] | null
}

const BADGE_LABEL: Record<string, string> = { new: 'NUEVO', sale: 'OFERTA', hot: 'HOT' }
const BADGE_COLOR: Record<string, string> = {
  new:  'bg-mk-orange text-white',
  sale: 'bg-mk-green text-white',
  hot:  'bg-mk-navy text-white',
}

type Show = 'all' | 'active' | 'inactive' | 'low'

/** Con variantes, el stock que vale es el de cada variante. */
function stockLines(p: AdminProductRow) {
  return p.variants?.length
    ? p.variants.map(v => ({ label: v.label, stock: v.stock }))
    : [{ label: '', stock: p.stock }]
}

export function ProductsTable({ products }: { products: AdminProductRow[] }) {
  const [search, setSearch]     = useState('')
  const [category, setCategory] = useState('')
  const [show, setShow]         = useState<Show>('all')

  const categories = useMemo(
    () => [...new Set(products.map(p => p.category?.name).filter((n): n is string => Boolean(n)))].sort(),
    [products],
  )

  const visible = useMemo(() => products.filter(p => {
    if (category && p.category?.name !== category) return false
    if (show === 'active' && !p.isActive) return false
    if (show === 'inactive' && p.isActive) return false
    if (show === 'low' && !stockLines(p).some(l => l.stock <= 5)) return false
    return !search.trim() || searchScore(search, { name: p.name, category: p.category?.name }) > 0
  }), [products, search, category, show])

  const field = 'px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-mk-orange/40 focus:border-mk-orange'

  return (
    <>
      <div className="flex flex-col md:flex-row gap-3 mb-3">
        <input
          type="search" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre o marca" aria-label="Buscar productos" className={`${field} flex-1`}
        />
        <select value={category} onChange={e => setCategory(e.target.value)} aria-label="Categoría" className={field}>
          <option value="">Todas las categorías</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={show} onChange={e => setShow(e.target.value as Show)} aria-label="Mostrar" className={field}>
          <option value="all">Todos</option>
          <option value="active">Solo activos</option>
          <option value="inactive">Solo inactivos</option>
          <option value="low">Con poco stock</option>
        </select>
      </div>
      <p className="text-xs text-mk-mid mb-3">{visible.length} de {products.length} productos</p>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Producto</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Categoría</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Precio</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Stock</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Estado</th>
              <th className="px-4 py-3"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-mk-mid">
                  {products.length === 0
                    ? <>No hay productos. <Link href="/admin/productos/nuevo" className="text-mk-orange font-medium">Crear el primero</Link></>
                    : 'Ningún producto coincide con esa búsqueda.'}
                </td>
              </tr>
            ) : visible.map(p => (
              <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                      {p.images?.[0]
                        ? <Image src={p.images[0]} alt="" width={40} height={40} className="object-cover w-full h-full" />
                        : <div className="w-full h-full flex items-center justify-center text-gray-400 text-lg">📦</div>
                      }
                    </div>
                    <div>
                      <p className="font-medium text-mk-dark line-clamp-1">{p.name}</p>
                      {p.badge && (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${BADGE_COLOR[p.badge]}`}>
                          {BADGE_LABEL[p.badge]}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-mk-mid whitespace-nowrap">
                  {p.category?.emoji} {p.category?.name ?? '—'}
                </td>
                <td className="px-4 py-3 font-semibold text-mk-dark">{formatPrice(p.basePrice)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {stockLines(p).map(line => (
                      <span key={line.label} className={`font-medium px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${
                        line.stock === 0 ? 'bg-red-100 text-red-700'
                        : line.stock <= 5 ? 'bg-orange-100 text-orange-700'
                        : 'bg-green-100 text-green-700'
                      }`}>
                        {line.label ? `${line.label}: ${line.stock}` : line.stock}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {p.isActive
                    ? <span className="flex items-center gap-1 text-green-600 text-xs"><Eye className="w-3.5 h-3.5" />Activo</span>
                    : <span className="flex items-center gap-1 text-gray-400 text-xs"><EyeOff className="w-3.5 h-3.5" />Inactivo</span>
                  }
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/productos/${p.id}`} aria-label={`Editar ${p.name}`}
                    className="inline-flex items-center gap-1.5 text-mk-orange hover:text-mk-orange-dark font-medium text-xs px-3 py-1.5 rounded-lg hover:bg-orange-50 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
