import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import crypto from 'crypto'

/** Lightweight HMAC verification — avoids importing the full session lib in Edge runtime */
function isValidAdminSession(token: string): boolean {
  const secret = process.env.SESSION_SECRET ?? ''
  if (!secret || !token) return false

  const lastDot = token.lastIndexOf('.')
  if (lastDot === -1) return false

  const payload  = token.slice(0, lastDot)
  const sig      = token.slice(lastDot + 1)
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'))
  } catch {
    return false
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/admin')) {
    // Exclude the login page itself from the check
    if (pathname === '/admin/login') return NextResponse.next()

    const sessionToken = request.cookies.get('mkpets_admin_session')?.value ?? ''

    // SECURITY: validate the token's HMAC signature, not just its existence
    if (!isValidAdminSession(sessionToken)) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
