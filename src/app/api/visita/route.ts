import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { countablePath } from '@/lib/visits'

export const runtime = 'nodejs'

const BOT = /bot|crawl|spider|slurp|preview|lighthouse|headless|monitor|curl|wget|python|node-fetch/i

/**
 * Cuenta una visita a una página: fecha, ruta y nada más. Sin cookies, sin IP
 * guardada, sin identificar a nadie. La llama el propio sitio al navegar.
 */
export async function POST(req: Request) {
  if (BOT.test(req.headers.get('user-agent') ?? '')) return new NextResponse(null, { status: 204 })

  // Una persona no ve 120 páginas en 5 minutos: eso es un script inflando los números
  if (!rateLimit(`visit:${getClientIp(req)}`, { limit: 120, windowMs: 5 * 60 * 1000 }).allowed) {
    return new NextResponse(null, { status: 204 })
  }

  const body = await req.json().catch(() => null)
  const path = countablePath(body?.path)
  if (!path) return new NextResponse(null, { status: 204 })

  try {
    await prisma.$executeRaw`
      insert into public."PageView" (day, path, views)
      values ((now() at time zone 'America/Argentina/Buenos_Aires')::date, ${path}, 1)
      on conflict (day, path) do update set views = public."PageView".views + 1`
  } catch {
    // Las estadísticas nunca tienen que romper la navegación
  }
  return new NextResponse(null, { status: 204 })
}
