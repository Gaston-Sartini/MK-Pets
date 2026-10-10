import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, PATCH } from '@/app/api/pedidos/[numero]/route'
import { prisma } from '@/lib/prisma'

// ─── helpers ────────────────────────────────────────────────────────────────

const PARAMS = { params: { numero: 'MKP-20260514-0001' } }

function patchRequest(body: unknown) {
  return new Request('http://localhost/api/pedidos/MKP-20260514-0001', {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
}

const DB_ORDER = {
  id:             'order-cuid-001',
  orderNumber:    'MKP-20260514-0001',
  status:         'CONFIRMED',
  paymentMethod:  'CASH_ON_DELIVERY',
  paymentStatus:  'PENDING',
  customerName:   'Ana García',
  address:        'Av. Santa Fe 2000, CABA',
  phone:          '1166698395',
  notes:          null,
  total:          3000,
  canModifyUntil: new Date(Date.now() + 20 * 60 * 1000), // 20 min from now
  createdAt:      new Date(),
  items: [
    {
      id:           'clxitem0000010000000000001',
      quantity:     2,
      unitPrice:    1500,
      variantLabel: null,
      product: { id: 'clxproduct0001', name: 'Alimento gato', images: [], slug: 'alimento-gato' },
    },
  ],
}

// ─── GET /api/pedidos/[numero] ───────────────────────────────────────────────

describe('GET /api/pedidos/[numero]', () => {
  beforeEach(() => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(DB_ORDER as any)
  })

  it('returns order data with canModify=true when within window', async () => {
    const res  = await GET(new Request('http://localhost'), PARAMS as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.orderNumber).toBe('MKP-20260514-0001')
    expect(body.canModify).toBe(true)
  })

  it('returns canModify=false when window has expired', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
      ...DB_ORDER,
      canModifyUntil: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
    } as any)

    const res  = await GET(new Request('http://localhost'), PARAMS as any)
    const body = await res.json()

    expect(body.canModify).toBe(false)
  })

  it('returns 404 when order does not exist', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(null)

    const res = await GET(new Request('http://localhost'), PARAMS as any)
    expect(res.status).toBe(404)
  })

  it('serializes unitPrice as number (not Prisma Decimal string)', async () => {
    const res  = await GET(new Request('http://localhost'), PARAMS as any)
    const body = await res.json()
    expect(typeof body.items[0].unitPrice).toBe('number')
  })
})

// ─── PATCH /api/pedidos/[numero] ────────────────────────────────────────────

