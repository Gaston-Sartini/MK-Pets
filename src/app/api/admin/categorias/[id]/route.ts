import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { categorySchema, firstIssue, slugify } from '@/lib/validations/admin'

/** Invalidate every public page that lists or filters by category. */
function revalidatePublicShop() {
  revalidatePath('/', 'layout')
}

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const auth = await requireAdmin()
  if (auth.error) return auth.error
  const { supabase } = auth

  const parsed = categorySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 })
  }
  const { name, emoji, order } = parsed.data

  const { error } = await supabase
    .from('Category')
    .update({ name, slug: slugify(name), emoji, order })
    .eq('id', params.id)

  if (error) {
    const msg = error.code === '23505' ? 'Ya existe una categoría con ese nombre.' : error.message
    return NextResponse.json({ error: msg }, { status: error.code === '23505' ? 409 : 500 })
  }
  revalidatePublicShop()
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const auth = await requireAdmin()
  if (auth.error) return auth.error
  const { supabase } = auth

  const { error } = await supabase.from('Category').delete().eq('id', params.id)
  if (error) {
    if (error.code === '23503') {
      return NextResponse.json(
        { error: 'La categoría tiene productos. Movelos a otra categoría antes de borrarla.' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  revalidatePublicShop()
  return NextResponse.json({ ok: true })
}
