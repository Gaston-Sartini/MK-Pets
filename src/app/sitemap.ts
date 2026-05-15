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
  const products = await prisma.product.findMany({
    where:  { isActive: true },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  })

  const productRoutes: MetadataRoute.Sitemap = products.map(product => ({
    url:             `${BASE_URL}/producto/${product.slug}`,
    lastModified:    product.updatedAt,
    changeFrequency: 'weekly',
    priority:        0.8,
  }))

  return [...staticRoutes, ...productRoutes]
}
