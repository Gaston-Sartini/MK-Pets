import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import { Footer } from '@/components/layout/Footer'
import { ProductGrid } from '@/components/catalog/ProductGrid'
import { CategoryChips } from '@/components/catalog/CategoryChips'
import { ProductCardSkeleton } from '@/components/ui/Skeleton'
import { getProducts } from '@/lib/queries'
import type { Metadata } from 'next'

// Search results are dynamic; category pages can be cached
export const dynamic = 'auto'
export const revalidate = 120

interface PageProps {
  searchParams: { cat?: string; q?: string; cursor?: string }
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const cat = searchParams.cat
  return {
    title: cat ? `${cat.charAt(0).toUpperCase() + cat.slice(1)} para mascotas` : 'Todos los productos',
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

  const [{ products }, categories] = await Promise.all([
    getProducts({ categorySlug: cat, search: q, cursor }),
    getCategories(),
  ])

  const activeCategory = categories.find(c => c.slug === cat)

  return (
    <>
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-6">

        {/* CHIPS CATEGORÍAS */}
        <nav aria-label="Filtrar por categoría" className="mb-6">
          <CategoryChips />
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
