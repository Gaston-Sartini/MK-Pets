/**
 * Sliding-window in-memory rate limiter.
 * Works for single-instance dev; swap for Upstash Redis in production
 * by replacing the Map with Redis ZADD/ZCOUNT.
 */

interface Window {
  count:     number
  resetAt:   number
}

const store = new Map<string, Window>()

// Cleanup old entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now()
  for (const [key, win] of store.entries()) {
    if (win.resetAt < now) store.delete(key)
  }
}, 5 * 60 * 1000)

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
  const forwarded = (request.headers as Headers).get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return 'unknown'
}
