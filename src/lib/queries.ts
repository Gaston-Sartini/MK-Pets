/**
 * MK-Pets — Query helpers optimizados
 * DB Optimizer: select explícito (nunca SELECT *), includes mínimos,
 * sin N+1, con paginación por cursor para catálogos grandes.
 */

import { prisma } from './prisma'
import type { Product } from '@/types'

// Campos mínimos para la ProductCard (evita traer description, etc.)
const PRODUCT_CARD_SELECT = {
  id:         true,
  name:       true,
  slug:       true,
  images:     true,
  basePrice:  true,
  badge:      true,
  isFeatured: true,
  stock:      true,
  category: { select: { id: true, name: true, slug: true, emoji: true } },
  variants: { select: { id: true, label: true, price: true, stock: true } },
} as const

// Convierte Decimal de Prisma a number (necesario para serialización JSON)
function serializeProduct(p: any): Product {
  return {
    ...p,
    basePrice: Number(p.basePrice),
    badge: p.badge as Product['badge'],
    variants: p.variants.map((v: any) => ({ ...v, price: Number(v.price) })),
  }
}

/** Productos destacados para la home — máximo 8 */
export async function getFeaturedProducts(): Promise<Product[]> {
  const products = await prisma.product.findMany({
    where:   { isFeatured: true, isActive: true },
    select:  PRODUCT_CARD_SELECT,
    orderBy: { createdAt: 'desc' },
    take:    8,
  })
  return products.map(serializeProduct)
}

/** Productos de una categoría — máximo configurable */
export async function getProductsByCategory(
  categorySlug: string,
  take = 4
): Promise<Product[]> {
  const products = await prisma.product.findMany({
    where:   { category: { slug: categorySlug }, isActive: true },
    select:  PRODUCT_CARD_SELECT,
    orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
    take,
  })
  return products.map(serializeProduct)
}

/**
 * Catálogo con filtro y paginación por cursor.
 * Cursor-based >> offset-based para catálogos grandes.
 */
export async function getProducts(opts: {
  categorySlug?: string
  search?:       string
  cursor?:       string   // último id de la página anterior
  take?:         number
}): Promise<{ products: Product[]; nextCursor: string | null }> {
  const { categorySlug, search, cursor, take = 20 } = opts

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(categorySlug && { category: { slug: categorySlug } }),
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
    },
    select:  PRODUCT_CARD_SELECT,
    orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
    take:    take + 1,   // pedir uno más para saber si hay siguiente página
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  })

  const hasNextPage = products.length > take
  const page        = hasNextPage ? products.slice(0, take) : products
  const nextCursor  = hasNextPage ? page[page.length - 1].id : null

  return { products: page.map(serializeProduct), nextCursor }
}

/** Producto por slug con todos los datos para la página de detalle */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  const p = await prisma.product.findUnique({
    where:  { slug, isActive: true },
    select: {
      ...PRODUCT_CARD_SELECT,
      description: true,
    },
  })
  if (!p) return null
  return serializeProduct(p)
}

/** Productos relacionados — misma categoría, excluye el actual */
export async function getRelatedProducts(
  categoryId: string,
  excludeId:  string,
  take = 4
): Promise<Product[]> {
  const products = await prisma.product.findMany({
    where:   { categoryId, isActive: true, id: { not: excludeId } },
    select:  PRODUCT_CARD_SELECT,
    take,
  })
  return products.map(serializeProduct)
}

/**
 * Pedido por número con todos sus ítems.
 * Una sola query — no hay N+1.
 */
export async function getOrderByNumber(orderNumber: string) {
  const order = await prisma.order.findUnique({
    where:  { orderNumber },
    select: {
      id:            true,
      orderNumber:   true,
      status:        true,
      paymentMethod: true,
      paymentStatus: true,
      customerName:  true,
      address:       true,
      phone:         true,
      notes:         true,
      total:         true,
      canModifyUntil:true,
      createdAt:     true,
      items: {
        select: {
          id:          true,
          quantity:    true,
          unitPrice:   true,
          variantLabel:true,
          product: {
            select: { id: true, name: true, images: true, slug: true },
          },
        },
      },
    },
  })

  if (!order) return null

  return {
    ...order,
    total:          Number(order.total),
    canModifyUntil: order.canModifyUntil.toISOString(),
    createdAt:      order.createdAt.toISOString(),
    items: order.items.map(i => ({
      id:           i.id,
      quantity:     i.quantity,
      unitPrice:    Number(i.unitPrice),
      variantLabel: i.variantLabel,
      product: {
        id:     i.product.id,
        name:   i.product.name,
        images: i.product.images,
        slug:   i.product.slug,
      },
    })),
  }
}
