import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { supabase } from '@/lib/supabase'

/** Invalidate every public page that lists or filters by category. */
function revalidatePublicShop() {
  revalidatePath('/', 'layout')
}

export async function GET() {
  const { data, error } = await supabase
    .from('Category')
    .select('id, name, slug, emoji, order')
    .order('order', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const auth = requireAdmin()
  if (auth) return auth.error

  const { name, emoji, order } = await req.json()
  const slug = name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

  const { data, error } = await supabase
    .from('Category')
    .insert([{ name, slug, emoji: emoji || null, order: order ?? 0 }])
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePublicShop()
  return NextResponse.json({ id: data.id })
}
