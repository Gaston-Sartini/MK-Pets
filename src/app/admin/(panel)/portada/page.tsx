import { redirect } from 'next/navigation'
import { getAdminClient } from '@/lib/admin-auth'
import { HeroEditor } from '@/components/admin/HeroEditor'
import { getHeroContent } from '@/lib/site-settings'
import { getCategories } from '@/lib/queries'
import { describeCatalogTitle } from '@/lib/shop'

export const dynamic = 'force-dynamic'

export default async function AdminPortadaPage() {
  const supabase = await getAdminClient()
  if (!supabase) redirect('/admin/login')

  const [hero, categories] = await Promise.all([getHeroContent(), getCategories().catch(() => [])])

  return (
    <div>
      <h1 className="font-display font-bold text-2xl text-mk-dark mb-1">Portada</h1>
      <p className="text-sm text-mk-mid mb-6">Los textos y la imagen que se ven arriba de todo en la página de inicio.</p>
      <HeroEditor initial={hero} offer={describeCatalogTitle(categories.map(c => c.name))} />
    </div>
  )
}
