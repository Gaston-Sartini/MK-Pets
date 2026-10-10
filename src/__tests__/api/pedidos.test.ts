import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/pedidos/route'
import { prisma } from '@/lib/prisma'

// ─── helpers ────────────────────────────────────────────────────────────────

// IP distinta por request para que el rate limit no mezcle un test con otro
let ip = 0
function makeRequest(body: unknown) {
  return new Request('http://localhost/api/pedidos', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.0.0.${++ip}` },
    body:    JSON.stringify(body),
  })
}

const VALID_PRODUCT = {
  id:        'clxproduct0001',
  name:      'Alimento gato',
  basePrice: 1500,
  stock:     10,
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
      orderNumber: 'MKP-20260514-7K2M9QHD',
      status:      'CONFIRMED',
      total:       3000,
    } as any)
  })

  // ── Happy path ──────────────────────────────────────────────────────────

  it('creates a CASH_ON_DELIVERY order and returns 201', async () => {
    const res  = await POST(makeRequest(VALID_BODY))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.orderNumber).toMatch(/^MKP-\d{8}-[2-9A-Z]{8}$/)
    expect(body.status).toBe('CONFIRMED')
    expect(body.total).toBe(3000)
  })

  it('creates a TRANSFER order as PENDING until the payment is confirmed', async () => {
    vi.mocked(prisma.order.create).mockResolvedValueOnce({
      orderNumber: 'MKP-20260514-0002',
      status:      'PENDING',
      total:       1500,
    } as any)

    const res  = await POST(makeRequest({ ...VALID_BODY, paymentMethod: 'TRANSFER', items: [{ productId: 'clxproduct0001', quantity: 1 }] }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.status).toBe('PENDING')
    const created = vi.mocked(prisma.order.create).mock.calls[0][0] as any
    expect(created.data).toMatchObject({ paymentMethod: 'TRANSFER', status: 'PENDING', paymentStatus: 'PENDING' })
  })

  it('rejects MERCADOPAGO while it is switched off for the shop', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, paymentMethod: 'MERCADOPAGO' }))

    expect(res.status).toBe(400)
    expect(prisma.order.create).not.toHaveBeenCalled()
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
    expect(body.error).toContain('ya no está disponible')
  })

  it('uses variant price when variantLabel is provided', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([{
      id:        'clxproduct0001',
      basePrice: 1500,
      name:      'Alimento gato',
      stock:     0,
      variants:  [{ label: '3kg', price: 2200, stock: 5 }],
    }] as any)

    await POST(makeRequest({
      ...VALID_BODY,
      items: [{ productId: 'clxproduct0001', variantLabel: '3kg', quantity: 1 }],
    }))

    const createCall = vi.mocked(prisma.order.create).mock.calls[0][0]
    const item = (createCall as any).data.items.create[0]
    expect(item.unitPrice).toBe(2200)
  })

  // ── Stock ───────────────────────────────────────────────────────────────

  it('decrements stock atomically inside the transaction', async () => {
    await POST(makeRequest(VALID_BODY))

    expect(prisma.product.updateMany).toHaveBeenCalledWith({
      where: { id: 'clxproduct0001', stock: { gte: 2 } },
      data:  { stock: { decrement: 2 } },
    })
  })

  it('rejects with 422 when the requested quantity exceeds stock', async () => {
    vi.mocked(prisma.product.findMany).mockResolvedValueOnce([{ ...VALID_PRODUCT, stock: 1 }] as any)

    const res  = await POST(makeRequest(VALID_BODY))
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error).toContain('Stock insuficiente')
    expect(prisma.order.create).not.toHaveBeenCalled()
  })

  it('rejects with 422 and creates no order when another buyer takes the last unit first', async () => {
    // La lectura previa vio stock, pero el UPDATE atómico ya no encuentra unidades
    vi.mocked(prisma.product.updateMany).mockResolvedValueOnce({ count: 0 } as any)

    const res = await POST(makeRequest(VALID_BODY))

    expect(res.status).toBe(422)
    expect(prisma.order.create).not.toHaveBeenCalled()
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
