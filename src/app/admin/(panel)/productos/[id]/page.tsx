import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ProductForm from '@/components/admin/ProductForm'

export const dynamic = 'force-dynamic'

export default async function EditarProductoPage({ params }: { params: { id: string } }) {
  const { data: p } = await supabase
    .from('Product')
    .select('*, variants:ProductVariant(id, label, price, originalPrice, stock)')
    .eq('id', params.id)
    .single()

  if (!p) notFound()

  const initial = {
    name:          p.name,
    slug:          p.slug,
    description:   p.description ?? '',
    categoryId:    p.categoryId,
    basePrice:     String(p.basePrice),
    originalPrice: p.originalPrice == null ? '' : String(p.originalPrice),
    stock:         String(p.stock),
    badge:         p.badge ?? '',
    isActive:      p.isActive,
    isFeatured:    p.isFeatured,
    images:        p.images ?? [],
    variants:      (p.variants ?? []).map((v: any) => ({
      label:         v.label,
      price:         String(v.price),
      originalPrice: v.originalPrice == null ? '' : String(v.originalPrice),
      stock:         String(v.stock),
    })),
  }

  return (
    <div>
      <Link href="/admin/productos"
        className="inline-flex items-center gap-2 text-mk-mid hover:text-mk-dark text-sm mb-6">
        <ArrowLeft className="w-4 h-4" /> Volver a productos
      </Link>
      <h1 className="font-display font-bold text-2xl text-mk-dark mb-6">
        Editar: <span className="text-mk-orange">{p.name}</span>
      </h1>
      <ProductForm productId={params.id} initial={initial} />
    </div>
  )
}
