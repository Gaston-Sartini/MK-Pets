import { z } from 'zod'

/** "" / null / undefined → null; strings numéricos → number. */
const optionalPrice = z.preprocess(
  v => (v === '' || v === null || v === undefined ? null : Number(v)),
  z.number({ invalid_type_error: 'Precio inválido' }).positive('El precio debe ser mayor a 0').max(99_999_999).nullable(),
)

const price = z.preprocess(
  v => Number(v),
  z.number({ invalid_type_error: 'Precio inválido' }).positive('El precio debe ser mayor a 0').max(99_999_999),
)
const stock = z.preprocess(
  v => Number(v),
  z.number({ invalid_type_error: 'Stock inválido' }).int('El stock debe ser un número entero').min(0, 'El stock no puede ser negativo').max(1_000_000),
)

const variantSchema = z.object({
  label:         z.string().trim().min(1).max(100),
  price,
  originalPrice: optionalPrice,
  stock,
}).refine(v => v.originalPrice === null || v.originalPrice > v.price, {
  message: 'El precio antes de una variante debe ser mayor a su precio actual.',
})

export const productSchema = z.object({
  name:          z.string().trim().min(2).max(200),
  slug:          z.string().trim().min(2).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug inválido: solo minúsculas, números y guiones'),
  description:   z.string().max(5000).nullish().transform(v => v?.trim() || null),
  images:        z.array(z.string().trim().min(1).max(1000)).max(10).default([]),
  basePrice:     price,
  originalPrice: optionalPrice,
  stock,
  isActive:      z.boolean().default(true),
  isFeatured:    z.boolean().default(false),
  badge:         z.preprocess(v => v || null, z.enum(['new', 'sale', 'hot']).nullable()),
  categoryId:    z.string().min(1).max(100),
  variants:      z.array(variantSchema).max(30).default([]),
}).refine(p => p.originalPrice === null || p.originalPrice > p.basePrice, {
  message: 'El precio antes debe ser mayor al precio actual.',
})

export const categorySchema = z.object({
  name:  z.string().trim().min(2).max(60),
  emoji: z.string().trim().max(8).nullish().transform(v => v || null),
  order: z.preprocess(v => (v === '' || v === null || v === undefined ? 0 : Number(v)), z.number().int().min(0).max(999)),
})

export const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const
export const orderStatusSchema = z.object({ status: z.enum(ORDER_STATUSES) })

/** Primer mensaje de error legible de un ZodError. */
export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0]
  if (!issue) return 'Datos inválidos'
  const where = issue.path.length ? `${issue.path.join('.')}: ` : ''
  return `${where}${issue.message}`
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
