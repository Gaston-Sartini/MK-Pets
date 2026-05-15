import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { AddToCartButton } from '@/components/catalog/AddToCartButton'
import { JsonLd } from '@/components/seo/JsonLd'
import { formatPrice } from '@/lib/utils'
import type { Metadata } from 'next'
import type { Product } from '@/types'

interface PageProps { params: { slug: string } }

const BASE_URL = 'https://mk-pets.com.ar'

async function getProduct(slug: string): Promise<Product | null> {
  const p = await prisma.product.findUnique({
    where: { slug, isActive: true },
    include: { category: true, variants: true },
  })
  if (!p) return null
  return {
    ...p,
    basePrice: Number(p.basePrice),
    badge: p.badge as Product['badge'],
    variants: p.variants.map(v => ({ ...v, price: Number(v.price) })),
  }
}

async function getRelated(categoryId: string, excludeId: string): Promise<Product[]> {
  const products = await prisma.product.findMany({
    where: { categoryId, isActive: true, id: { not: excludeId } },
    include: { category: true, variants: true },
    take: 4,
  })
  return products.map(p => ({
    ...p,
    basePrice: Number(p.basePrice),
    badge: p.badge as Product['badge'],
    variants: p.variants.map(v => ({ ...v, price: Number(v.price) })),
  }))
}

/** Pre-build all published product slugs at build time */
export async function generateStaticParams() {
  const products = await prisma.product.findMany({
    where:  { isActive: true },
    select: { slug: true },
  })
  return products.map(p => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const p = await getProduct(params.slug)
  if (!p) notFound()

  const canonicalUrl = `${BASE_URL}/producto/${p.slug}`
  const description  = p.description
    ?? `Comprá ${p.name} en MK-Pets con envío gratis a CABA. Productos para mascotas de calidad en Buenos Aires.`

  // Ensure OG image is always an absolute URL
  const ogImage = p.images[0]
    ? p.images[0].startsWith('http')
      ? p.images[0]
      : `${BASE_URL}${p.images[0]}`
    : `${BASE_URL}/og-image.png`

  return {
    title: p.name,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title:       `${p.name} | MK-Pets`,
      description,
      url:         canonicalUrl,
      type:        'website',
      images: [
        {
          url:    ogImage,
          width:  1200,
          height: 630,
          alt:    p.name,
        },
      ],
    },
    twitter: {
      card:        'summary_large_image',
      title:       `${p.name} | MK-Pets`,
      description,
      images:      [ogImage],
    },
  }
}

const BADGE_LABEL: Record<string, string> = {
  new: 'NUEVO', sale: 'OFERTA', hot: 'MÁS VENDIDO',
}

export default async function ProductoPage({ params }: PageProps) {
  const [product, related] = await Promise.all([
    getProduct(params.slug),
    getProduct(params.slug).then(p => p ? getRelated(p.category.id, p.id) : []),
  ])

  if (!product) notFound()

  const mainImage = product.images[0] ?? '/placeholder-product.png'

  // Ensure all image URLs are absolute for JSON-LD
  const absoluteImages = product.images.map(img =>
    img.startsWith('http') ? img : `${BASE_URL}${img}`
  )

  const canonicalUrl = `${BASE_URL}/producto/${product.slug}`

  /** Product structured data */
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description:
      product.description ??
      `${product.name} — disponible en MK-Pets con envío gratis a CABA.`,
    image: absoluteImages.length > 0 ? absoluteImages : [`${BASE_URL}/og-image.png`],
    brand: {
      '@type': 'Brand',
      name: 'MK-Pets',
    },
    offers: {
      '@type': 'Offer',
      url: canonicalUrl,
      priceCurrency: 'ARS',
      price: product.basePrice.toFixed(2),
      availability:
        product.stock > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: 'MK-Pets',
        url: BASE_URL,
      },
    },
    ...(product.category && {
      category: product.category.name,
    }),
  }

  /** BreadcrumbList structured data */
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Inicio',
        item: BASE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: product.category.name,
        item: `${BASE_URL}/productos?cat=${product.category.slug}`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: product.name,
        item: canonicalUrl,
      },
    ],
  }

  return (
    <>
      <JsonLd data={productSchema} />
      <JsonLd data={breadcrumbSchema} />
      <Navbar />
      <main className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-6">

        {/* BREADCRUMB */}
        <nav className="flex items-center gap-2 text-xs font-body text-mk-mid mb-4">
          <Link href="/" className="hover:text-mk-orange transition-colors">Inicio</Link>
          <span>/</span>
          <Link href="/productos" className="hover:text-mk-orange transition-colors">Productos</Link>
          <span>/</span>
          <Link
            href={`/productos?cat=${product.category.slug}`}
            className="hover:text-mk-orange transition-colors"
          >
            {product.category.name}
          </Link>
          <span>/</span>
          <span className="text-mk-dark font-medium line-clamp-1">{product.name}</span>
        </nav>

        {/* PRODUCT LAYOUT */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">

          {/* IMAGEN */}
          <div className="relative aspect-square rounded-card overflow-hidden bg-gray-50 shadow-card">
            {product.badge && (
              <div className="absolute top-3 left-3 z-10">
                <span className={`badge-${product.badge}`}>
                  {BADGE_LABEL[product.badge]}
                </span>
              </div>
            )}
            <Image
              src={mainImage}
              alt={product.name}
              fill
              className="object-contain p-6"
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
            />
          </div>

          {/* INFO */}
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-body text-mk-mid uppercase tracking-wide mb-1">
                {product.category.emoji} {product.category.name}
              </p>
              <h1 className="font-display font-bold text-2xl md:text-3xl text-mk-dark leading-tight">
                {product.name}
              </h1>
            </div>

            {/* CLIENT COMPONENT: variante + precio + botón agregar */}
            <AddToCartButton product={product} />

            {/* DESCRIPCIÓN */}
            {product.description && (
              <div className="border-t border-gray-100 pt-4">
                <h2 className="font-display font-bold text-base text-mk-dark mb-2">
                  Descripción
                </h2>
                <p className="font-body text-mk-mid text-sm leading-relaxed whitespace-pre-line">
                  {product.description}
                </p>
              </div>
            )}

            {/* TRUST */}
            <div className="border-t border-gray-100 pt-4 grid grid-cols-2 gap-2">
              {[
                { icon: '🚚', text: 'Envío gratis a CABA' },
                { icon: '🔒', text: 'Compra segura' },
                { icon: '💬', text: 'Atención personalizada' },
                { icon: '⭐', text: 'Productos 100% originales' },
              ].map(b => (
                <div key={b.text} className="trust-badge">
                  <span>{b.icon}</span>
                  <span>{b.text}</span>
                </div>
              ))}
            </div>

            {/* WHATSAPP */}
            <a
              href={`https://wa.me/5491166698395?text=Hola! Me interesa el producto: ${product.name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary w-full text-center"
            >
              💬 Consultar por WhatsApp
            </a>
          </div>
        </div>

        {/* RELACIONADOS */}
        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="section-title">También te puede gustar</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {related.map(p => (
                <Link key={p.id} href={`/producto/${p.slug}`} className="product-card block">
                  <div className="relative aspect-square bg-gray-50">
                    <Image
                      src={p.images[0] ?? '/placeholder-product.png'}
                      alt={p.name}
                      fill
                      className="object-contain p-3"
                      sizes="25vw"
                    />
                  </div>
                  <div className="p-3">
                    <p className="font-display font-bold text-sm text-mk-dark line-clamp-2">{p.name}</p>
                    <p className="price-display text-lg mt-1">{formatPrice(p.basePrice)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  )
}
