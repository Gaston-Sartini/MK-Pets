/**
 * /api/chat — proxy desde el browser al webhook de n8n.
 * Por qué proxy:
 *   - El n8n local corre en :5678 sin CORS habilitado, así que llamarlo desde
 *     el browser daría CORS error. El server-side de Next.js no tiene esa
 *     restricción y puede reachear localhost:5678 directamente.
 *   - Permite agregar timeout, sanitización y logs sin tocar el bot.
 */
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/mk-pets-chat'

interface ChatRequestBody {
  message?:   string
  sessionId?: string
}

const FALLBACK = {
  reply:       'Tuve un problemita 😕 ¿Probás de nuevo?',
  cards:       [],
  suggestions: ['Ver ofertas', 'Algo para perro', 'Algo para gato'],
}

export async function POST(req: Request) {
  let body: ChatRequestBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { ...FALLBACK, reply: 'Mensaje inválido.' },
      { status: 400 },
    )
  }

  const message   = typeof body.message   === 'string' ? body.message.trim()   : ''
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
  if (!message || !sessionId) {
    return NextResponse.json(
      { ...FALLBACK, reply: 'Falta message o sessionId.' },
      { status: 400 },
    )
  }

  const ctrl    = new AbortController()
  const timer   = setTimeout(() => ctrl.abort(), 15_000)
  try {
    const r = await fetch(N8N_WEBHOOK_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
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
