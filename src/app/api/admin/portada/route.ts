import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { heroSchema } from '@/lib/site-content'
import { getHeroContent, setSetting } from '@/lib/site-settings'
import { logger } from '@/lib/logger'

/** Textos e imagen de la portada, tal como se ven hoy. */
export async function GET() {
  const auth = await requireAdmin()
  if (auth.error) return auth.error
  return NextResponse.json(await getHeroContent())
}

/** Guarda la portada y la publica enseguida (sin esperar a que venza la caché). */
export async function PUT(req: Request) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const parsed = heroSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
  }

  try {
    await setSetting('hero', parsed.data)
  } catch (err) {
    logger.error('Hero save failed', { error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: 'No se pudo guardar. Probá de nuevo en un rato.' }, { status: 500 })
  }

  revalidatePath('/')
  return NextResponse.json({ ok: true })
}
