import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getLinkCode, getLinkStatus, resetInstance } from '@/lib/whatsapp-link'
import { getOwnerNumber } from '@/lib/whatsapp'
import { isArgPhone } from '@/lib/validations/checkout'
import { normalizeArgPhone } from '@/lib/phone'
import { setSetting } from '@/lib/site-settings'
import { logger } from '@/lib/logger'

/** Estado del teléfono vinculado y número que recibe los avisos de la tienda. */
export async function GET() {
  const auth = await requireAdmin()
  if (auth.error) return auth.error
  const [status, owner] = await Promise.all([getLinkStatus(), getOwnerNumber()])
  return NextResponse.json({ ...status, owner: owner ? normalizeArgPhone(owner) : null })
}

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('reset') }),
  z.object({ action: z.literal('code'), phone: z.string().trim().max(30).optional() }),
  z.object({ action: z.literal('owner'), phone: z.string().trim().max(30) }),
])

/**
 * reset: desvincula el teléfono actual (WhatsApp deja de salir hasta vincular otro)
 * code:  QR o código de 8 letras para vincular (con `phone`, el código)
 * owner: cambia el número que recibe los avisos de la tienda
 */
export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (auth.error) return auth.error

  const parsed = actionSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  const body = parsed.data

  if ((body.action === 'code' && body.phone) || body.action === 'owner') {
    if (!body.phone || !isArgPhone(body.phone)) {
      return NextResponse.json({ error: 'Ese número no parece de Argentina. Escribilo con código de área, por ejemplo 11 2345-6789.' }, { status: 400 })
    }
  }

  try {
    if (body.action === 'reset') {
      const result = await resetInstance()
      logger.warn('WhatsApp unlinked from panel', { ok: result.ok })
      return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: 502 })
    }
    if (body.action === 'code') {
      const code = await getLinkCode(body.phone)
      return code.error ? NextResponse.json({ error: code.error }, { status: 502 }) : NextResponse.json(code)
    }
    await setSetting('owner_whatsapp', { number: normalizeArgPhone(body.phone) })
    return NextResponse.json({ ok: true, owner: normalizeArgPhone(body.phone) })
  } catch (err) {
    logger.error('WhatsApp panel action failed', { action: body.action, error: String(err) })
    return NextResponse.json({ error: 'El servidor de WhatsApp no responde. Probá de nuevo en un minuto.' }, { status: 502 })
  }
}
