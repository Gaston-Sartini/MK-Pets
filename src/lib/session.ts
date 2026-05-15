import crypto from 'crypto'

const SESSION_SECRET = process.env.SESSION_SECRET ?? ''

/** Signs a payload with HMAC-SHA256 → `payload.signature` */
export function signSession(payload: string): string {
  if (!SESSION_SECRET) throw new Error('SESSION_SECRET not configured')
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex')
  return `${payload}.${sig}`
}

/** Returns the payload if the token is valid, null otherwise */
export function verifySession(token: string): string | null {
  if (!SESSION_SECRET || !token) return null
  const lastDot = token.lastIndexOf('.')
  if (lastDot === -1) return null

  const payload = token.slice(0, lastDot)
  const sig     = token.slice(lastDot + 1)
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex')

  try {
    if (!crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'))) {
      return null
    }
  } catch {
    return null
  }

  return payload
}