describe('PATCH /api/pedidos/[numero]', () => {
  const ORDER_FOR_PATCH = {
    id:             'order-cuid-001',
    canModifyUntil: new Date(Date.now() + 20 * 60 * 1000),
    status:         'CONFIRMED',
    paymentStatus:  'PENDING',
    items: [
      { id: 'clxitem0000010000000000001', unitPrice: 1500, productId: 'clxproduct0001', variantLabel: null,  quantity: 2 },
      { id: 'clxitem0000020000000000002', unitPrice: 2200, productId: 'clxproduct0002', variantLabel: '3kg', quantity: 1 },
    ],
  }

  beforeEach(() => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue(ORDER_FOR_PATCH as any)
  })

  it('successfully updates quantities and recalculates total from DB prices', async () => {
    const res  = await PATCH(
      patchRequest({ items: [{ id: 'clxitem0000010000000000001', quantity: 1 }, { id: 'clxitem0000020000000000002', quantity: 0 }] }),
      PARAMS as any
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    // total must be 1×1500 = 1500 (recalculated from DB prices)
    expect(body.total).toBe(1500)
  })

  // ── Stock ───────────────────────────────────────────────────────────────

  it('returns to stock exactly what was removed from the order', async () => {
    await PATCH(
      patchRequest({ items: [{ id: 'clxitem0000010000000000001', quantity: 1 }, { id: 'clxitem0000020000000000002', quantity: 0 }] }),
      PARAMS as any
    )

    // Ítem 1: 2 → 1 devuelve 1 unidad del producto
    expect(prisma.product.updateMany).toHaveBeenCalledWith({
      where: { id: 'clxproduct0001' },
      data:  { stock: { increment: 1 } },
    })
    // Ítem 2: 1 → 0 devuelve 1 unidad de la variante y borra la línea
    expect(prisma.productVariant.updateMany).toHaveBeenCalledWith({
      where: { productId: 'clxproduct0002', label: '3kg' },
      data:  { stock: { increment: 1 } },
    })
    expect(prisma.orderItem.delete).toHaveBeenCalledWith({ where: { id: 'clxitem0000020000000000002' } })
  })

  it('takes extra stock when a quantity goes up, and fails with 422 if there is none', async () => {
    vi.mocked(prisma.product.updateMany).mockResolvedValueOnce({ count: 0 } as any)

    const res = await PATCH(
      patchRequest({ items: [{ id: 'clxitem0000010000000000001', quantity: 5 }, { id: 'clxitem0000020000000000002', quantity: 1 }] }),
      PARAMS as any
    )

    expect(prisma.product.updateMany).toHaveBeenCalledWith({
      where: { id: 'clxproduct0001', stock: { gte: 3 } },
      data:  { stock: { decrement: 3 } },
    })
    expect(res.status).toBe(422)
    expect(prisma.order.update).not.toHaveBeenCalled()
  })

  it('returns 409 when the order is already paid', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({ ...ORDER_FOR_PATCH, paymentStatus: 'APPROVED' } as any)

    const res = await PATCH(
      patchRequest({ items: [{ id: 'clxitem0000010000000000001', quantity: 1 }] }),
      PARAMS as any
    )
    expect(res.status).toBe(409)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  // ── SECURITY: item ID ownership ─────────────────────────────────────────

  it('rejects item IDs that do not belong to this order (IDOR prevention)', async () => {
    const res = await PATCH(
      patchRequest({ items: [{ id: 'clxitemforeign000000000001', quantity: 1 }] }),
      PARAMS as any
    )
    expect(res.status).toBe(403)
  })

  // ── SECURITY: price cannot be manipulated ───────────────────────────────

  it('ignores any price fields in PATCH body — uses DB prices', async () => {
    await PATCH(
      patchRequest({ items: [{ id: 'clxitem0000010000000000001', quantity: 1, unitPrice: 0.01 }] }),
      PARAMS as any
    )

    // 1 × 1500 (precio de la base), no 1 × 0.01
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { total: 1500 } })
    )
  })

  // ── Business logic ──────────────────────────────────────────────────────

  it('returns 409 when modification window has expired', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
      ...ORDER_FOR_PATCH,
      canModifyUntil: new Date(Date.now() - 1000),
    } as any)

    const res = await PATCH(
      patchRequest({ items: [{ id: 'clxitem0000010000000000001', quantity: 1 }] }),
      PARAMS as any
    )
    expect(res.status).toBe(409)
  })

  it('returns 409 when order is in PREPARING state', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
      ...ORDER_FOR_PATCH,
      status: 'PREPARING',
    } as any)

    const res = await PATCH(
      patchRequest({ items: [{ id: 'clxitem0000010000000000001', quantity: 1 }] }),
      PARAMS as any
    )
    expect(res.status).toBe(409)
  })

  it('returns 422 when all items have quantity 0', async () => {
    const res = await PATCH(
      patchRequest({ items: [{ id: 'clxitem0000010000000000001', quantity: 0 }] }),
      PARAMS as any
    )
    expect(res.status).toBe(422)
  })

  it('returns 404 for unknown order number', async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(null)

    const res = await PATCH(
      patchRequest({ items: [{ id: 'clxitem0000010000000000001', quantity: 1 }] }),
      PARAMS as any
    )
    expect(res.status).toBe(404)
  })
})
