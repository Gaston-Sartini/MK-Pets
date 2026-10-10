import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { notifyOrderWhatsApp } from '@/lib/whatsapp'

export type SyncResult =
  | { ok: true;  applied: boolean }
  | { ok: false; reason: 'mp_unreachable' | 'invalid_id' }

type PaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFUNDED'

function mapMpStatus(mpStatus: string): PaymentStatus {
  switch (mpStatus) {
    case 'approved':     return 'APPROVED'
    case 'rejected':
    case 'cancelled':    return 'REJECTED'
    case 'refunded':
    case 'charged_back': return 'REFUNDED'
    default:             return 'PENDING'   // pending, in_process, authorized, in_mediation
  }
}

/**
 * Consulta un pago en la API de MercadoPago y refleja su estado en el pedido.
 *
 * Es la única fuente de verdad sobre pagos: nunca se confía en lo que diga el
 * body de un webhook ni los parámetros de la URL de retorno — solo el ID, que
 * se usa para pedirle el pago a MP con nuestro access token. Por eso es seguro
 * llamarla tanto desde el webhook como desde la página de retorno, y es
 * idempotente (MP reintenta webhooks y los manda duplicados).
 */
export async function syncMpPayment(paymentId: string): Promise<SyncResult> {
  if (!/^\d{1,20}$/.test(paymentId)) return { ok: false, reason: 'invalid_id' }

  let payment: {
    status?: string
    external_reference?: string
    transaction_amount?: number
    currency_id?: string
  }
  try {
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
      signal:  AbortSignal.timeout(8000),
      cache:   'no-store',
    })
    if (!res.ok) {
      logger.error('MP API error fetching payment', { paymentId, status: res.status })
      return { ok: false, reason: 'mp_unreachable' }
    }
    payment = await res.json()
  } catch (err) {
    logger.error('MP API unreachable', { paymentId, error: String(err) })
    return { ok: false, reason: 'mp_unreachable' }
  }

  const orderNumber = payment.external_reference
  if (!orderNumber) return { ok: true, applied: false }

  const order = await prisma.order.findUnique({
    where:  { orderNumber },
    select: { status: true, paymentStatus: true, total: true },
  })
  if (!order) return { ok: true, applied: false }

  const paymentStatus = mapMpStatus(payment.status ?? '')

  // Un pago aprobado solo puede pasar a reembolsado; un rechazo tardío de otro
  // intento (tarjeta rechazada antes de la que sí pasó) no lo pisa.
  if (order.paymentStatus === 'APPROVED' && paymentStatus !== 'REFUNDED') {
    return { ok: true, applied: false }
  }
  if (order.paymentStatus === paymentStatus) return { ok: true, applied: false }

  if (paymentStatus === 'APPROVED') {
    const paid = Number(payment.transaction_amount ?? 0)
    if (payment.currency_id !== 'ARS' || paid + 0.01 < Number(order.total)) {
      // Pago real pero por menos de lo que vale el pedido: no se confirma solo.
      logger.error('MP payment amount mismatch — order NOT confirmed', {
        orderNumber, paymentId, paid, expected: Number(order.total), currency: payment.currency_id,
      })
      return { ok: true, applied: false }
    }
  }

  // El `paymentStatus: { not }` en el WHERE hace que, ante dos webhooks
  // simultáneos, solo uno aplique el cambio (y mande el WhatsApp).
  const updated = await prisma.order.updateMany({
    where: { orderNumber, paymentStatus: { not: paymentStatus } },
    data: {
      paymentStatus,
      mpPaymentId: paymentId,
      // Solo avanza PENDING → CONFIRMED; nunca toca un pedido ya en preparación o cancelado.
      ...(paymentStatus === 'APPROVED' && order.status === 'PENDING' && { status: 'CONFIRMED' as const }),
    },
  })
  if (updated.count === 0) return { ok: true, applied: false }

  if (paymentStatus === 'APPROVED') {
    if (order.status === 'CANCELLED') {
      logger.error('MP payment approved for a CANCELLED order — needs manual review', { orderNumber, paymentId })
    }
    await notifyApprovedPayment(orderNumber)
  }

  return { ok: true, applied: true }
}

async function notifyApprovedPayment(orderNumber: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where:  { orderNumber },
    select: {
      customerName: true,
      phone:        true,
      total:        true,
      notes:        true,
      items: {
        select: {
          quantity:     true,
          unitPrice:    true,
          variantLabel: true,
          product:      { select: { name: true } },
        },
      },
    },
  })
  if (!order) return

  await notifyOrderWhatsApp({
    orderNumber,
    customerName:     order.customerName,
    phone:            order.phone,
    total:            Number(order.total),
    notes:            order.notes,
    paymentMethod:    'MERCADOPAGO',
    isPendingPayment: false,
    items: order.items.map(i => ({
      name:         i.product.name,
      variantLabel: i.variantLabel,
      quantity:     i.quantity,
      unitPrice:    Number(i.unitPrice),
    })),
  })
}
