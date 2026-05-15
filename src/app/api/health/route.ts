import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// SRE: health check endpoint — monitored by UptimeRobot every 5 min
// Returns 200 only when ALL critical dependencies are reachable.
// Returns 503 if any dependency is down — triggers uptime alert.

export const dynamic = 'force-dynamic'    // never cache health checks
export const runtime = 'nodejs'

interface Check {
  name:     string
  status:   'ok' | 'error'
  latencyMs?: number
  error?:   string
}

export async function GET() {
  const start   = Date.now()
  const checks: Check[] = []

  // ── DB check ──────────────────────────────────────────────────────────────
  try {
    const dbStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    checks.push({ name: 'database', status: 'ok', latencyMs: Date.now() - dbStart })
  } catch (err) {
    checks.push({
      name:   'database',
      status: 'error',
      error:  err instanceof Error ? err.message : 'unknown',
    })
  }

  // ── MP API reachability (lightweight — no auth required) ──────────────────
  try {
    const mpStart = Date.now()
    const res = await fetch('https://api.mercadopago.com/v1/payment_methods', {
      signal: AbortSignal.timeout(3000),
    })
    checks.push({
      name:     'mercadopago',
      status:   res.ok || res.status === 401 ? 'ok' : 'error',  // 401 means reachable
      latencyMs: Date.now() - mpStart,
    })
  } catch {
    checks.push({ name: 'mercadopago', status: 'error', error: 'unreachable' })
  }

  const allOk     = checks.every(c => c.status === 'ok')
  const totalMs   = Date.now() - start
  const httpStatus = allOk ? 200 : 503

  return NextResponse.json(
    {
      status:   allOk ? 'ok' : 'degraded',
      checks,
      totalMs,
      version:  process.env.npm_package_version ?? '0.1.0',
      timestamp: new Date().toISOString(),
    },
    {
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-store',
        'X-Health-Status': allOk ? 'ok' : 'degraded',
      },
    }
  )
}
