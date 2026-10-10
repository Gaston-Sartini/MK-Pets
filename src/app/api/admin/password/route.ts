import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'
import { passwordChangeSchema, firstIssue } from '@/lib/validations/admin'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error
  const { supabase } = auth

  const rl = rateLimit(`password:${getClientIp(req)}`, { limit: 8, windowMs: 10 * 60 * 1000 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiados intentos. Probá en unos minutos.' }, { status: 429 })
  }

  const parsed = passwordChangeSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 })
  }
  const { currentPassword, newPassword } = parsed.data

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Pedir la contraseña actual evita que alguien que encuentra la sesión abierta
  // (compu compartida, celular prestado) se quede con la cuenta. Se verifica con
  // un cliente aparte, sin cookies, para no pisar la sesión en curso.
  const verifier = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: wrongPassword } = await verifier.auth.signInWithPassword({
    email:    user.email,
    password: currentPassword,
  })
  if (wrongPassword) {
    return NextResponse.json({ error: 'La contraseña actual no es correcta.' }, { status: 403 })
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) {
    const msg = /weak|pwned|leaked|compromised/i.test(error.message)
      ? 'Esa contraseña es muy débil o apareció en filtraciones conocidas. Elegí otra.'
      : `No se pudo cambiar la contraseña: ${error.message}`
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
