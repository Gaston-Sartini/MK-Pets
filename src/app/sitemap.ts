import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

const BASE_URL = 'https://mk-pets.com.ar'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/productos`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ]

  // Dynamic product routes — only published (isActive) products
  let productRoutes: MetadataRoute.Sitemap = []
  try {
    const products = await prisma.product.findMany({
      where:   { isActive: true },
      select:  { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    })
    productRoutes = products.map(product => ({
      url:             `${BASE_URL}/producto/${product.slug}`,
      lastModified:    product.updatedAt,
      changeFrequency: 'weekly' as const,
      priority:        0.8,
    }))
  } catch {
    // DB unavailable — return sitemap without product routes
  }

  return [...staticRoutes, ...productRoutes]
}
