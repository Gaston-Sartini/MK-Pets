import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { supabase } from '@/lib/supabase'

/** Invalidate every public page that shows products. */
function revalidatePublicShop() {
  revalidatePath('/', 'layout')
}

/** Parse "" / null / undefined → null, otherwise a number (or null if not finite). */
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? n : null
}

export async function POST(req: Request) {
  const auth = requireAdmin()
  if (auth) return auth.error

  const body = await req.json()
  const { variants = [], ...productData } = body

  const basePrice     = num(productData.basePrice)     ?? 0
  const originalPrice = num(productData.originalPrice)
  if (originalPrice !== null && originalPrice <= basePrice) {
    return NextResponse.json(
      { error: 'El precio antes debe ser mayor al precio actual.' },
      { status: 400 },
    )
  }

  const { data: product, error } = await supabase
    .from('Product')
    .insert([{
      name:          productData.name,
      slug:          productData.slug,
      description:   productData.description || null,
      images:        productData.images?.filter(Boolean) ?? [],
      basePrice,
      originalPrice,
      stock:         parseInt(productData.stock),
      isActive:      productData.isActive ?? true,
      isFeatured:    productData.isFeatured ?? false,
      badge:         productData.badge || null,
      categoryId:    productData.categoryId,
    }])
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (variants.length > 0) {
    await supabase.from('ProductVariant').insert(
      variants.map((v: any) => ({
        label:         v.label,
        price:         num(v.price) ?? 0,
        originalPrice: num(v.originalPrice),
        stock:         parseInt(v.stock),
        productId:     product.id,
      }))
    )
  }

  revalidatePublicShop()
  return NextResponse.json({ id: product.id })
}
