import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'
import { POST } from '@/app/api/webhooks/mercadopago/route'
import { prisma } from '@/lib/prisma'

// ─── helpers ────────────────────────────────────────────────────────────────

const SECRET = process.env.MP_WEBHOOK_SECRET!

function sign(body: string): string {
  return crypto.createHmac('sha256', SECRET).update(body).digest('hex')
}

function makeWebhookRequest(payload: unknown, signature?: string) {
  const body = JSON.stringify(payload)
  const sig  = signature ?? sign(body)
  return new Request('http://localhost/api/webhooks/mercadopago', {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-signature':  sig,
    },
    body,
  })
}

const APPROVED_PAYMENT = {
  status:             'approved',
  external_reference: 'MKP-20260514-0001',
}

// ─── Webhook tests ───────────────────────────────────────────────────────────

describe('POST /api/webhooks/mercadopago', () => {
  beforeEach(() => {
    vi.mocked(prisma.order.update).mockResolvedValue({} as any)

    global.fetch = vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => APPROVED_PAYMENT,
    } as any)
  })

  // ── SECURITY: signature verification ────────────────────────────────────

  it('returns 401 for invalid HMAC signature', async () => {
    const res = await POST(makeWebhookRequest(
      { type: 'payment', data: { id: '12345' } },
      'invalid-signature-hex'
    ))
    expect(res.status).toBe(401)
  })

  it('returns 500 (fail-closed) when MP_WEBHOOK_SECRET is not set', async () => {
    const original = process.env.MP_WEBHOOK_SECRET
    delete process.env.MP_WEBHOOK_SECRET

    const res = await POST(makeWebhookRequest({ type: 'payment', data: { id: '12345' } }))
    expect(res.status).toBe(500)

    process.env.MP_WEBHOOK_SECRET = original
  })

  it('accepts request with valid HMAC signature', async () => {
    const res = await POST(makeWebhookRequest({ type: 'payment', data: { id: '12345' } }))
    expect(res.status).toBe(200)
  })

  // ── Payment processing ───────────────────────────────────────────────────

  it('updates order to CONFIRMED and APPROVED on approved payment', async () => {
    await POST(makeWebhookRequest({ type: 'payment', data: { id: '12345' } }))

    expect(vi.mocked(prisma.order.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status:        'CONFIRMED',
          paymentStatus: 'APPROVED',
        }),
      })
    )
  })

  it('keeps order PENDING on rejected payment', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok:   true,
      json: async () => ({ status: 'rejected', external_reference: 'MKP-20260514-0001' }),
    } as any)

    await POST(makeWebhookRequest({ type: 'payment', data: { id: '12345' } }))

    expect(vi.mocked(prisma.order.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentStatus: 'REJECTED' }),
      })
    )
  })

  it('ignores non-payment webhook types silently (returns 200)', async () => {
    const res = await POST(makeWebhookRequest({ type: 'merchant_order', data: { id: '99' } }))
    expect(res.status).toBe(200)
    expect(vi.mocked(prisma.order.update)).not.toHaveBeenCalled()
  })

  it('returns 400 for malformed JSON body', async () => {
    const req = new Request('http://localhost/api/webhooks/mercadopago', {
      method:  'POST',
      headers: { 'x-signature': sign('not-json') },
      body:    'not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 502 when MP payment API is unreachable', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 } as any)

    const res = await POST(makeWebhookRequest({ type: 'payment', data: { id: '12345' } }))
    expect(res.status).toBe(502)
  })
})
