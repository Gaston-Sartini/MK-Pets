import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const auth = requireAdmin()
  if (auth) return auth.error

  const { data, error } = await supabase
    .from('Order')
    .select('id, orderNumber, customerName, phone, total, status, paymentStatus, createdAt, items:OrderItem(id)')
    .order('createdAt', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
