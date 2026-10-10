import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'
import { POST } from '@/app/api/webhooks/mercadopago/route'
import { prisma } from '@/lib/prisma'

// ─── helpers ────────────────────────────────────────────────────────────────

const SECRET     = process.env.MP_WEBHOOK_SECRET!
const REQUEST_ID = 'req-abc-123'
const TS         = '1704908010'

/** Firma como lo hace MercadoPago: HMAC del manifest, no del body. */
function mpSignature(dataId: string, secret = SECRET): string {
  const manifest = `id:${dataId};request-id:${REQUEST_ID};ts:${TS};`
  const v1 = crypto.createHmac('sha256', secret).update(manifest).digest('hex')
  return `ts=${TS},v1=${v1}`
}

function makeWebhookRequest(payload: { type: string; data: { id: string } }, signature?: string) {
  const dataId = payload.data.id
  return new Request(`http://localhost/api/webhooks/mercadopago?data.id=${dataId}&type=${payload.type}`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-signature':  signature ?? mpSignature(dataId),
      'x-request-id': REQUEST_ID,
    },
    body: JSON.stringify(payload),
  })
}

const ORDER_NUMBER  = 'MKP-20260514-7K2M9QHD'
const PAYMENT_EVENT = { type: 'payment', data: { id: '12345' } }

function mockMpPayment(overrides: Record<string, unknown> = {}) {
  global.fetch = vi.fn().mockResolvedValue({
    ok:   true,
    json: async () => ({
      status:             'approved',
      external_reference: ORDER_NUMBER,
      transaction_amount: 3000,
      currency_id:        'ARS',
      ...overrides,
    }),
  } as any)
}

function mockOrder(overrides: Record<string, unknown> = {}) {
  vi.mocked(prisma.order.findUnique).mockResolvedValue({
    status: 'PENDING', paymentStatus: 'PENDING', total: 3000,
    customerName: 'Ana', phone: '1166698395', notes: null, items: [],
    ...overrides,
  } as any)
}

// ─── Webhook tests ───────────────────────────────────────────────────────────

describe('POST /api/webhooks/mercadopago', () => {
  beforeEach(() => {
    mockMpPayment()
    mockOrder()
    vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 1 } as any)
  })

  // ── SECURITY: signature verification ────────────────────────────────────

  it('returns 401 for a malformed signature header', async () => {
    const res = await POST(makeWebhookRequest(PAYMENT_EVENT, 'invalid-signature-hex'))
    expect(res.status).toBe(401)
    expect(prisma.order.updateMany).not.toHaveBeenCalled()
  })

  it('returns 401 when signed with the wrong secret', async () => {
    const res = await POST(makeWebhookRequest(PAYMENT_EVENT, mpSignature('12345', 'otro-secreto')))
    expect(res.status).toBe(401)
  })

  it('returns 401 when the signature belongs to a different payment id', async () => {
    const res = await POST(makeWebhookRequest(PAYMENT_EVENT, mpSignature('99999')))
    expect(res.status).toBe(401)
  })

  it('returns 500 (fail-closed) when MP_WEBHOOK_SECRET is not set', async () => {
    const original = process.env.MP_WEBHOOK_SECRET
    delete process.env.MP_WEBHOOK_SECRET

    const res = await POST(makeWebhookRequest(PAYMENT_EVENT))
    expect(res.status).toBe(500)

    process.env.MP_WEBHOOK_SECRET = original
  })

  it('accepts a request signed the way MercadoPago signs (manifest HMAC)', async () => {
    const res = await POST(makeWebhookRequest(PAYMENT_EVENT))
    expect(res.status).toBe(200)
  })

  // ── Payment processing ───────────────────────────────────────────────────

  it('updates order to CONFIRMED and APPROVED on approved payment', async () => {
    await POST(makeWebhookRequest(PAYMENT_EVENT))

    expect(prisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status:        'CONFIRMED',
          paymentStatus: 'APPROVED',
          mpPaymentId:   '12345',
        }),
      })
    )
  })

  it('marks payment REJECTED without touching the order status', async () => {
    mockMpPayment({ status: 'rejected' })

    await POST(makeWebhookRequest(PAYMENT_EVENT))

    const data = vi.mocked(prisma.order.updateMany).mock.calls[0][0].data as Record<string, unknown>
    expect(data.paymentStatus).toBe('REJECTED')
    expect(data).not.toHaveProperty('status')
  })

  it('does NOT confirm when the paid amount is lower than the order total', async () => {
    mockMpPayment({ transaction_amount: 1 })

    const res = await POST(makeWebhookRequest(PAYMENT_EVENT))

    expect(res.status).toBe(200)
    expect(prisma.order.updateMany).not.toHaveBeenCalled()
  })

  it('does NOT confirm a payment in another currency', async () => {
    mockMpPayment({ currency_id: 'USD' })

    await POST(makeWebhookRequest(PAYMENT_EVENT))
    expect(prisma.order.updateMany).not.toHaveBeenCalled()
  })

  it('never downgrades an already approved order on a late rejected webhook', async () => {
    mockOrder({ status: 'CONFIRMED', paymentStatus: 'APPROVED' })
    mockMpPayment({ status: 'rejected' })

    await POST(makeWebhookRequest(PAYMENT_EVENT))
    expect(prisma.order.updateMany).not.toHaveBeenCalled()
  })

  it('does not move an order that is already being prepared back to CONFIRMED', async () => {
    mockOrder({ status: 'PREPARING' })

    await POST(makeWebhookRequest(PAYMENT_EVENT))

    const data = vi.mocked(prisma.order.updateMany).mock.calls[0][0].data as Record<string, unknown>
    expect(data.paymentStatus).toBe('APPROVED')
    expect(data).not.toHaveProperty('status')
  })

  it('is idempotent: a duplicate webhook for an approved order changes nothing', async () => {
    mockOrder({ status: 'CONFIRMED', paymentStatus: 'APPROVED' })

    const res = await POST(makeWebhookRequest(PAYMENT_EVENT))
    expect(res.status).toBe(200)
    expect(prisma.order.updateMany).not.toHaveBeenCalled()
  })

  it('ignores non-payment webhook types silently (returns 200)', async () => {
    const res = await POST(makeWebhookRequest({ type: 'merchant_order', data: { id: '99' } }))
    expect(res.status).toBe(200)
    expect(prisma.order.updateMany).not.toHaveBeenCalled()
  })

  it('acknowledges legacy unsigned IPN notifications without processing them', async () => {
    const res = await POST(new Request('http://localhost/api/webhooks/mercadopago?topic=payment&id=12345', {
      method: 'POST',
    }))
    expect(res.status).toBe(200)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns 400 for malformed JSON body', async () => {
    const req = new Request('http://localhost/api/webhooks/mercadopago?data.id=12345&type=payment', {
      method:  'POST',
      headers: { 'x-signature': mpSignature('12345'), 'x-request-id': REQUEST_ID },
      body:    'not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 502 when MP payment API is unreachable (so MP retries)', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 } as any)

    const res = await POST(makeWebhookRequest(PAYMENT_EVENT))
    expect(res.status).toBe(502)
  })
})
