import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { supabase } from '@/lib/supabase'

export async function PUT(req: Request, { params }: { params: { numero: string } }) {
  const auth = requireAdmin()
  if (auth) return auth.error

  const { status } = await req.json()
  const { error } = await supabase
    .from('Order')
    .update({ status })
    .eq('orderNumber', params.numero)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
