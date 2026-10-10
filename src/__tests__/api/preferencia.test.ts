import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/pagos/crear-preferencia/route'
import { prisma } from '@/lib/prisma'

// ─── Mock MercadoPago SDK ────────────────────────────────────────────────────

vi.mock('@/lib/mercadopago', () => ({
  createMpPreference: vi.fn(),
}))

import { createMpPreference } from '@/lib/mercadopago'

// ─── helpers ────────────────────────────────────────────────────────────────

// IP distinta por request para que el rate limit no mezcle un test con otro
let ip = 0
function makeRequest(body: unknown) {
  return new Request('http://localhost/api/pagos/crear-preferencia', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.1.0.${++ip}` },
    body:    JSON.stringify(body),
  })
}

const ORDER_NUMBER = 'MKP-20260514-7K2M9QHD'
const VALID_BODY   = { orderNumber: ORDER_NUMBER }

const DB_ORDER = {
  orderNumber:   ORDER_NUMBER,
  status:        'PENDING',
  paymentMethod: 'MERCADOPAGO',
  paymentStatus: 'PENDING',
  createdAt:     new Date(),
  items: [
    { productId: 'clxproduct0001', variantLabel: '3kg', quantity: 2, unitPrice: 1500, product: { name: 'Alimento gato' } },
  ],
}

// ─── POST /api/pagos/crear-preferencia ──────────────────────────────────────

describe('POST /api/pagos/crear-preferencia', () => {
  beforeEach(() => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(DB_ORDER as any)
    vi.mocked(createMpPreference).mockResolvedValue({
      id:                 'pref-abc123',
      init_point:         'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-abc123',
      sandbox_init_point: 'https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-abc123',
    } as any)
  })

  it('returns preferenceId, initPoint and sandboxUrl on success', async () => {
    const res  = await POST(makeRequest(VALID_BODY))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.preferenceId).toBe('pref-abc123')
    expect(body.initPoint).toContain('mercadopago.com.ar')
    expect(body.sandboxUrl).toContain('sandbox.mercadopago')
  })

  it('passes orderNumber as external_reference to MP', async () => {
    await POST(makeRequest(VALID_BODY))

    expect(vi.mocked(createMpPreference)).toHaveBeenCalledWith(
      expect.objectContaining({ orderNumber: ORDER_NUMBER })
    )
  })

  // ── SECURITY: price manipulation ────────────────────────────────────────

  it('charges the prices stored in the DB and ignores any client-supplied items', async () => {
    await POST(makeRequest({
      ...VALID_BODY,
      items: [{ id: 'clxproduct0001', title: 'Alimento gato', quantity: 2, unit_price: 0.01 }],
      total: 0.02,
    }))

    const { items } = vi.mocked(createMpPreference).mock.calls[0][0]
    expect(items).toEqual([
      { id: 'clxproduct0001', title: 'Alimento gato (3kg)', quantity: 2, unit_price: 1500 },
    ])
  })

  // ── Order state ─────────────────────────────────────────────────────────

  it('returns 404 for an unknown order', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(null)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(404)
    expect(createMpPreference).not.toHaveBeenCalled()
  })

  it('returns 409 for an order that is already paid', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({ ...DB_ORDER, paymentStatus: 'APPROVED' } as any)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(409)
    expect(createMpPreference).not.toHaveBeenCalled()
  })

  it('returns 409 for a cash-on-delivery order', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({ ...DB_ORDER, paymentMethod: 'CASH_ON_DELIVERY' } as any)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(409)
  })

  it('returns 409 for a cancelled order', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({ ...DB_ORDER, status: 'CANCELLED' } as any)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(409)
  })

  // ── Validation ──────────────────────────────────────────────────────────

  it('returns 400 when orderNumber is too short', async () => {
    const res = await POST(makeRequest({ orderNumber: 'SHORT' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when orderNumber is missing', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  // ── Error handling ──────────────────────────────────────────────────────

  it('returns 502 when MercadoPago SDK throws', async () => {
    vi.mocked(createMpPreference).mockRejectedValueOnce(new Error('MP API timeout'))

    const res  = await POST(makeRequest(VALID_BODY))
    const body = await res.json()

    expect(res.status).toBe(502)
    // Error message must not leak internal stack trace
    expect(body.error).not.toContain('Error:')
    expect(body.error).not.toContain('at ')
  })
})
