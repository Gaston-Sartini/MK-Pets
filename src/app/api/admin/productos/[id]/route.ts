import { logger } from '@/lib/logger'
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

  // Se anotan las fotos antes de borrar, para no dejarlas huérfanas en el almacenamiento.
  const { data: existing } = await supabase.from('Product').select('images').eq('id', params.id).maybeSingle()

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

  // Las fotos subidas desde el panel viven en el bucket "products". Si falla el borrado
  // no es grave (el producto ya no existe): queda un archivo suelto, nada más.
  const marker = '/storage/v1/object/public/products/'
  const paths = ((existing?.images ?? []) as string[])
    .filter(url => typeof url === 'string' && url.includes(marker))
    .map(url => decodeURIComponent(url.split(marker)[1]))
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from('products').remove(paths)
    if (storageError) logger.warn('No se pudieron borrar las fotos del producto', { error: storageError.message })
  }

  revalidatePublicShop()
  return NextResponse.json({ ok: true })
}
