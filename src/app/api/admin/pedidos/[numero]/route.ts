import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { orderStatusSchema } from '@/lib/validations/admin'
import { restoreStock } from '@/lib/stock'
import { logger } from '@/lib/logger'

export async function PUT(req: Request, { params }: { params: { numero: string } }) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const parsed = orderStatusSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  }
  const { status } = parsed.data

  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where:  { orderNumber: params.numero },
        select: {
          id:     true,
          status: true,
          items:  { select: { productId: true, variantLabel: true, quantity: true } },
        },
      })
      if (!order) return { notFound: true as const }
      if (order.status === status) return { ok: true as const }

      // Un pedido cancelado ya devolvió su stock: reabrirlo lo vendería dos veces.
      if (order.status === 'CANCELLED') return { cancelledIsFinal: true as const }

      // El guard en el WHERE evita devolver stock dos veces si llegan dos
      // cancelaciones simultáneas (doble click, dos pestañas).
      const updated = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data:  { status },
      })
      if (updated.count === 0) return { conflict: true as const }

      if (status === 'CANCELLED') await restoreStock(tx, order.items)
      return { ok: true as const }
    })

    if ('notFound' in result) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    }
    if ('cancelledIsFinal' in result) {
      return NextResponse.json(
        { error: 'El pedido está cancelado y su stock ya fue devuelto. Si el cliente lo quiere igual, que haga un pedido nuevo.' },
        { status: 409 },
      )
    }
    if ('conflict' in result) {
      return NextResponse.json({ error: 'El pedido cambió mientras lo editabas. Recargá la página.' }, { status: 409 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.error('Error updating order status', { error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: 'No se pudo actualizar el pedido' }, { status: 500 })
  }
}
