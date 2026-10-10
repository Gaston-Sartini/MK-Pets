/**
 * Fixed-window in-memory rate limiter.
 *
 * OJO en serverless (Netlify/Vercel): cada instancia de la función tiene su
 * propio Map, así que el límite es "por instancia caliente" y no global. Frena
 * abusos simples (un script en loop pega casi siempre en la misma instancia)
 * pero no es una garantía. Para un límite real, cambiar el Map por Upstash Redis.
 */

interface Window {
  count:     number
  resetAt:   number
}

const store = new Map<string, Window>()

// Cleanup old entries every 5 minutes to prevent memory leaks
const cleanup = setInterval(() => {
  const now = Date.now()
  for (const [key, win] of store.entries()) {
    if (win.resetAt < now) store.delete(key)
  }
}, 5 * 60 * 1000)
// No mantener vivo el proceso (tests, scripts) solo por esta limpieza
cleanup.unref?.()

export interface RateLimitResult {
  allowed:    boolean
  remaining:  number
  resetAt:    number
}

export function rateLimit(
  identifier: string,
  opts: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now()
  const existing = store.get(identifier)

  if (!existing || existing.resetAt < now) {
    store.set(identifier, { count: 1, resetAt: now + opts.windowMs })
    return { allowed: true, remaining: opts.limit - 1, resetAt: now + opts.windowMs }
  }

  existing.count++
  const allowed   = existing.count <= opts.limit
  const remaining = Math.max(0, opts.limit - existing.count)
  return { allowed, remaining, resetAt: existing.resetAt }
}

/** Extract a safe IP identifier from the request */
export function getClientIp(request: Request): string {
  const headers = request.headers as Headers
  // Netlify pone la IP real acá; x-forwarded-for lo puede inventar el cliente.
  const netlifyIp = headers.get('x-nf-client-connection-ip')
  if (netlifyIp) return netlifyIp.trim()
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return 'unknown'
}
