import { NextResponse, type NextRequest } from 'next/server'

async function isValidSession(token: string): Promise<boolean> {
  const secret = process.env.SESSION_SECRET
  if (!secret || !token) return false

  const lastDot = token.lastIndexOf('.')
  if (lastDot === -1) return false

  const payload = token.slice(0, lastDot)
  const sig     = token.slice(lastDot + 1)

  try {
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['sign']
    )
    const buf = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
    const computed = Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    return computed === sig
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname === '/admin/login') return NextResponse.next()

  if (pathname.startsWith('/admin')) {
    const token = request.cookies.get('admin_session')?.value ?? ''
    const valid = await isValidSession(token)
    if (!valid) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
