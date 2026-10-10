import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * Un usuario de Supabase Auth es admin SOLO si tiene `app_metadata.role = 'admin'`.
 * `app_metadata` no lo puede editar el propio usuario (a diferencia de `user_metadata`),
 * así que registrarse en el proyecto no alcanza para entrar al panel.
 *
 * Para dar de alta un admin (SQL Editor de Supabase):
 *   update auth.users
 *   set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'
 *   where email = 'persona@ejemplo.com';
 */
export function isAdminUser(user: Pick<User, 'app_metadata'> | null | undefined): boolean {
  return user?.app_metadata?.role === 'admin'
}

/** Cliente de Supabase atado a la sesión (cookies) del request actual. */
async function createSessionClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Los Server Components no pueden escribir cookies; el middleware
            // ya refresca la sesión en cada request a /admin.
          }
        },
      },
    }
  )
}

/**
 * Devuelve el cliente de Supabase del admin logueado, o null si no hay sesión
 * de admin. Las consultas hechas con este cliente corren con el JWT del admin,
 * que es lo que las políticas RLS usan para permitir escrituras.
 */
export async function getAdminClient(): Promise<SupabaseClient | null> {
  const supabase = await createSessionClient()
  // getUser() valida el token contra Supabase — getSession() solo lee la cookie
  const { data: { user } } = await supabase.auth.getUser()
  return isAdminUser(user) ? supabase : null
}

type AdminGuard =
  | { supabase: SupabaseClient; error?: undefined }
  | { supabase?: undefined; error: NextResponse }

/** Para route handlers: devuelve el cliente del admin o una respuesta 401 lista para retornar. */
export async function requireAdmin(): Promise<AdminGuard> {
  const supabase = await getAdminClient()
  if (!supabase) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  }
  return { supabase }
}
