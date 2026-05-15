import { cookies } from 'next/headers'
import { verifySession } from './session'
import { NextResponse } from 'next/server'

/** Returns 401 response if admin session cookie is invalid. Use in API routes. */
export function requireAdmin(): { error: NextResponse } | null {
  const token = cookies().get('admin_session')?.value ?? ''
  const payload = verifySession(token)
  if (!payload) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  }
  return null
}
