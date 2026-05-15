import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/pagos/crear-preferencia/route'

// ─── Mock MercadoPago SDK ────────────────────────────────────────────────────

vi.mock('@/lib/mercadopago', () => ({
  createMpPreference: vi.fn(),
}))

import { createMpPreference } from '@/lib/mercadopago'

// ─── helpers ────────────────────────────────────────────────────────────────

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/pagos/crear-preferencia', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
}

const VALID_BODY = {
  orderNumber: 'MKP-20260514-0001',
  items: [
    { id: 'clxproduct0001', title: 'Alimento gato', quantity: 2, unit_price: 1500 },
  ],
  total: 3000,
}

// ─── POST /api/pagos/crear-preferencia ──────────────────────────────────────

describe('POST /api/pagos/crear-preferencia', () => {
  beforeEach(() => {
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
      expect.objectContaining({ orderNumber: 'MKP-20260514-0001' })
    )
  })

  // ── Validation ──────────────────────────────────────────────────────────

  it('returns 400 when orderNumber is too short', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, orderNumber: 'SHORT' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for empty items array', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, items: [] }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for negative unit_price', async () => {
    const res = await POST(makeRequest({
      ...VALID_BODY,
      items: [{ ...VALID_BODY.items[0], unit_price: -100 }],
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for zero quantity', async () => {
    const res = await POST(makeRequest({
      ...VALID_BODY,
      items: [{ ...VALID_BODY.items[0], quantity: 0 }],
    }))
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
