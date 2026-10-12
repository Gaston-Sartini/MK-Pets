import { Suspense } from 'react'
import type { Metadata } from 'next'
import { logger } from '@/lib/logger'
import { Footer } from '@/components/layout/Footer'
import { HeroBanner } from '@/components/layout/HeroBanner'
import { ProductGrid } from '@/components/catalog/ProductGrid'
import { ProductCardSkeleton } from '@/components/ui/Skeleton'
import { CategoryChips } from '@/components/catalog/CategoryChips'
import { JsonLd } from '@/components/seo/JsonLd'
import {
  getFeaturedProducts,
  getProductsByCategory,
  getCategories,
} from '@/lib/queries'
import { SITE_URL, describeCatalog, describeCatalogTitle } from '@/lib/shop'

// Cache home page for 5 minutes — balances freshness vs. DB load
export const revalidate = 300

const BASE_URL = SITE_URL

// La descripción nombra los rubros que hoy tienen productos: no promete lo que no se vende.
export async function generateMetadata(): Promise<Metadata> {
  const rubros = (await getCategories().catch(() => [])).map(c => c.name)
  return {
    title: 'Tienda de mascotas en Buenos Aires | MK-Pets',
    description:
      `Comprá ${describeCatalog(rubros)} para perros y gatos. Envío gratis a CABA. Tu tienda de mascotas online en Buenos Aires.`,
    alternates: {
      canonical: BASE_URL,
    },
    openGraph: {
      title: 'Tienda de mascotas en Buenos Aires | MK-Pets',
      description:
        `${describeCatalogTitle(rubros)} para mascotas. Envío gratis a CABA.`,
      url: BASE_URL,
    },
  }
}

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'MK-Pets',
  url: BASE_URL,
  description:
    'Marketplace de productos para mascotas en Buenos Aires con envío gratis a CABA.',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${BASE_URL}/productos?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
}

// Maximum number of category sections to render on the home page.
// Keeps the page reasonable when there are many categories in the DB.
const MAX_HOME_SECTIONS = 4

export default async function HomePage() {
  // Load categories first — they drive which sections to render.
  const categories = await getCategories().catch(() => [])
  const sectionCats = categories.slice(0, MAX_HOME_SECTIONS)

  let featured: Awaited<ReturnType<typeof getFeaturedProducts>> = []
  let sections: Awaited<ReturnType<typeof getProductsByCategory>>[] =
    sectionCats.map(() => [])

  try {
    const results = await Promise.all([
      getFeaturedProducts(),
      ...sectionCats.map(s => getProductsByCategory(s.slug)),
    ])
    const [featuredData, ...sectionData] = results
    featured = featuredData
    sections = sectionData
  } catch (err) {
    // Log real error so silent failures don't hide DB issues.
    logger.error('Error cargando productos en home', { error: err instanceof Error ? err.message : String(err) })
  }

  return (
    <>
      <JsonLd data={websiteSchema} />
      <HeroBanner offer={describeCatalogTitle(categories.map(c => c.name))} />

      {/* CATEGORÍAS */}
      <section aria-label="Categorías" className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-6">
        <Suspense fallback={null}>
          <CategoryChips categories={categories} />
        </Suspense>
      </section>

      {/* MÁS VENDIDOS */}
      <section aria-labelledby="featured-heading" className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 pb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 id="featured-heading" className="section-title">⭐ Más vendidos</h2>
          <a href="/productos" className="text-sm font-body text-mk-orange hover:underline">
            Ver todos →
          </a>
        </div>
        <Suspense fallback={<SkeletonGrid count={4} />}>
          <ProductGrid products={featured} />
        </Suspense>
      </section>

      {/* SECCIONES POR CATEGORÍA (dinámicas, leídas de la DB) */}
      {sectionCats.map((section, i) => (
        <section
          key={section.slug}
          aria-labelledby={`section-${section.slug}`}
          className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-10"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 id={`section-${section.slug}`} className="section-title">
              {section.emoji ?? '🐾'} {section.name}
            </h2>
            <a
              href={`/productos?cat=${section.slug}`}
              className="text-sm font-body text-mk-orange hover:underline"
            >
              Ver todos →
            </a>
          </div>
          <Suspense fallback={<SkeletonGrid count={4} />}>
            <ProductGrid products={sections[i] ?? []} />
          </Suspense>
        </section>
      ))}

      <Footer />
    </>
  )
}

function SkeletonGrid({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}
