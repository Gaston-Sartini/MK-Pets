import type { MetadataRoute } from 'next'
import { getActiveProductSlugs } from '@/lib/queries'

const BASE_URL = 'https://mk-pets.com.ar'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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

  let productRoutes: MetadataRoute.Sitemap = []
  try {
    const products = await getActiveProductSlugs()
    productRoutes = products.map(p => ({
      url:             `${BASE_URL}/producto/${p.slug}`,
      lastModified:    new Date(p.updatedAt as string),
      changeFrequency: 'weekly' as const,
      priority:        0.8,
    }))
  } catch {
    // DB unavailable — return sitemap without product routes
  }

  return [...staticRoutes, ...productRoutes]
}
