import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { ROUND_OPTIONS, matchesPriceFilter, priceChanges, type PricedProduct, type RoundTo } from '@/lib/pricing'

const schema = z.object({
  categoryId: z.string().max(40).default(''),
  text:       z.string().max(60).default(''),
  percent:    z.number().min(-90).max(500).refine(v => v !== 0, 'El porcentaje no puede ser 0'),
  roundTo:    z.number().refine((v): v is RoundTo => (ROUND_OPTIONS as readonly number[]).includes(v)),
  // Cuántos precios vio el dueño en la vista previa: si mientras tanto cambió el catálogo, no se aplica a ciegas
  expected:   z.number().int().min(1),
})

/**
 * Aumento (o rebaja) masivo de precios. Recalcula todo en el servidor con la misma
 * cuenta que la vista previa y lo guarda en una sola transacción: o cambian todos
 * los precios o no cambia ninguno.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
  }
  const { categoryId, text, percent, roundTo, expected } = parsed.data

  try {
    const rows = await prisma.product.findMany({
      select: {
        id: true, name: true, categoryId: true, basePrice: true, originalPrice: true,
        variants: { select: { id: true, label: true, price: true, originalPrice: true } },
      },
    })

    const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))
    const products: PricedProduct[] = rows
      .map(p => ({
        id: p.id, name: p.name, categoryId: p.categoryId,
        basePrice: Number(p.basePrice), originalPrice: num(p.originalPrice),
        variants: p.variants.map(v => ({ label: v.label, price: Number(v.price), originalPrice: num(v.originalPrice) })),
      }))
      .filter(p => matchesPriceFilter(p, categoryId, text))

    const changes = priceChanges(products, percent, roundTo)
    if (changes.length !== expected) {
      return NextResponse.json(
        { error: 'El catálogo cambió desde que armaste la vista previa. Revisala de nuevo antes de aplicar.' },
        { status: 409 },
      )
    }

    const variantId = new Map(rows.flatMap(p => p.variants.map(v => [`${p.id}:${v.label}`, v.id] as const)))

    await prisma.$transaction(async (tx) => {
      for (const c of changes) {
        const data = { ...(c.originalAfter !== null ? { originalPrice: c.originalAfter } : {}) }
        if (c.variantLabel === null) {
          await tx.product.update({ where: { id: c.productId }, data: { basePrice: c.after, ...data } })
        } else {
          await tx.productVariant.update({ where: { id: variantId.get(`${c.productId}:${c.variantLabel}`)! }, data: { price: c.after, ...data } })
        }
      }
      // El precio "base" de un producto con variantes es el de su variante más barata: es el que muestra el panel
      for (const p of products.filter(x => x.variants.length > 0)) {
        const cheapest = Math.min(...changes.filter(c => c.productId === p.id).map(c => c.after))
        await tx.product.update({ where: { id: p.id }, data: { basePrice: cheapest } })
      }
    }, { timeout: 30_000 })

    logger.info('Bulk price change applied', { percent, roundTo, categoryId, text, prices: changes.length })
    revalidatePath('/', 'layout')
    return NextResponse.json({ ok: true, updated: changes.length })
  } catch (err) {
    logger.error('Error applying bulk price change', { error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: 'No se pudieron actualizar los precios. No se cambió ninguno.' }, { status: 500 })
  }
}
