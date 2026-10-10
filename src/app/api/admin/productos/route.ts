import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { productSchema, firstIssue } from '@/lib/validations/admin'

/** Invalidate every public page that shows products. */
function revalidatePublicShop() {
  revalidatePath('/', 'layout')
}

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error
  const { supabase } = auth

  const parsed = productSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 })
  }
  const { variants, ...productData } = parsed.data

  const { data: product, error } = await supabase
    .from('Product')
    .insert([productData])
    .select('id')
    .single()

  if (error) {
    const msg = error.code === '23505' ? 'Ya existe un producto con ese slug.' : error.message
    return NextResponse.json({ error: msg }, { status: error.code === '23505' ? 409 : 500 })
  }

  if (variants.length > 0) {
    const { error: variantError } = await supabase
      .from('ProductVariant')
      .insert(variants.map(v => ({ ...v, productId: product.id })))

    if (variantError) {
      // No dejamos un producto a medio crear: sin variantes se vendería al precio base.
      await supabase.from('Product').delete().eq('id', product.id)
      return NextResponse.json({ error: `No se pudieron guardar las variantes: ${variantError.message}` }, { status: 500 })
    }
  }

  revalidatePublicShop()
  return NextResponse.json({ id: product.id })
}
