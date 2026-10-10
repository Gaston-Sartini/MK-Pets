import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { productSchema, firstIssue } from '@/lib/validations/admin'

/** Invalidate every public page that shows products. */
function revalidatePublicShop() {
  revalidatePath('/', 'layout')
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error
  const { supabase } = auth

  const parsed = productSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 })
  }
  const { variants, ...productData } = parsed.data

  const { error } = await supabase
    .from('Product')
    .update(productData)
    .eq('id', params.id)

  if (error) {
    const msg = error.code === '23505' ? 'Ya existe un producto con ese slug.' : error.message
    return NextResponse.json({ error: msg }, { status: error.code === '23505' ? 409 : 500 })
  }

  // Reemplazo de variantes: guardamos las anteriores para poder restaurarlas si
  // el insert de las nuevas falla (PostgREST no ofrece transacciones multi-tabla).
  const { data: previous } = await supabase
    .from('ProductVariant')
    .select('id, label, price, originalPrice, stock, productId')
    .eq('productId', params.id)

  const { error: deleteError } = await supabase.from('ProductVariant').delete().eq('productId', params.id)
  if (deleteError) {
    return NextResponse.json({ error: `No se pudieron actualizar las variantes: ${deleteError.message}` }, { status: 500 })
  }

  if (variants.length > 0) {
    const { error: insertError } = await supabase
      .from('ProductVariant')
      .insert(variants.map(v => ({ ...v, productId: params.id })))

    if (insertError) {
      if (previous?.length) await supabase.from('ProductVariant').insert(previous)
      return NextResponse.json({ error: `No se pudieron guardar las variantes: ${insertError.message}` }, { status: 500 })
    }
  }

  revalidatePublicShop()
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error
  const { supabase } = auth

  // Las variantes se borran solas (ON DELETE CASCADE).
  const { error } = await supabase.from('Product').delete().eq('id', params.id)

  if (error) {
    // 23503 = el producto figura en pedidos; borrarlo rompería el historial.
    if (error.code === '23503') {
      return NextResponse.json(
        { error: 'Este producto tiene pedidos asociados y no se puede borrar. Desactivalo para que deje de mostrarse en la tienda.' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  revalidatePublicShop()
  return NextResponse.json({ ok: true })
}
