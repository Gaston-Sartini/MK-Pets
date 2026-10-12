import { redirect } from 'next/navigation'
import { getAdminClient } from '@/lib/admin-auth'
import { BulkPriceTool } from '@/components/admin/BulkPriceTool'
import type { PricedProduct } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))

export default async function AdminPreciosPage() {
  const supabase = await getAdminClient()
  if (!supabase) redirect('/admin/login')

  const [{ data: rows }, { data: categories }] = await Promise.all([
    supabase
      .from('Product')
      .select('id, name, categoryId, basePrice, originalPrice, variants:ProductVariant(label, price, originalPrice)')
      .order('name'),
    supabase.from('Category').select('id, name, emoji').order('order'),
  ])

  const products: PricedProduct[] = ((rows ?? []) as any[]).map(p => ({
    id: p.id, name: p.name, categoryId: p.categoryId,
    basePrice: Number(p.basePrice), originalPrice: num(p.originalPrice),
    variants: (p.variants ?? [])
      .map((v: any) => ({ label: v.label, price: Number(v.price), originalPrice: num(v.originalPrice) }))
      .sort((a: { price: number }, b: { price: number }) => a.price - b.price),
  }))

  return (
    <div>
      <h1 className="font-display font-bold text-2xl text-mk-dark mb-1">Aumento de precios</h1>
      <p className="text-sm text-mk-mid mb-6">
        Subí o bajá muchos precios de una vez. Elegí a qué productos, mirá cómo quedan y recién ahí aplicá.
      </p>
      <BulkPriceTool products={products} categories={(categories ?? []) as any[]} />
    </div>
  )
}
