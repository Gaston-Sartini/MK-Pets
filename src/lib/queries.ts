import { supabase } from './supabase'
import { prisma } from './prisma'
import type { Product } from '@/types'

// Supabase select for product cards (no description)
const PRODUCT_CARD_SELECT =
  'id, name, slug, images, basePrice, originalPrice, badge, isFeatured, stock, ' +
  'category:Category ( id, name, slug, emoji ), ' +
  'variants:ProductVariant ( id, label, price, originalPrice, stock )'

// Supabase select for product detail page (adds description)
const PRODUCT_DETAIL_SELECT = PRODUCT_CARD_SELECT + ', description'

/** Parse a Supabase numeric (returned as string) → number | null. */
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? n : null
}

function serializeProduct(p: any): Product {
  return {
    ...p,
    description: p.description ?? null,
    basePrice: num(p.basePrice) ?? 0,
    originalPrice: num(p.originalPrice),
    badge: (p.badge as Product['badge']) ?? null,
    variants: (p.variants ?? []).map((v: any) => ({
      ...v,
      price: num(v.price) ?? 0,
      originalPrice: num(v.originalPrice),
    })),
  }
}

/** Productos destacados para la home — máximo 8 */
export async function getFeaturedProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('Product')
    .select(PRODUCT_CARD_SELECT)
    .eq('isFeatured', true)
    .eq('isActive', true)
    .order('createdAt', { ascending: false })
    .limit(8)

  if (error) throw new Error(error.message)
  return (data ?? []).map(serializeProduct)
}

/** Productos de una categoría — máximo configurable */
export async function getProductsByCategory(
  categorySlug: string,
  take = 4
): Promise<Product[]> {
  const { data: cat } = await supabase
    .from('Category')
    .select('id')
    .eq('slug', categorySlug)
    .single()

  if (!cat) return []

  const { data, error } = await supabase
    .from('Product')
    .select(PRODUCT_CARD_SELECT)
    .eq('categoryId', cat.id)
    .eq('isActive', true)
    .order('isFeatured', { ascending: false })
    .order('createdAt', { ascending: false })
    .limit(take)

  if (error) throw new Error(error.message)
  return (data ?? []).map(serializeProduct)
}

/**
 * Catálogo con filtro y paginación por cursor.
 */
export async function getProducts(opts: {
  categorySlug?: string
  search?:       string
  cursor?:       string
  take?:         number
}): Promise<{ products: Product[]; nextCursor: string | null }> {
  const { categorySlug, search, cursor, take = 20 } = opts

  let categoryId: string | undefined
  if (categorySlug) {
    const { data: cat } = await supabase
      .from('Category')
      .select('id')
      .eq('slug', categorySlug)
      .single()
    if (!cat) return { products: [], nextCursor: null }
    categoryId = cat.id
  }

  // eslint-disable-next-line prefer-const
  let query = supabase
    .from('Product')
    .select(PRODUCT_CARD_SELECT)
    .eq('isActive', true)
    .order('isFeatured', { ascending: false })
    .order('createdAt', { ascending: false })
    .limit(take + 1)

  if (categoryId) query = query.eq('categoryId', categoryId)
  if (search)     query = query.ilike('name', `%${search}%`)

  if (cursor) {
    const { data: pivot } = await supabase
      .from('Product')
      .select('isFeatured, createdAt')
      .eq('id', cursor)
      .single()

    if (pivot) {
      const ts = new Date(pivot.createdAt).toISOString()
      if (pivot.isFeatured) {
        // After a featured item: take non-featured OR featured with earlier createdAt
        query = query.or(
          `isFeatured.eq.false,and(isFeatured.eq.true,createdAt.lt.${ts})`
        )
      } else {
        // After a non-featured item: take non-featured with earlier createdAt
        query = query.eq('isFeatured', false).lt('createdAt', ts)
      }
    }
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const products    = (data ?? []) as any[]
  const hasNextPage = products.length > take
  const page        = hasNextPage ? products.slice(0, take) : products
  const nextCursor  = hasNextPage ? page[page.length - 1].id : null

  return { products: page.map(serializeProduct), nextCursor }
}

/**
 * Categorías para la navegación de la tienda, en orden. Solo las que tienen al
 * menos un producto activo: una categoría vacía lleva al cliente a una página
 * sin nada para comprar. (El panel admin las lista todas por su propia ruta.)
 */
export async function getCategories() {
  const { data, error } = await supabase
    .from('Category')
    .select('id, name, slug, emoji, order, products:Product ( count )')
    .eq('products.isActive', true)
    .order('order', { ascending: true })

  if (error) throw new Error(error.message)
  return ((data ?? []) as any[])
    .filter(c => (c.products?.[0]?.count ?? 0) > 0)
    .map(({ products: _products, ...category }) => category) as
      { id: string; name: string; slug: string; emoji: string | null; order: number }[]
}

/** Una categoría por slug — para metadata de página */
export async function getCategoryBySlug(slug: string) {
  const { data } = await supabase
    .from('Category')
    .select('id, name, slug, emoji')
    .eq('slug', slug)
    .single()
  return data ?? null
}

/** Slugs de todos los productos activos — para generateStaticParams / sitemap */
export async function getActiveProductSlugs() {
  const { data, error } = await supabase
    .from('Product')
    .select('slug, updatedAt')
    .eq('isActive', true)
    .order('updatedAt', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

/** Producto por slug con todos los datos para la página de detalle */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('Product')
    .select(PRODUCT_DETAIL_SELECT)
    .eq('slug', slug)
    .eq('isActive', true)
    .single()

  if (error || !data) return null
  return serializeProduct(data)
}

/** Productos relacionados — misma categoría, excluye el actual */
export async function getRelatedProducts(
  categoryId: string,
  excludeId:  string,
  take = 4
): Promise<Product[]> {
  const { data, error } = await supabase
    .from('Product')
    .select(PRODUCT_CARD_SELECT)
    .eq('categoryId', categoryId)
    .eq('isActive', true)
    .neq('id', excludeId)
    .limit(take)

  if (error) throw new Error(error.message)
  return (data ?? []).map(serializeProduct)
}

/**
 * Pedido por número con todos sus ítems.
 *
 * Va por Prisma (conexión directa del servidor) y no por la anon key: los
 * pedidos tienen datos personales y RLS bloquea su lectura pública.
 */
export async function getOrderByNumber(orderNumber: string) {
  const order = await prisma.order.findUnique({
    where:  { orderNumber },
    select: {
      id: true, orderNumber: true, status: true, paymentMethod: true, paymentStatus: true,
      customerName: true, address: true, phone: true, notes: true, total: true,
      canModifyUntil: true, createdAt: true,
      items: {
        select: {
          id: true, quantity: true, unitPrice: true, variantLabel: true,
          product: { select: { id: true, name: true, images: true, slug: true } },
        },
      },
    },
  })

  if (!order) return null

  return {
    ...order,
    total: Number(order.total),
    items: order.items.map(i => ({ ...i, unitPrice: Number(i.unitPrice) })),
  }
}
