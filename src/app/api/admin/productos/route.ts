import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { supabase } from '@/lib/supabase'

export async function POST(req: Request) {
  const auth = requireAdmin()
  if (auth) return auth.error

  const body = await req.json()
  const { variants = [], ...productData } = body

  const { data: product, error } = await supabase
    .from('Product')
    .insert([{
      name:        productData.name,
      slug:        productData.slug,
      description: productData.description || null,
      images:      productData.images?.filter(Boolean) ?? [],
      basePrice:   parseFloat(productData.basePrice),
      stock:       parseInt(productData.stock),
      isActive:    productData.isActive ?? true,
      isFeatured:  productData.isFeatured ?? false,
      badge:       productData.badge || null,
      categoryId:  productData.categoryId,
    }])
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (variants.length > 0) {
    await supabase.from('ProductVariant').insert(
      variants.map((v: any) => ({
        label:     v.label,
        price:     parseFloat(v.price),
        stock:     parseInt(v.stock),
        productId: product.id,
      }))
    )
  }

  return NextResponse.json({ id: product.id })
}
