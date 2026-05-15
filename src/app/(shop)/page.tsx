import { Suspense } from 'react'
import type { Metadata } from 'next'
import { Footer } from '@/components/layout/Footer'
import { HeroBanner } from '@/components/layout/HeroBanner'
import { ShippingBanner } from '@/components/layout/ShippingBanner'
import { ProductGrid } from '@/components/catalog/ProductGrid'
import { ProductCardSkeleton } from '@/components/ui/Skeleton'
import { CategoryChips } from '@/components/catalog/CategoryChips'
import { JsonLd } from '@/components/seo/JsonLd'
import {
  getFeaturedProducts,
  getProductsByCategory,
} from '@/lib/queries'

// Cache home page for 5 minutes — balances freshness vs. DB load
export const revalidate = 300

const BASE_URL = 'https://mk-pets.com.ar'

export const metadata: Metadata = {
  title: 'Tienda de mascotas en Buenos Aires | MK-Pets',
  description:
    'Comprá alimentos para perros y gatos, snacks, productos de higiene y juguetes para mascotas. Envío gratis a CABA. La mejor tienda de mascotas online de Buenos Aires.',
  alternates: {
    canonical: BASE_URL,
  },
  openGraph: {
    title: 'Tienda de mascotas en Buenos Aires | MK-Pets',
    description:
      'Alimentos, snacks, higiene y juguetes para mascotas. Envío gratis a CABA.',
    url: BASE_URL,
  },
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

const SECTIONS = [
  { slug: 'gatos',  label: 'Línea Gatos',  emoji: '🐱' },
  { slug: 'perros', label: 'Línea Perros',  emoji: '🐶' },
  { slug: 'snacks', label: 'Snacks',        emoji: '🍬' },
  { slug: 'higiene',label: 'Higiene',       emoji: '🧴' },
]

export default async function HomePage() {
  // Promise.all — queries en paralelo, no secuenciales
  const [featured, ...sections] = await Promise.all([
    getFeaturedProducts(),
    ...SECTIONS.map(s => getProductsByCategory(s.slug)),
  ])

  return (
    <>
      <JsonLd data={websiteSchema} />
      <HeroBanner />

      {/* CATEGORÍAS */}
      <section aria-label="Categorías" className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-6">
        <CategoryChips />
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

      <ShippingBanner />

      {/* SECCIONES POR CATEGORÍA */}
      {SECTIONS.map((section, i) => (
        <section
          key={section.slug}
          aria-labelledby={`section-${section.slug}`}
          className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-10"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 id={`section-${section.slug}`} className="section-title">
              {section.emoji} {section.label}
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
