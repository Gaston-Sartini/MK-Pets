import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET() {
  const auth = await requireAdmin()
  if (auth.error) return auth.error
  const { supabase } = auth

  const { data, error } = await supabase
    .from('Order')
    .select('id, orderNumber, customerName, phone, address, notes, total, status, paymentMethod, paymentStatus, createdAt, ' +
      'items:OrderItem(id, quantity, unitPrice, variantLabel, product:Product(name))')
    .order('createdAt', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
