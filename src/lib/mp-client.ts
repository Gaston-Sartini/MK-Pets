'use client'

/**
 * Pide la preferencia de pago del pedido y redirige al checkout de MercadoPago.
 * Lanza si no se pudo iniciar el pago (el pedido ya existe: se puede reintentar
 * desde la página del pedido).
 */
export async function startMpCheckout(orderNumber: string): Promise<void> {
  const res = await fetch('/api/pagos/crear-preferencia', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ orderNumber }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'No se pudo iniciar el pago con MercadoPago')

  const redirectUrl = process.env.NODE_ENV === 'production'
    ? data.initPoint
    : (data.sandboxUrl || data.initPoint)
  if (!redirectUrl) throw new Error('MercadoPago no devolvió un link de pago')

  window.location.href = redirectUrl
}
