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

/**
 * Returns the discount percentage off, rounded down (e.g. 22%).
 * Returns null if the discount is not meaningful (< 1%, or original isn't strictly greater).
 */
export function discountPercent(currentPrice: number, originalPrice: number | null): number | null {
  if (originalPrice == null || originalPrice <= currentPrice || currentPrice <= 0) return null
  const off = Math.floor(((originalPrice - currentPrice) / originalPrice) * 100)
  return off >= 1 ? off : null
}

// Sin 0/O/1/I/L para que el número se pueda dictar por teléfono o WhatsApp sin confusiones
const ORDER_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

/**
 * Genera número de pedido: MKP-20260514-7K2M9QHD
 * El número funciona como credencial para ver el pedido (nombre, dirección, teléfono),
 * por eso el sufijo es aleatorio criptográfico y no adivinable.
 */
export function generateOrderNumber(): string {
  const date  = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const bytes = new Uint8Array(8)
  globalThis.crypto.getRandomValues(bytes)
  const code  = Array.from(bytes, b => ORDER_CODE_ALPHABET[b % ORDER_CODE_ALPHABET.length]).join('')
  return `MKP-${date}-${code}`
}

/**
 * Las columnas de fecha son `timestamp without time zone` guardadas en UTC.
 * La API REST de Supabase las devuelve sin sufijo de zona, y `new Date()` las
 * interpretaría como hora local. Esto las fuerza a UTC.
 */
export function parseDbDate(value: Date | string): Date {
  if (value instanceof Date) return value
  return new Date(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(value) ? value : value + 'Z')
}

/** Calcula si un pedido puede modificarse (ventana de 30 minutos) */
export function canModifyOrder(canModifyUntil: Date | string): boolean {
  return parseDbDate(canModifyUntil) > new Date()
}

/** Tiempo restante para modificar el pedido en formato legible */
export function modifyTimeLeft(canModifyUntil: Date | string): string {
  const diff = parseDbDate(canModifyUntil).getTime() - Date.now()
  if (diff <= 0) return '0 min'
  const minutes = Math.ceil(diff / 60000)
  return `${minutes} min`
}
