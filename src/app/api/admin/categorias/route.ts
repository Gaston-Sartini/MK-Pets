import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { supabase as publicSupabase } from '@/lib/supabase'
import { categorySchema, firstIssue, slugify } from '@/lib/validations/admin'

/** Invalidate every public page that lists or filters by category. */
function revalidatePublicShop() {
  revalidatePath('/', 'layout')
}

// Las categorías son públicas (se muestran en la tienda), por eso el GET no exige sesión.
export async function GET() {
  const { data, error } = await publicSupabase
    .from('Category')
    .select('id, name, slug, emoji, order')
    .order('order', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error
  const { supabase } = auth

  const parsed = categorySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 })
  }
  const { name, emoji, order } = parsed.data

  const { data, error } = await supabase
    .from('Category')
    .insert([{ name, slug: slugify(name), emoji, order }])
    .select('id')
    .single()

  if (error) {
    const msg = error.code === '23505' ? 'Ya existe una categoría con ese nombre.' : error.message
    return NextResponse.json({ error: msg }, { status: error.code === '23505' ? 409 : 500 })
  }
  revalidatePublicShop()
  return NextResponse.json({ id: data.id })
}
