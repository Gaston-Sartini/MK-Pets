'use client'

const STORAGE_KEY = 'mkpets_last_order'
const COOKIE_NAME = 'mkpets_order'
const COOKIE_DAYS = 30

/** Guarda el número de pedido en localStorage y cookie */
export function cacheOrderNumber(orderNumber: string): void {
  if (typeof window === 'undefined') return

  // localStorage — acceso rápido en JS
  try {
    localStorage.setItem(STORAGE_KEY, orderNumber)
  } catch {}

  // Cookie — el middleware puede leerla server-side
  const expires = new Date()
  expires.setDate(expires.getDate() + COOKIE_DAYS)
  document.cookie = [
    `${COOKIE_NAME}=${orderNumber}`,
    `expires=${expires.toUTCString()}`,
    'path=/',
    'SameSite=Lax',
  ].join('; ')
}

/** Lee el número de pedido cacheado */
export function getCachedOrderNumber(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/** Limpia el cache del pedido (llamar cuando el pedido se entrega o cancela) */
export function clearOrderCache(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
  document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
}
