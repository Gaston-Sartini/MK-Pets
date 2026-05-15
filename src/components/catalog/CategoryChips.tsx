'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

interface Category { id: string; name: string; slug: string; emoji: string | null }

const DEFAULT_CATS = [
  { slug: '',         name: 'Todos',    emoji: '🐾' },
  { slug: 'gatos',    name: 'Gatos',    emoji: '🐱' },
  { slug: 'perros',   name: 'Perros',   emoji: '🐶' },
  { slug: 'snacks',   name: 'Snacks',   emoji: '🍬' },
  { slug: 'humedos',  name: 'Húmedos',  emoji: '💧' },
  { slug: 'arena',    name: 'Arena',    emoji: '🪨' },
  { slug: 'higiene',  name: 'Higiene',  emoji: '🧴' },
  { slug: 'ropa',     name: 'Ropa',     emoji: '👕' },
  { slug: 'juguetes', name: 'Juguetes', emoji: '🎾' },
]

interface Props {
  categories?: Category[]
  activeCat?: string
}

export function CategoryChips({ categories, activeCat }: Props) {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const cats = categories?.length
    ? [{ slug: '', name: 'Todos', emoji: '🐾' }, ...categories.map(c => ({ ...c, emoji: c.emoji ?? '🐾' }))]
    : DEFAULT_CATS

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
          className={cn(
            'category-chip flex-shrink-0',
            current === cat.slug ? 'category-chip-active' : 'category-chip-inactive'
          )}
        >
          <span className="text-xl leading-none">{cat.emoji}</span>
          <span>{cat.name}</span>
        </button>
      ))}
    </div>
  )
}
