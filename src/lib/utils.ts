import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Formatea número como precio ARS: 4800 → "$4.800" */
export function formatPrice(amount: number | string): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount
  return `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
}

/** Genera número de pedido único: MKP-20260514-4821 */
export function generateOrderNumber(): string {
  const date  = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const rand  = Math.floor(1000 + Math.random() * 9000)
  return `MKP-${date}-${rand}`
}

/** Calcula si un pedido puede modificarse (ventana de 30 minutos) */
export function canModifyOrder(canModifyUntil: Date | string): boolean {
  return new Date(canModifyUntil) > new Date()
}

/** Tiempo restante para modificar el pedido en formato legible */
export function modifyTimeLeft(canModifyUntil: Date | string): string {
  const diff = new Date(canModifyUntil).getTime() - Date.now()
  if (diff <= 0) return '0 min'
  const minutes = Math.ceil(diff / 60000)
  return `${minutes} min`
}
