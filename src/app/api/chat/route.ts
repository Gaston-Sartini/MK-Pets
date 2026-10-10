/**
 * /api/chat — el chat "vendedor" de la tienda.
 *
 * Dos motores posibles:
 *   - nativo (default si hay LLM_API_KEY): src/lib/chat/engine.ts llama al modelo
 *     directo desde el sitio. No necesita ningún servidor aparte.
 *   - n8n (CHAT_ENGINE=n8n, o si no hay LLM_API_KEY): reenvía al webhook de n8n.
 *     Requiere tener n8n corriendo 24/7 y accesible desde internet.
 */
import { NextResponse } from 'next/server'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { isNativeChatConfigured, runChat, sanitizeHistory } from '@/lib/chat/engine'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

// CHAT_VERSION: 'v1' | 'v2' | 'v3' (Gemini OpenAI-compat)
// Default: v2. Cambiar CHAT_VERSION en .env para elegir versión.
const CHAT_VERSION = process.env.CHAT_VERSION || process.env.NEXT_PUBLIC_CHAT_VERSION || 'v2'

const VERSION_SUFFIX: Record<string, string> = { v1: '', v2: '-v2', v3: '-v3' }
const suffix = VERSION_SUFFIX[CHAT_VERSION] ?? '-v2'

const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  `http://localhost:5678/webhook/mk-pets-chat${suffix}`

const MAX_MESSAGE_CHARS = 500

interface ChatRequestBody {
  message?:   string
  sessionId?: string
  history?:   unknown
}

const FALLBACK = {
  reply:       'Tuve un problemita 😕 ¿Probás de nuevo?',
  cards:       [],
  suggestions: ['Ver ofertas', 'Algo para perro', 'Algo para gato'],
}

export async function POST(req: Request) {
  // Cada mensaje son 2 llamadas al modelo de IA: sin límite, un script puede
  // agotar la cuota (o la plata) de la API en minutos.
  const rl = rateLimit(`chat:${getClientIp(req)}`, { limit: 30, windowMs: 5 * 60 * 1000 })
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

  if (process.env.CHAT_ENGINE !== 'n8n' && isNativeChatConfigured()) {
    try {
      return NextResponse.json(await runChat(message, sanitizeHistory(body.history)))
    } catch (e) {
      logger.error('chat engine failed', { error: e instanceof Error ? e.message : String(e) })
      return NextResponse.json(FALLBACK, { status: 200 })
    }
  }

  const ctrl    = new AbortController()
  const timer   = setTimeout(() => ctrl.abort(), 15_000)
  try {
    const r = await fetch(N8N_WEBHOOK_URL, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.N8N_WEBHOOK_SECRET && { 'x-mkpets-secret': process.env.N8N_WEBHOOK_SECRET }),
      },
      body:    JSON.stringify({ message, sessionId }),
      signal:  ctrl.signal,
      cache:   'no-store',
    })
    clearTimeout(timer)
    if (!r.ok) {
      console.error('[api/chat] n8n returned', r.status)
      return NextResponse.json(FALLBACK, { status: 200 })
    }
    const data = await r.json().catch(() => null)
    if (!data || typeof data !== 'object') {
      return NextResponse.json(FALLBACK, { status: 200 })
    }
    return NextResponse.json(data, { status: 200 })
  } catch (e) {
    clearTimeout(timer)
    console.error('[api/chat] fetch failed:', e instanceof Error ? e.message : e)
    return NextResponse.json(FALLBACK, { status: 200 })
  }
}
