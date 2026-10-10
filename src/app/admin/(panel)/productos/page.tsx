import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { getAdminClient } from '@/lib/admin-auth'
import { Plus, Pencil, Eye, EyeOff } from 'lucide-react'
import { formatPrice } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const BADGE_LABEL: Record<string, string> = { new: 'NUEVO', sale: 'OFERTA', hot: 'HOT' }
const BADGE_COLOR: Record<string, string> = {
  new:  'bg-mk-orange text-white',
  sale: 'bg-mk-green text-white',
  hot:  'bg-mk-navy text-white',
}

export default async function AdminProductosPage() {
  // RLS solo deja ver productos inactivos y pedidos con la sesión del admin
  const supabase = await getAdminClient()
  if (!supabase) redirect('/admin/login')

  const { data: products } = await supabase
    .from('Product')
    .select('id, name, slug, images, basePrice, stock, isActive, isFeatured, badge, category:Category(name, emoji)')
    .order('createdAt', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl text-mk-dark">Productos</h1>
        <Link href="/admin/productos/nuevo"
          className="flex items-center gap-2 bg-mk-orange hover:bg-mk-orange-dark text-white font-bold px-4 py-2.5 rounded-lg transition-colors text-sm">
          <Plus className="w-4 h-4" />
          Nuevo producto
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Producto</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Categoría</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Precio</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Stock</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {!products?.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-mk-mid">
                  No hay productos. <Link href="/admin/productos/nuevo" className="text-mk-orange font-medium">Crear el primero</Link>
                </td>
              </tr>
            ) : products.map((p: any) => (
              <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                      {p.images?.[0]
                        ? <Image src={p.images[0]} alt={p.name} width={40} height={40} className="object-cover w-full h-full" />
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
                <td className="px-4 py-3 text-mk-mid">
                  {p.category?.emoji} {p.category?.name ?? '—'}
                </td>
                <td className="px-4 py-3 font-semibold text-mk-dark">
                  {formatPrice(p.basePrice)}
                </td>
                <td className="px-4 py-3">
                  <span className={`font-medium px-2 py-0.5 rounded-full text-xs ${
                    p.stock === 0 ? 'bg-red-100 text-red-700'
                    : p.stock <= 5 ? 'bg-orange-100 text-orange-700'
                    : 'bg-green-100 text-green-700'
                  }`}>
                    {p.stock}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {p.isActive
                    ? <span className="flex items-center gap-1 text-green-600 text-xs"><Eye className="w-3.5 h-3.5" />Activo</span>
                    : <span className="flex items-center gap-1 text-gray-400 text-xs"><EyeOff className="w-3.5 h-3.5" />Inactivo</span>
                  }
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/productos/${p.id}`}
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
    </div>
  )
}
