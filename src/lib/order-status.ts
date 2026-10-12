/**
 * Recorrido de un pedido y qué cambios de estado se permiten desde el panel.
 *
 * Antes se podía pasar de cualquier estado a cualquier otro (de "Entregado" a
 * "Pendiente", por ejemplo) y cada cambio le mandaba un WhatsApp al cliente.
 * Ahora: se avanza libremente, se puede volver UN paso para corregir un clic
 * equivocado (sin avisarle a nadie), y cancelar es definitivo.
 */

export const ORDER_FLOW = ['PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED'] as const
export type OrderStatus = (typeof ORDER_FLOW)[number] | 'CANCELLED'

const rank = (status: string) => ORDER_FLOW.indexOf(status as (typeof ORDER_FLOW)[number])

export type Transition = 'same' | 'forward' | 'back' | 'cancel' | 'invalid'

export function transitionKind(from: string, to: string): Transition {
  if (from === to) return 'same'
  if (from === 'CANCELLED') return 'invalid'
  if (to === 'CANCELLED') return 'cancel'
  const a = rank(from), b = rank(to)
  if (a === -1 || b === -1) return 'invalid'
  if (b > a) return 'forward'
  return a - b === 1 ? 'back' : 'invalid'
}

/** Estados que el panel ofrece para un pedido, en el orden en que se muestran. */
export function allowedStatuses(from: string): string[] {
  if (from === 'CANCELLED') return ['CANCELLED']
  const a = rank(from)
  if (a === -1) return [from]
  return [...ORDER_FLOW.slice(Math.max(0, a - 1)), 'CANCELLED']
}
