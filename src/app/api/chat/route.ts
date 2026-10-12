/**
 * /api/chat — el chat "vendedor" de la tienda.
 * El motor (src/lib/chat/engine.ts) llama al modelo de IA directo desde el sitio.
 */
import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { isNativeChatConfigured, runChat, sanitizeCart, sanitizeHistory } from '@/lib/chat/engine'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

const MAX_MESSAGE_CHARS = 500

interface ChatRequestBody {
  message?:   string
  sessionId?: string
  history?:   unknown
  cart?:      unknown
}

const FALLBACK = {
  reply:       'Tuve un problemita 😕 ¿Probás de nuevo?',
  cards:       [],
  suggestions: ['Ver ofertas', 'Algo para perro', 'Algo para gato'],
}

/**
 * El control automático del vendedor (scripts/chat-eval.mjs) manda más de 100
 * mensajes seguidos: se identifica con CHAT_EVAL_TOKEN para que no lo frene el
 * límite de uso. El token solo sirve para eso.
 */
function isEvalRun(req: Request): boolean {
  const expected = process.env.CHAT_EVAL_TOKEN
  const given    = req.headers.get('x-chat-eval-token')
  if (!expected || expected.length < 24 || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: Request) {
  // Cada mensaje son 2 llamadas al modelo de IA: sin límite, un script puede
  // agotar la cuota (o la plata) de la API en minutos.
  const rl = isEvalRun(req)
    ? { allowed: true }
    : rateLimit(`chat:${getClientIp(req)}`, { limit: 30, windowMs: 5 * 60 * 1000 })
  if (!rl.allowed) {
    return NextResponse.json(
      { ...FALLBACK, reply: 'Uy, vamos muy rápido 😅 Esperá un minutito y seguimos.', suggestions: [] },
      { status: 429 },
    )
  }

  let body: ChatRequestBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { ...FALLBACK, reply: 'Mensaje inválido.' },
      { status: 400 },
    )
  }

  const message   = typeof body.message   === 'string' ? body.message.trim().slice(0, MAX_MESSAGE_CHARS) : ''
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim().slice(0, 64)              : ''
  if (!message || !/^[\w-]{4,64}$/.test(sessionId)) {
    return NextResponse.json(
      { ...FALLBACK, reply: 'Falta message o sessionId.' },
      { status: 400 },
    )
  }

  // Sin modelo configurado no hay vendedor: se responde con un mensaje amable, no con un error.
  if (!isNativeChatConfigured()) return NextResponse.json(FALLBACK, { status: 200 })

  try {
    return NextResponse.json(await runChat(message, sanitizeHistory(body.history), sanitizeCart(body.cart)))
  } catch (e) {
    logger.error('chat engine failed', { error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json(FALLBACK, { status: 200 })
  }
}
