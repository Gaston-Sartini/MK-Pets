import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic'

const REF = 'ctttonxivmozsqegzotb'

function extractPassword(url: string | undefined): string {
  if (!url) return ''
  const match = url.match(/postgresql?:\/\/[^:]+:([^@]+)@/)
  return match ? decodeURIComponent(match[1]) : ''
}

async function testUrl(label: string, url: string) {
  const prisma = new PrismaClient({ datasources: { db: { url } } })
  try {
    const count = await Promise.race<number>([
      prisma.product.count() as Promise<number>,
      new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout 8s')), 8000)),
    ])
    await prisma.$disconnect()
    return { label, ok: true, count }
  } catch (e: unknown) {
    await prisma.$disconnect().catch(() => {})
    const msg = e instanceof Error
      ? `${e.name}: ${e.message}`.slice(0, 800)
      : String(e).slice(0, 800)
    const extra = (e as any)?.errorCode ?? (e as any)?.code ?? ''
    return { label, ok: false, error: msg, code: extra }
  }
}

export async function GET() {
  const pass = extractPassword(process.env.DATABASE_URL)
  const encodedPass = encodeURIComponent(pass)

  const tests = [
    { label: 'direct_5432',           url: `postgresql://postgres:${encodedPass}@db.${REF}.supabase.co:5432/postgres` },
    { label: 'transaction_pooler_6543', url: `postgresql://postgres.${REF}:${encodedPass}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1` },
    { label: 'session_pooler_5432',   url: `postgresql://postgres.${REF}:${encodedPass}@aws-0-sa-east-1.pooler.supabase.com:5432/postgres` },
  ]

  const results = await Promise.all(tests.map(t => testUrl(t.label, t.url)))
  return NextResponse.json({ results })
}
