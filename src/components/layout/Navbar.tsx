'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { ShoppingCart, Search, Phone, X } from 'lucide-react'
import { useCartStore } from '@/store/cart-store'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  { slug: 'gatos',    label: 'Gatos',    emoji: '🐱' },
  { slug: 'perros',   label: 'Perros',   emoji: '🐶' },
  { slug: 'snacks',   label: 'Snacks',   emoji: '🍬' },
  { slug: 'humedos',  label: 'Húmedos',  emoji: '💧' },
  { slug: 'arena',    label: 'Arena',    emoji: '🪨' },
  { slug: 'higiene',  label: 'Higiene',  emoji: '🧴' },
  { slug: 'ropa',     label: 'Ropa',     emoji: '👕' },
  { slug: 'juguetes', label: 'Juguetes', emoji: '🎾' },
]

export function Navbar() {
  const [isScrolled,   setIsScrolled]   = useState(false)
  const [searchOpen,   setSearchOpen]   = useState(false)
  const [searchQuery,  setSearchQuery]  = useState('')

  const totalItems  = useCartStore(s => s.totalItems())
  const openDrawer  = useCartStore(s => s.openDrawer)
  const router      = useRouter()

  useEffect(() => {
    const handler = () => setIsScrolled(window.scrollY > 8)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    router.push(`/productos?q=${encodeURIComponent(searchQuery.trim())}`)
    setSearchOpen(false)
    setSearchQuery('')
  }, [searchQuery, router])

  return (
    <header className={cn(
      'sticky top-0 z-40 bg-white transition-shadow duration-200',
      isScrolled && 'shadow-navbar'
    )}>
      {/* MICRO-BANNER */}
      <div className="shipping-strip text-center py-1.5 text-xs gap-4 md:gap-8">
        <span>🚚 <strong>Envío gratis</strong> a CABA</span>
        <span className="hidden sm:inline">·</span>
        <span className="hidden sm:inline">📞 11 6669 8395</span>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8">
        {/* MAIN ROW */}
        <div className="flex items-center gap-3 h-16 md:h-[72px]">

          {/* LOGO */}
          <Link
            href="/"
            className="flex-shrink-0 flex items-center gap-2 group"
            aria-label="MK-Pets — Inicio"
          >
            <div className="relative h-10 w-auto">
              <Image
                src="/logo.png"
                alt="MK-Pets"
                width={120}
                height={40}
                className="h-10 w-auto object-contain group-hover:scale-105 transition-transform duration-200"
                priority
              />
            </div>
            <div>
              <span className="font-display font-black text-mk-dark text-lg leading-none">
                MK-<span className="text-mk-orange">pets</span>
              </span>
              <p className="hidden sm:block font-body text-mk-mid text-[10px] leading-none -mt-0.5">
                Tu mascota, nuestra prioridad
              </p>
            </div>
          </Link>

          {/* SEARCHBAR — desktop */}
          <form onSubmit={handleSearch} className="flex-1 hidden md:flex max-w-lg mx-auto">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-mk-mid w-4 h-4 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar productos..."
                aria-label="Buscar productos"
                className="w-full pl-9 pr-4 py-2.5 rounded-pill
                           border-2 border-mk-light bg-mk-white
                           font-body text-sm text-mk-dark placeholder:text-mk-mid
                           transition-colors duration-200
                           focus:outline-none focus:border-mk-orange"
              />
            </div>
          </form>

          {/* RIGHT ACTIONS */}
          <div className="flex items-center gap-1 md:gap-2 ml-auto">
            {/* WhatsApp — desktop */}
            <a
              href="https://wa.me/5491166698395"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-pill
                         bg-mk-light text-mk-mid text-xs font-body font-medium
                         hover:bg-[#25D366] hover:text-white transition-all duration-200"
              aria-label="Contactar por WhatsApp"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>11 6669 8395</span>
            </a>

            {/* Search icon — mobile */}
            <button
              onClick={() => setSearchOpen(v => !v)}
              className="md:hidden p-2 text-mk-mid hover:text-mk-orange hover:bg-mk-orange-light
                         rounded-full transition-colors"
              aria-label="Abrir buscador"
              aria-expanded={searchOpen}
            >
              {searchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
            </button>

            {/* CART */}
            <button
              onClick={openDrawer}
              className="relative p-2 text-mk-dark hover:text-mk-orange hover:bg-mk-orange-light
                         rounded-full transition-colors"
              aria-label={`Carrito de compras, ${totalItems} ${totalItems === 1 ? 'ítem' : 'ítems'}`}
            >
              <ShoppingCart className="w-6 h-6" />
              {totalItems > 0 && (
                <span
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full
                             bg-mk-orange text-white text-xs font-display font-bold
                             flex items-center justify-center
                             animate-bounce-badge"
                  aria-hidden="true"
                >
                  {totalItems > 9 ? '9+' : totalItems}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* SEARCH — mobile expandible */}
        {searchOpen && (
          <form onSubmit={handleSearch} className="pb-3 md:hidden animate-fade-in">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-mk-mid w-4 h-4 pointer-events-none" />
              <input
                autoFocus
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar productos..."
                className="w-full pl-9 pr-4 py-2.5 rounded-pill
                           border-2 border-mk-light bg-mk-white
                           font-body text-sm focus:outline-none focus:border-mk-orange"
              />
            </div>
          </form>
        )}

        {/* CATEGORY SUBNAV — desktop */}
        <nav aria-label="Categorías" className="hidden md:flex items-center gap-1 pb-2 border-t border-gray-50 pt-1">
          <Link
            href="/productos"
            className="flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-body font-medium
                       text-mk-mid hover:text-mk-orange hover:bg-mk-orange-light transition-colors"
          >
            🐾 Todos
          </Link>
          {CATEGORIES.map(cat => (
            <Link
              key={cat.slug}
              href={`/productos?cat=${cat.slug}`}
              className="flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-body font-medium
                         text-mk-mid hover:text-mk-orange hover:bg-mk-orange-light transition-colors"
            >
              {cat.emoji} {cat.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
