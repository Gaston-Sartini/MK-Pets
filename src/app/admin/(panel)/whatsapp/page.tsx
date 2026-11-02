import { redirect } from 'next/navigation'
import { getAdminClient } from '@/lib/admin-auth'
import { WhatsAppLink } from '@/components/admin/WhatsAppLink'

export const dynamic = 'force-dynamic'

export default async function AdminWhatsAppPage() {
  const supabase = await getAdminClient()
  if (!supabase) redirect('/admin/login')

  return (
    <div>
      <h1 className="font-display font-bold text-2xl text-mk-dark mb-1">WhatsApp</h1>
      <p className="text-sm text-mk-mid mb-6">Desde qué teléfono salen los avisos a los clientes, y a qué número le llegan los avisos a la tienda.</p>
      <WhatsAppLink />
    </div>
  )
}
