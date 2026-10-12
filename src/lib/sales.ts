/**
 * Resumen de ventas para el Dashboard. Cuenta todo lo que no está cancelado
 * (un pedido pendiente de pago todavía es una venta en curso).
 */

export interface SaleOrder {
  status: string
  total: number
  createdAt: Date
  items: { name: string; variantLabel: string | null; quantity: number; unitPrice: number }[]
}

export interface SalesWindow { total: number; orders: number }
export interface TopProduct { name: string; units: number; total: number }

export interface SalesSummary {
  today: SalesWindow
  week: SalesWindow
  month: SalesWindow
  top: TopProduct[]
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Día calendario en la zona horaria de la tienda (un pedido de las 23 hs de ayer no es "hoy"). */
const dayIn = (date: Date, timeZone: string) => date.toLocaleDateString('en-CA', { timeZone })

export function summarizeSales(orders: SaleOrder[], now: Date, timeZone: string, topCount = 5): SalesSummary {
  const live  = orders.filter(o => o.status !== 'CANCELLED')
  const today = dayIn(now, timeZone)
  const since = (days: number) => live.filter(o => now.getTime() - o.createdAt.getTime() <= days * DAY_MS)
  const sum   = (list: SaleOrder[]): SalesWindow => ({ total: list.reduce((s, o) => s + o.total, 0), orders: list.length })

  const month = since(30)
  const byProduct = new Map<string, TopProduct>()
  for (const order of month) {
    for (const item of order.items) {
      const name  = `${item.name}${item.variantLabel ? ` (${item.variantLabel})` : ''}`
      const entry = byProduct.get(name) ?? { name, units: 0, total: 0 }
      entry.units += item.quantity
      entry.total += item.quantity * item.unitPrice
      byProduct.set(name, entry)
    }
  }

  return {
    today: sum(live.filter(o => dayIn(o.createdAt, timeZone) === today)),
    week:  sum(since(7)),
    month: sum(month),
    top:   [...byProduct.values()].sort((a, b) => b.units - a.units || b.total - a.total).slice(0, topCount),
  }
}
