import { vi } from 'vitest'

// Mock Prisma globally — every test that needs a specific return value
// overrides with vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(...)
vi.mock('@/lib/prisma', () => ({
  prisma: {
    product:   { findMany: vi.fn(), findUnique: vi.fn() },
    order:     { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    orderItem: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
  },
}))

// Mock crypto for deterministic tests where needed
process.env.MP_ACCESS_TOKEN   = 'TEST_ACCESS_TOKEN'
process.env.MP_WEBHOOK_SECRET = 'test-webhook-secret-32-chars-ok!'
process.env.SESSION_SECRET    = 'test-session-secret-32-chars-ok!'
process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000'
