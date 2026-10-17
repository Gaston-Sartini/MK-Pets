import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { orderUpdateSchema } from '@/lib/validations/admin'
import { restoreStock } from '@/lib/stock'
import { buildStatusMessage, manualWhatsAppLink, sendWhatsApp, type CustomerUpdate } from '@/lib/whatsapp'
import { logger } from '@/lib/logger'
import { transitionKind } from '@/lib/order-status'

type Outcome =
  | { kind: 'ok'; notify: CustomerUpdate | null; customerName: string; phone: string }
  | { kind: 'notFound' | 'cancelledIsFinal' | 'conflict' | 'badTransition' }

// Estados que el cliente quiere enterarse por WhatsApp
const NOTIFY_ON_STATUS: Partial<Record<string, CustomerUpdate>> = {
  PREPARING: 'PREPARING',
  SHIPPED:   'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
}

/**
 * Cambia el estado del pedido (`status`) o marca el pago como recibido / pendiente
 * (`paymentStatus`). Marcar el pago como recibido confirma un pedido pendiente.
 */
export async function PUT(req: Request, props: { params: Promise<{ numero: string }> }) {
  const params = await props.params
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const parsed = orderUpdateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }
  const { status, paymentStatus } = parsed.data

  let outcome: Outcome
  try {
    outcome = await prisma.$transaction(async (tx): Promise<Outcome> => {
      const order = await tx.order.findUnique({
        where:  { orderNumber: params.numero },
        select: {
          id: true, status: true, paymentStatus: true, customerName: true, phone: true,
          items: { select: { productId: true, variantLabel: true, quantity: true } },
        },
      })
      if (!order) return { kind: 'notFound' }

      const done = (notify: CustomerUpdate | null): Outcome =>
        ({ kind: 'ok', notify, customerName: order.customerName, phone: order.phone })

      // Un pedido cancelado ya devolvió su stock: reabrirlo lo vendería dos veces.
      if (order.status === 'CANCELLED') return { kind: 'cancelledIsFinal' }

      if (paymentStatus) {
        if (order.paymentStatus === paymentStatus) return done(null)
        const confirms = paymentStatus === 'APPROVED' && order.status === 'PENDING'
        const updated  = await tx.order.updateMany({
          where: { id: order.id, paymentStatus: order.paymentStatus },
          data:  { paymentStatus, ...(confirms && { status: 'CONFIRMED' as const }) },
        })
        if (updated.count === 0) return { kind: 'conflict' }
        return done(paymentStatus === 'APPROVED' ? 'PAYMENT_RECEIVED' : null)
      }

      if (!status || order.status === status) return done(null)

      // Se avanza libremente y se puede volver un paso para corregir un clic equivocado.
      // Saltos hacia atrás (de Entregado a Pendiente) no: confunden el historial.
      const kind = transitionKind(order.status, status)
      if (kind === 'invalid') return { kind: 'badTransition' }

      // El guard en el WHERE evita devolver stock dos veces si llegan dos
      // cancelaciones simultáneas (doble click, dos pestañas).
      const updated = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data:  { status },
      })
      if (updated.count === 0) return { kind: 'conflict' }

      if (status === 'CANCELLED') await restoreStock(tx, order.items)
      // Volver un paso es una corrección interna: al cliente no se le manda nada
      return done(kind === 'back' ? null : NOTIFY_ON_STATUS[status] ?? null)
    })
  } catch (err) {
    logger.error('Error updating order', { error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: 'No se pudo actualizar el pedido' }, { status: 500 })
  }

  if (outcome.kind !== 'ok') {
    const failure = {
      notFound:         { status: 404, error: 'Pedido no encontrado' },
      cancelledIsFinal: { status: 409, error: 'El pedido está cancelado y su stock ya fue devuelto. Si el cliente lo quiere igual, que haga un pedido nuevo.' },
      conflict:         { status: 409, error: 'El pedido cambió mientras lo editabas. Recargá la página.' },
      badTransition:    { status: 409, error: 'Ese cambio de estado no se puede hacer: solo se avanza, o se vuelve un paso para corregir.' },
    }[outcome.kind]
    return NextResponse.json({ error: failure.error }, { status: failure.status })
  }

  // Fuera de la transacción: un WhatsApp caído no debe revertir el cambio.
  // Si no sale solo, el panel ofrece mandarlo a mano desde el WhatsApp de la tienda.
  let notified = false
  let manualLink: string | null = null
  if (outcome.notify) {
    const text = buildStatusMessage(outcome.notify, { orderNumber: params.numero, customerName: outcome.customerName })
    notified = await sendWhatsApp(outcome.phone, text, { orderNumber: params.numero, update: outcome.notify })
    if (!notified) manualLink = manualWhatsAppLink(outcome.phone, text)
  }

  return NextResponse.json({ ok: true, notified, manualLink })
}
