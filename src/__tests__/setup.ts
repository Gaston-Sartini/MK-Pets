import { vi, beforeEach } from 'vitest'

// Clear mock call history before each test so mock.calls[0] is always the current test's call
beforeEach(() => { vi.clearAllMocks() })

// Mock Prisma globally — every test that needs a specific return value
// overrides with vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(...)
vi.mock('@/lib/prisma', () => {
  const one = () => vi.fn().mockResolvedValue({ count: 1 })
  const prisma: Record<string, any> = {
    product:        { findMany: vi.fn(), findUnique: vi.fn(), updateMany: one() },
    productVariant: { updateMany: one() },
    order:          { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: one() },
    orderItem:      { deleteMany: vi.fn(), createMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
  }
  // Soporta las dos formas de $transaction: callback interactivo y array de operaciones.
  prisma.$transaction = vi.fn((arg: unknown) =>
    typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(prisma) : Promise.all(arg as unknown[])
  )
  return { prisma }
})

// `after()` de Next.js solo existe dentro de un pedido real: en los tests corre
// la tarea enseguida (y sus errores no rompen la respuesta, como en producción).
vi.mock('next/server', async (importOriginal) => {
  const original = await importOriginal<typeof import('next/server')>()
  return {
    ...original,
    after: (task: unknown) => {
      Promise.resolve().then(() => (typeof task === 'function' ? task() : task)).catch(() => {})
    },
  }
})

process.env.MP_ACCESS_TOKEN   = 'TEST_ACCESS_TOKEN'
process.env.MP_WEBHOOK_SECRET = 'test-webhook-secret-32-chars-ok!'
process.env.SESSION_SECRET    = 'test-session-secret-32-chars-ok!'
process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000'
// El cliente de Supabase se crea al importar el módulo y exige una URL válida.
// Ningún test llega a pegarle: es solo para que el import no falle.
process.env.SUPABASE_URL      = 'http://localhost:54321'
process.env.SUPABASE_ANON_KEY = 'test-anon-key'
