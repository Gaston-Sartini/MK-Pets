'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

interface Category { id?: string; name: string; slug: string; emoji: string | null }

interface Props {
  categories?: Category[]
  activeCat?: string
}

export function CategoryChips({ categories, activeCat }: Props) {
  const router       = useRouter()
  const searchParams = useSearchParams()

  // Build chip list: always include "Todos", then the live categories from the DB.
  // No hardcoded fallback — if the DB returns no categories, only "Todos" shows.
  const cats = [
    { slug: '', name: 'Todos', emoji: '🐾' },
    ...(categories ?? []).map(c => ({ ...c, emoji: c.emoji ?? '🐾' })),
  ]

  const current = activeCat ?? searchParams.get('cat') ?? ''

  const handleClick = (slug: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (slug) params.set('cat', slug)
    else      params.delete('cat')
    router.push(`/productos?${params.toString()}`)
  }

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
      {cats.map(cat => (
        <button
          key={cat.slug}
          onClick={() => handleClick(cat.slug)}
          aria-label={cat.slug ? `Ver ${cat.name}` : 'Ver todos los productos'}
          aria-pressed={current === cat.slug}
          className={cn(
            'category-chip flex-shrink-0',
            current === cat.slug ? 'category-chip-active' : 'category-chip-inactive'
          )}
        >
          <span className="text-xl leading-none" aria-hidden="true">{cat.emoji}</span>
          <span>{cat.name}</span>
        </button>
      ))}
    </div>
  )
}
