import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAdminClient } from '@/lib/admin-auth'
import { Plus, Percent } from 'lucide-react'
import { ProductsTable, type AdminProductRow } from '@/components/admin/ProductsTable'

export const dynamic = 'force-dynamic'

export default async function AdminProductosPage() {
  // RLS solo deja ver productos inactivos y pedidos con la sesión del admin
  const supabase = await getAdminClient()
  if (!supabase) redirect('/admin/login')

  const { data: products } = await supabase
    .from('Product')
    .select('id, name, images, basePrice, stock, isActive, badge, category:Category(name, emoji), variants:ProductVariant(label, stock, price)')
    .order('createdAt', { ascending: false })

  const rows: AdminProductRow[] = ((products ?? []) as any[]).map(p => ({
    ...p,
    basePrice: Number(p.basePrice),
    // De la más barata a la más cara, como se ven en la tienda
    variants: [...(p.variants ?? [])].sort((a, b) => Number(a.price) - Number(b.price)),
  }))

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="font-display font-bold text-2xl text-mk-dark">Productos</h1>
        <div className="flex items-center gap-2">
          <Link href="/admin/precios"
            className="flex items-center gap-2 border border-mk-orange text-mk-orange hover:bg-orange-50 font-bold px-4 py-2.5 rounded-lg transition-colors text-sm">
            <Percent className="w-4 h-4" />
            Aumentar precios
          </Link>
          <Link href="/admin/productos/nuevo"
            className="flex items-center gap-2 bg-mk-orange hover:bg-mk-orange-dark text-white font-bold px-4 py-2.5 rounded-lg transition-colors text-sm">
            <Plus className="w-4 h-4" />
            Nuevo producto
          </Link>
        </div>
      </div>

      <ProductsTable products={rows} />
    </div>
  )
}
