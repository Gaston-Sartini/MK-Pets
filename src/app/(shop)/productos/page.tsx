import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import { Footer } from '@/components/layout/Footer'
import { ProductGrid } from '@/components/catalog/ProductGrid'
import { CategoryChips } from '@/components/catalog/CategoryChips'
import { ProductCardSkeleton } from '@/components/ui/Skeleton'
import { getProducts } from '@/lib/queries'
import type { Metadata } from 'next'
import type { Product } from '@/types'

// Search results are dynamic; category pages can be cached
export const dynamic = 'auto'
export const revalidate = 120

interface PageProps {
  searchParams: { cat?: string; q?: string; cursor?: string }
}

const BASE_URL = 'https://mk-pets.com.ar'

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const cat = searchParams.cat
  const q = searchParams.q

  if (q) {
    // Search results: noindex to avoid duplicate/thin content
    return {
      title: `Resultados para "${q}" — Productos para mascotas`,
      robots: { index: false, follow: true },
    }
  }

  if (cat) {
    // Fetch category name for a richer title
    const category = await prisma.category.findUnique({
      where: { slug: cat },
      select: { name: true, emoji: true },
    }).catch(() => null)
    const catLabel = category
      ? `${category.emoji ? category.emoji + ' ' : ''}${category.name}`
      : cat.charAt(0).toUpperCase() + cat.slice(1)

    return {
      title: `${catLabel} para mascotas en Buenos Aires`,
      description: `Comprá ${catLabel.toLowerCase()} para tu mascota con envío gratis a CABA. Variedad de productos seleccionados en MK-Pets.`,
      alternates: {
        canonical: `${BASE_URL}/productos?cat=${cat}`,
      },
      openGraph: {
        title: `${catLabel} para mascotas en Buenos Aires | MK-Pets`,
        description: `Comprá ${catLabel.toLowerCase()} para tu mascota con envío gratis a CABA.`,
        url: `${BASE_URL}/productos?cat=${cat}`,
      },
    }
  }

  return {
    title: 'Todos los productos para mascotas',
    description:
      'Explorá nuestro catálogo completo de alimentos, snacks, higiene y juguetes para perros y gatos. Envío gratis a CABA.',
    alternates: {
      canonical: `${BASE_URL}/productos`,
    },
    openGraph: {
      title: 'Todos los productos para mascotas | MK-Pets',
      description:
        'Catálogo completo de productos para mascotas con envío gratis a CABA.',
      url: `${BASE_URL}/productos`,
    },
  }
}

async function getCategories() {
  return prisma.category.findMany({
    select: { id: true, name: true, slug: true, emoji: true, order: true },
    orderBy: { order: 'asc' },
  })
}

export default async function ProductosPage({ searchParams }: PageProps) {
  const { cat, q, cursor } = searchParams

  let products: Product[] = []
  let categories: Awaited<ReturnType<typeof getCategories>> = []

  try {
    const [productsResult, categoriesResult] = await Promise.all([
      getProducts({ categorySlug: cat, search: q, cursor }),
      getCategories(),
    ])
    products = productsResult.products
    categories = categoriesResult
  } catch (err) {
    console.error('[productos] Error cargando catálogo:', err)
  }

  const activeCategory = categories.find(c => c.slug === cat)

  return (
    <>
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-6">

        {/* CHIPS CATEGORÍAS */}
        <nav aria-label="Filtrar por categoría" className="mb-6">
          <Suspense fallback={null}>
            <CategoryChips />
          </Suspense>
        </nav>

        {/* HEADER */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-display font-bold text-xl text-mk-dark">
            {q
              ? `Resultados para "${q}"`
              : activeCategory
                ? `${activeCategory.emoji ?? ''} ${activeCategory.name}`
                : 'Todos los productos 🐾'
            }
            <span className="ml-2 text-sm font-body font-normal text-mk-mid">
              ({products.length} productos)
            </span>
          </h1>
        </div>

        {/* GRID */}
        <Suspense fallback={
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
            {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
          </div>
        }>
          {products.length > 0
            ? <ProductGrid products={products} />
            : <EmptyState query={q} />
          }
        </Suspense>
      </div>

      <Footer />
    </>
  )
}

function EmptyState({ query }: { query?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <span className="text-6xl" aria-hidden="true">🔍</span>
      <h2 className="font-display font-bold text-xl text-mk-dark">
        {query ? `Sin resultados para "${query}"` : 'No hay productos en esta categoría'}
      </h2>
      <p className="font-body text-mk-mid text-sm">
        Probá con otro término o escribinos por WhatsApp para consultar stock 🐾
      </p>
      <a
        href="https://wa.me/5491166698395"
        target="_blank"
        rel="noopener noreferrer"
        className="btn-primary"
        aria-label="Consultar stock por WhatsApp"
      >
        💬 Consultar por WhatsApp
      </a>
    </div>
  )
}
