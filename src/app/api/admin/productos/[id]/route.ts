import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { supabase } from '@/lib/supabase'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = requireAdmin()
  if (auth) return auth.error

  const body = await req.json()
  const { variants = [], ...productData } = body

  const { error } = await supabase
    .from('Product')
    .update({
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
    })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Replace all variants
  await supabase.from('ProductVariant').delete().eq('productId', params.id)
  if (variants.length > 0) {
    await supabase.from('ProductVariant').insert(
      variants.map((v: any) => ({
        label:     v.label,
        price:     parseFloat(v.price),
        stock:     parseInt(v.stock),
        productId: params.id,
      }))
    )
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = requireAdmin()
  if (auth) return auth.error

  await supabase.from('ProductVariant').delete().eq('productId', params.id)
  const { error } = await supabase.from('Product').delete().eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
