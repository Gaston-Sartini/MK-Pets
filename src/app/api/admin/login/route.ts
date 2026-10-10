import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { isAdminUser } from '@/lib/admin-auth'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(req: Request) {
  // Frena fuerza bruta básica. Supabase Auth aplica además su propio límite por IP.
  const rl = rateLimit(`login:${getClientIp(req)}`, { limit: 10, windowMs: 10 * 60 * 1000 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiados intentos. Probá en unos minutos.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const email    = typeof body?.email    === 'string' ? body.email.trim() : ''
  const password = typeof body?.password === 'string' ? body.password     : ''

  if (!email || !password) {
    return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 })
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
  }

  // Cuenta válida pero sin rol admin: cerramos la sesión recién creada y
  // respondemos igual que con credenciales malas para no revelar qué cuentas existen.
  if (!isAdminUser(data.user)) {
    await supabase.auth.signOut()
    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
  }

  return NextResponse.json({ ok: true })
}
