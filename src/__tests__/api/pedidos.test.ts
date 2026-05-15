import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/pedidos/route'
import { prisma } from '@/lib/prisma'

// ─── helpers ────────────────────────────────────────────────────────────────

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/pedidos', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
}

const VALID_PRODUCT = {
  id:        'clxproduct0001',
  basePrice: 1500,
  variants:  [],
}

const VALID_BODY = {
  paymentMethod: 'CASH_ON_DELIVERY',
  customerName:  'Juan Pérez',
  address:       'Av. Corrientes 1234, CABA',
  phone:         '1166698395',
  items: [{ productId: 'clxproduct0001', quantity: 2 }],
}

// ─── POST /api/pedidos ───────────────────────────────────────────────────────

describe('POST /api/pedidos', () => {
  beforeEach(() => {
    vi.mocked(prisma.product.findMany).mockResolvedValue([VALID_PRODUCT] as any)
    vi.mocked(prisma.order.create).mockResolvedValue({
      orderNumber: 'MKP-20260514-0001',
      status:      'CONFIRMED',
      total:       3000,
    } as any)
  })

  // ── Happy path ──────────────────────────────────────────────────────────

  it('creates a CASH_ON_DELIVERY order and returns 201', async () => {
    const res  = await POST(makeRequest(VALID_BODY))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.orderNumber).toMatch(/^MKP-\d{8}-\d{4}$/)
    expect(body.status).toBe('CONFIRMED')
    expect(body.total).toBe(3000)
  })

  it('creates a MERCADOPAGO order with PENDING status', async () => {
    vi.mocked(prisma.order.create).mockResolvedValueOnce({
      orderNumber: 'MKP-20260514-0002',
      status:      'PENDING',
      total:       1500,
    } as any)

    const res  = await POST(makeRequest({ ...VALID_BODY, paymentMethod: 'MERCADOPAGO', items: [{ productId: 'clxproduct0001', quantity: 1 }] }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.status).toBe('PENDING')
  })

  // ── SECURITY: price manipulation ────────────────────────────────────────

  it('ignores client-supplied unitPrice and uses DB price', async () => {
    const bodyWithFakePrice = {
      ...VALID_BODY,
      items: [{ productId: 'clxproduct0001', quantity: 1, unitPrice: 0.01 }],
    }

    await POST(makeRequest(bodyWithFakePrice))

    const createCall = vi.mocked(prisma.order.create).mock.calls[0][0]
    const item = (createCall as any).data.items.create[0]
    // Server must use DB price (1500), NOT 0.01
    expect(item.unitPrice).toBe(1500)
  })

  it('rejects order when product does not exist in DB', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([])

    const res  = await POST(makeRequest(VALID_BODY))
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error).toContain('no disponible')
  })

  it('uses variant price when variantLabel is provided', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([{
      id:        'clxproduct0001',
      basePrice: 1500,
      variants:  [{ label: '3kg', price: 2200 }],
    }] as any)

    await POST(makeRequest({
      ...VALID_BODY,
      items: [{ productId: 'clxproduct0001', variantLabel: '3kg', quantity: 1 }],
    }))

    const createCall = vi.mocked(prisma.order.create).mock.calls[0][0]
    const item = (createCall as any).data.items.create[0]
    expect(item.unitPrice).toBe(2200)
  })

  // ── Validation ──────────────────────────────────────────────────────────

  it('returns 400 for missing customerName', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, customerName: 'AB' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for empty items array', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, items: [] }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid paymentMethod', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, paymentMethod: 'BITCOIN' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for quantity exceeding max (100)', async () => {
    const res = await POST(makeRequest({
      ...VALID_BODY,
      items: [{ productId: 'clxproduct0001', quantity: 999 }],
    }))
    expect(res.status).toBe(400)
  })

  it('calculates total correctly from DB prices (not client values)', async () => {
    // 2 items × 1500 = 3000
    await POST(makeRequest({ ...VALID_BODY, items: [{ productId: 'clxproduct0001', quantity: 2 }] }))

    const createCall = vi.mocked(prisma.order.create).mock.calls[0][0]
    expect((createCall as any).data.total).toBe(3000)
  })

  // ── Rate limiting ───────────────────────────────────────────────────────

  it('returns 429 after 10 requests from same IP', async () => {
    const req = () => new Request('http://localhost/api/pedidos', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
      body:    JSON.stringify(VALID_BODY),
    })

    const results: number[] = []
    for (let i = 0; i < 12; i++) {
      const res = await POST(req())
      results.push(res.status)
    }

    expect(results).toContain(429)
  })
})
