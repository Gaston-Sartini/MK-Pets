import { NextResponse } from 'next/server'
import { getProducts } from '@/lib/queries'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const cat      = searchParams.get('cat')      ?? undefined
  const q        = searchParams.get('q')        ?? undefined
  const cursorRaw = searchParams.get('cursor')  ?? undefined

  // Sanitize search query length to prevent abuse
  const search = q ? q.slice(0, 100) : undefined

  try {
    const { products, nextCursor } = await getProducts({
      categorySlug: cat,
      search,
      cursor: cursorRaw,
      take: 20,
    })

    return NextResponse.json({ products, nextCursor })
  } catch {
    return NextResponse.json({ error: 'Error al obtener productos' }, { status: 500 })
  }
}
