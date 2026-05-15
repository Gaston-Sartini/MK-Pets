/**
 * MK-Pets — UI Component Library
 * Generado por: UI Designer Agent
 * Fecha: 2026-05-14
 *
 * Stack: Next.js 14 + TypeScript + Tailwind CSS
 * Fuentes: Nunito (display) + Inter (body) — importar en layout.tsx
 *
 * USO: Copiar cada componente a su archivo correspondiente en src/components/
 */

// ─────────────────────────────────────────────────────────────────────────────
// DEPENDENCIAS REQUERIDAS
// npm install lucide-react clsx tailwind-merge
// ─────────────────────────────────────────────────────────────────────────────

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// =============================================================================
// 1. BUTTON — src/components/ui/Button.tsx
// =============================================================================
// Variantes: primary | secondary | ghost | danger
// Tamaños:   sm | md | lg
// Estados:   default | hover | active | disabled | loading
// =============================================================================

import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'whatsapp'
  size?: 'sm' | 'md' | 'lg' | 'full'
  loading?: boolean
  icon?: ReactNode
  iconPosition?: 'left' | 'right'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, icon, iconPosition = 'left',
     className, children, disabled, ...props }, ref) => {

    const base = `
      inline-flex items-center justify-center gap-2
      font-display font-bold rounded-pill
      transition-all duration-200 cursor-pointer
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
      disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
      select-none active:scale-95
    `

    const variants = {
      primary: `
        bg-[#E8760A] text-white
        hover:bg-[#C45F00] hover:shadow-md
        focus-visible:ring-[#E8760A]
      `,
      secondary: `
        bg-transparent text-[#E8760A] border-2 border-[#E8760A]
        hover:bg-[#FFF0E0]
        focus-visible:ring-[#E8760A]
      `,
      ghost: `
        bg-transparent text-[#5C5C6B]
        hover:text-[#1A1A2E] hover:bg-[#F5EFE6]
        focus-visible:ring-[#5C5C6B]
      `,
      danger: `
        bg-[#E53E3E] text-white
        hover:bg-[#C53030] hover:shadow-md
        focus-visible:ring-[#E53E3E]
      `,
      whatsapp: `
        bg-[#25D366] text-white
        hover:bg-[#128C7E] hover:shadow-md
        focus-visible:ring-[#25D366]
      `,
    }

    const sizes = {
      sm:   'px-4 py-2 text-sm',
      md:   'px-6 py-3 text-base',
      lg:   'px-8 py-4 text-lg',
      full: 'px-6 py-3 text-base w-full',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {!loading && icon && iconPosition === 'left' && icon}
        {children}
        {!loading && icon && iconPosition === 'right' && icon}
      </button>
    )
  }
)
Button.displayName = 'Button'

/* USAGE EXAMPLES:
  <Button variant="primary" size="full">+ Agregar al carrito</Button>
  <Button variant="secondary">Ver todos los productos</Button>
  <Button variant="whatsapp" icon={<WhatsAppIcon />}>Consultar por WhatsApp</Button>
  <Button variant="primary" loading>Procesando...</Button>
*/


// =============================================================================
// 2. BADGE — src/components/ui/Badge.tsx
// =============================================================================
// Variantes: new | sale | hot | info
// Posición:  absolute (en cards) | inline (en detalle)
// =============================================================================

interface BadgeProps {
  variant: 'new' | 'sale' | 'hot' | 'info'
  label?: string
  className?: string
}

const BADGE_CONFIG = {
  new:  { label: 'NUEVO',       bg: 'bg-[#E8760A]', text: 'text-white' },
  sale: { label: 'OFERTA',      bg: 'bg-[#2D6A2D]', text: 'text-white' },
  hot:  { label: 'MÁS VENDIDO', bg: 'bg-[#16213E]', text: 'text-white' },
  info: { label: 'INFO',        bg: 'bg-[#3B82F6]', text: 'text-white' },
}

export function Badge({ variant, label, className }: BadgeProps) {
  const config = BADGE_CONFIG[variant]
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-xl',
      'text-xs font-display font-bold uppercase tracking-wide',
      config.bg, config.text, className
    )}>
      {label ?? config.label}
    </span>
  )
}

/* USAGE:
  <Badge variant="new" />
  <Badge variant="sale" label="OFERTA 20%" />
*/


// =============================================================================
// 3. PRODUCT CARD — src/components/catalog/ProductCard.tsx
// =============================================================================
// Dimensiones carta: auto height, imagen aspect-square
// Hover: -translate-y-1 + shadow-card-hover
// Click card → navega a /producto/[slug]
// Click botón → addToCart() + toast
// =============================================================================

import Image from 'next/image'
import Link from 'next/link'

interface ProductVariant {
  label: string
  price: number
}

interface ProductCardProps {
  id: string
  name: string
  slug: string
  image: string
  basePrice: number
  badge?: 'new' | 'sale' | 'hot'
  variants?: ProductVariant[]
  onAddToCart?: (productId: string, variantLabel?: string) => void
  className?: string
}

export function ProductCard({
  id, name, slug, image, basePrice,
  badge, variants, onAddToCart, className
}: ProductCardProps) {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    variants?.[0] ?? null
  )

  const displayPrice = selectedVariant?.price ?? basePrice

  const formatPrice = (amount: number) =>
    `$${amount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onAddToCart?.(id, selectedVariant?.label)
  }

  return (
    <div className={cn(
      'group bg-white rounded-[16px] overflow-hidden',
      'shadow-[0_4px_20px_rgba(0,0,0,0.08)]',
      'transition-all duration-200',
      'hover:shadow-[0_8px_32px_rgba(0,0,0,0.14)] hover:-translate-y-1',
      className
    )}>
      {/* IMAGEN */}
      <Link href={`/producto/${slug}`} className="block relative">
        <div className="relative aspect-square overflow-hidden bg-gray-50">
          <Image
            src={image}
            alt={name}
            fill
            className="object-contain p-3 transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        </div>

        {/* BADGE */}
        {badge && (
          <div className="absolute top-2 left-2">
            <Badge variant={badge} />
          </div>
        )}
      </Link>

      {/* CONTENIDO */}
      <div className="p-3 flex flex-col gap-2">

        {/* NOMBRE */}
        <Link href={`/producto/${slug}`}>
          <h3 className="font-display font-bold text-sm text-[#1A1A2E] leading-tight
                         line-clamp-2 hover:text-[#E8760A] transition-colors">
            {name}
          </h3>
        </Link>

        {/* SELECTOR DE VARIANTE */}
        {variants && variants.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {variants.map((v) => (
              <button
                key={v.label}
                onClick={() => setSelectedVariant(v)}
                className={cn(
                  'text-xs px-2 py-0.5 rounded-lg border font-body font-medium',
                  'transition-colors duration-150',
                  selectedVariant?.label === v.label
                    ? 'bg-[#E8760A] text-white border-[#E8760A]'
                    : 'bg-transparent text-[#5C5C6B] border-gray-200 hover:border-[#E8760A] hover:text-[#E8760A]'
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}

        {/* PRECIO */}
        <p className="font-display font-black text-xl text-[#E8760A]">
          {formatPrice(displayPrice)}
        </p>

        {/* BOTÓN AGREGAR */}
        <button
          onClick={handleAddToCart}
          className={cn(
            'w-full py-2 rounded-pill',
            'bg-[#E8760A] text-white',
            'font-display font-bold text-sm',
            'transition-all duration-200',
            'hover:bg-[#C45F00]',
            'active:scale-95',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8760A] focus-visible:ring-offset-1'
          )}
        >
          + Agregar
        </button>
      </div>
    </div>
  )
}

/* ESPECIFICACIONES VISUALES:
  - Card width: auto (grid)
  - Imagen: aspect-square, object-contain con padding 12px, bg gray-50
  - Border-radius card: 16px
  - Border-radius botón: 50px (pill)
  - Font precio: Nunito Black 21px
  - Shadow base: 0 4px 20px rgba(0,0,0,0.08)
  - Shadow hover: 0 8px 32px rgba(0,0,0,0.14)
  - Transition: 200ms ease
*/


// =============================================================================
// 4. CATEGORY CHIP — src/components/catalog/CategoryChip.tsx
// =============================================================================

interface CategoryChipProps {
  label: string
  emoji: string
  active?: boolean
  onClick?: () => void
}

export function CategoryChip({ label, emoji, active, onClick }: CategoryChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl',
        'font-body font-medium text-xs whitespace-nowrap',
        'transition-all duration-200 cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8760A]',
        active
          ? 'bg-[#E8760A] text-white shadow-sm'
          : 'bg-[#F5EFE6] text-[#5C5C6B] hover:bg-[#FFF0E0] hover:text-[#E8760A]'
      )}
    >
      <span className="text-xl leading-none">{emoji}</span>
      <span>{label}</span>
    </button>
  )
}

/* CATEGORÍAS PREDEFINIDAS:
  { label: 'Todos',    emoji: '🐾' }
  { label: 'Gatos',   emoji: '🐱' }
  { label: 'Perros',  emoji: '🐶' }
  { label: 'Snacks',  emoji: '🍬' }
  { label: 'Húmedos', emoji: '💧' }
  { label: 'Arena',   emoji: '🪨' }
  { label: 'Higiene', emoji: '🧴' }
  { label: 'Ropa',    emoji: '👕' }
  { label: 'Juguetes',emoji: '🎾' }
*/


// =============================================================================
// 5. NAVBAR — src/components/layout/Navbar.tsx
// =============================================================================
// Altura: 64px mobile | 72px desktop
// Sticky con sombra en scroll
// =============================================================================

'use client'
import { useState, useEffect } from 'react'
import { ShoppingCart, Search, Phone, Menu, X } from 'lucide-react'

interface NavbarProps {
  cartCount?: number
}

export function Navbar({ cartCount = 0 }: NavbarProps) {
  const [isScrolled, setIsScrolled]       = useState(false)
  const [searchOpen, setSearchOpen]       = useState(false)
  const [searchQuery, setSearchQuery]     = useState('')

  useEffect(() => {
    const handler = () => setIsScrolled(window.scrollY > 8)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <header className={cn(
      'sticky top-0 z-50 bg-white',
      'transition-shadow duration-200',
      isScrolled && 'shadow-[0_2px_12px_rgba(0,0,0,0.08)]'
    )}>

      {/* SHIPPING MICRO-BANNER */}
      <div className="bg-[#16213E] text-white text-xs font-body text-center py-1.5 px-4">
        🚚 <strong>Envío gratis</strong> a CABA en todos tus pedidos
      </div>

      {/* MAIN NAV */}
      <nav className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8">
        <div className="flex items-center gap-3 h-16 md:h-[72px]">

          {/* LOGO */}
          <Link href="/" className="flex-shrink-0 flex items-center gap-2 group">
            {/* Reemplazar con next/image del logo real */}
            <div className="w-10 h-10 bg-[#E8760A] rounded-full flex items-center justify-center
                           group-hover:scale-105 transition-transform">
              <span className="text-white font-display font-black text-xs leading-none text-center">
                MK
              </span>
            </div>
            <span className="font-display font-black text-[#1A1A2E] text-lg hidden sm:block">
              MK-<span className="text-[#E8760A]">pets</span>
            </span>
          </Link>

          {/* SEARCHBAR — desktop */}
          <div className="flex-1 hidden md:flex max-w-lg mx-auto">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5C5C6B] w-4 h-4" />
              <input
                type="search"
                placeholder="Buscar productos..."
                className={cn(
                  'w-full pl-9 pr-4 py-2.5 rounded-pill',
                  'border-2 border-[#F5EFE6] bg-[#FAFAF8]',
                  'font-body text-sm text-[#1A1A2E]',
                  'transition-colors duration-200',
                  'focus:outline-none focus:border-[#E8760A]',
                  'placeholder:text-[#5C5C6B]'
                )}
              />
            </div>
          </div>

          {/* RIGHT ACTIONS */}
          <div className="flex items-center gap-1 md:gap-3 ml-auto">

            {/* Search — mobile */}
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="md:hidden p-2 text-[#5C5C6B] hover:text-[#E8760A] transition-colors rounded-full hover:bg-[#FFF0E0]"
              aria-label="Buscar"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* WhatsApp — desktop only */}
            <a
              href="https://wa.me/5491166698395"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-pill
                        bg-[#F5EFE6] text-[#5C5C6B] text-xs font-body font-medium
                        hover:bg-[#25D366] hover:text-white transition-all duration-200"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>11 6669 8395</span>
            </a>

            {/* CART ICON */}
            <button
              className="relative p-2 text-[#1A1A2E] hover:text-[#E8760A] transition-colors rounded-full hover:bg-[#FFF0E0]"
              aria-label={`Carrito, ${cartCount} productos`}
            >
              <ShoppingCart className="w-6 h-6" />
              {cartCount > 0 && (
                <span className={cn(
                  'absolute -top-1 -right-1',
                  'w-5 h-5 rounded-full',
                  'bg-[#E8760A] text-white',
                  'flex items-center justify-center',
                  'text-xs font-display font-bold',
                  'animate-[bounceBadge_0.4s_cubic-bezier(0.36,0.07,0.19,0.97)]'
                )}>
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* SEARCHBAR — mobile expandible */}
        {searchOpen && (
          <div className="pb-3 md:hidden animate-[fadeIn_0.2s_ease-out]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5C5C6B] w-4 h-4" />
              <input
                autoFocus
                type="search"
                placeholder="Buscar productos..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className={cn(
                  'w-full pl-9 pr-4 py-2.5 rounded-pill',
                  'border-2 border-[#F5EFE6] bg-[#FAFAF8]',
                  'font-body text-sm',
                  'focus:outline-none focus:border-[#E8760A]'
                )}
              />
            </div>
          </div>
        )}

        {/* CATEGORY SUBNAV — desktop */}
        <div className="hidden md:flex items-center gap-1 pb-2 border-t border-gray-50 pt-1">
          {[
            { label: 'Todos', emoji: '🐾' },
            { label: 'Gatos', emoji: '🐱' },
            { label: 'Perros', emoji: '🐶' },
            { label: 'Snacks', emoji: '🍬' },
            { label: 'Húmedos', emoji: '💧' },
            { label: 'Arena', emoji: '🪨' },
            { label: 'Higiene', emoji: '🧴' },
            { label: 'Ropa', emoji: '👕' },
            { label: 'Juguetes', emoji: '🎾' },
          ].map(cat => (
            <Link
              key={cat.label}
              href={`/productos?cat=${cat.label.toLowerCase()}`}
              className="flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-body font-medium
                        text-[#5C5C6B] hover:text-[#E8760A] hover:bg-[#FFF0E0] transition-colors"
            >
              <span>{cat.emoji}</span> {cat.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  )
}


// =============================================================================
// 6. HERO BANNER — src/components/layout/HeroBanner.tsx
// =============================================================================
// Full-width, background arenoso (#F5EFE6)
// Imagen de mascotas y productos a la derecha
// CTA naranja + botón WhatsApp
// =============================================================================

export function HeroBanner() {
  return (
    <section className="relative overflow-hidden bg-[#F5EFE6]">

      {/* DECORATIVE PAWS BACKGROUND */}
      <div className="absolute inset-0 opacity-5 pointer-events-none select-none"
           aria-hidden="true">
        {['top-4 left-4', 'top-12 right-20', 'bottom-8 left-1/3', 'top-1/2 right-8'].map((pos, i) => (
          <span key={i} className={`absolute ${pos} text-6xl`}>🐾</span>
        ))}
      </div>

      <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center gap-6 py-10 md:py-14 lg:py-20">

          {/* TEXT CONTENT */}
          <div className="flex-1 text-center md:text-left order-2 md:order-1">

            {/* LOGO MARK */}
            <div className="flex items-center justify-center md:justify-start gap-2 mb-4">
              {/* Imagen real del logo aquí */}
              <div className="w-12 h-12 bg-[#E8760A] rounded-full" />
              <span className="font-display font-black text-2xl text-[#1A1A2E]">
                MK-<span className="text-[#E8760A]">pets</span>
              </span>
            </div>

            <h1 className="font-display font-extrabold text-[#1A1A2E] leading-tight mb-2
                           text-3xl sm:text-4xl md:text-5xl lg:text-6xl">
              Todo para tu mascota
            </h1>
            <p className="font-display font-bold text-[#E8760A] mb-4
                          text-2xl sm:text-3xl md:text-4xl">
              en un solo lugar 🐾
            </p>
            <p className="font-body text-[#5C5C6B] text-base md:text-lg mb-6 max-w-md mx-auto md:mx-0">
              Alimentos, snacks, higiene, ropa y juguetes. Todo lo que tu compañero necesita.
            </p>

            {/* CTA BUTTONS */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
              <Link href="/productos">
                <Button variant="primary" size="lg">
                  Ver productos
                </Button>
              </Link>
              <a href="https://wa.me/5491166698395" target="_blank" rel="noopener noreferrer">
                <Button variant="whatsapp" size="lg">
                  💬 WhatsApp
                </Button>
              </a>
            </div>

            {/* TRUST BADGES */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-6">
              {[
                { icon: '🚚', text: 'Envío gratis a CABA' },
                { icon: '🔒', text: 'Compra segura' },
                { icon: '🐾', text: 'Productos originales' },
              ].map(badge => (
                <div key={badge.text} className="flex items-center gap-1.5 text-sm font-body text-[#5C5C6B]">
                  <span>{badge.icon}</span>
                  <span>{badge.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* HERO IMAGE */}
          <div className="flex-1 flex justify-center order-1 md:order-2">
            {/* Reemplazar con la imagen real del hero (Main.png) */}
            <div className="relative w-full max-w-sm md:max-w-md lg:max-w-lg">
              <Image
                src="/assets/hero-main.png"
                alt="Mascotas y productos MK-pets"
                width={600}
                height={450}
                className="w-full h-auto object-contain drop-shadow-xl"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}


// =============================================================================
// 7. SHIPPING BANNER — src/components/layout/ShippingBanner.tsx
// =============================================================================
// Siempre visible entre secciones importantes
// =============================================================================

export function ShippingBanner() {
  return (
    <div className="bg-[#16213E] text-white py-4 px-4">
      <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-center
                      justify-center gap-4 sm:gap-8 text-sm font-body">
        <div className="flex items-center gap-2">
          <span className="text-xl">🚚</span>
          <span><strong>Envío gratis</strong> a CABA en todos los pedidos</span>
        </div>
        <div className="hidden sm:block w-px h-5 bg-white/20" />
        <div className="flex items-center gap-2">
          <span className="text-xl">📞</span>
          <span>Consultas: <strong>11 6669 8395</strong></span>
        </div>
        <div className="hidden sm:block w-px h-5 bg-white/20" />
        <div className="flex items-center gap-2">
          <span className="text-xl">🔒</span>
          <span>Compra <strong>100% segura</strong></span>
        </div>
      </div>
    </div>
  )
}


// =============================================================================
// 8. CART DRAWER — src/components/cart/CartDrawer.tsx
// =============================================================================
// Portal sobre todo el contenido
// Slide-in desde la derecha
// Overlay oscuro con click-to-close
// =============================================================================

import { createPortal } from 'react-dom'
import { X, Trash2, Plus, Minus, ShoppingBag } from 'lucide-react'

interface CartItem {
  id: string
  productId: string
  name: string
  image: string
  variantLabel?: string
  quantity: number
  unitPrice: number
}

interface CartDrawerProps {
  isOpen: boolean
  onClose: () => void
  items: CartItem[]
  onUpdateQuantity: (itemId: string, qty: number) => void
  onRemoveItem: (itemId: string) => void
  onCheckout: () => void
}

const formatPrice = (n: number) =>
  `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`

export function CartDrawer({
  isOpen, onClose, items, onUpdateQuantity, onRemoveItem, onCheckout
}: CartDrawerProps) {
  const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)

  // Lock body scroll
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Carrito de compras">

      {/* OVERLAY */}
      <div
        className="flex-1 bg-black/50 animate-[fadeIn_0.2s_ease-out]"
        onClick={onClose}
      />

      {/* DRAWER PANEL */}
      <div className={cn(
        'relative flex flex-col',
        'w-full max-w-[400px] h-full',
        'bg-white shadow-[-8px_0_40px_rgba(0,0,0,0.15)]',
        'animate-[slideInRight_0.3s_ease-out]'
      )}>

        {/* HEADER */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#E8760A]" />
            <h2 className="font-display font-bold text-[#1A1A2E] text-lg">
              Tu carrito
              {totalItems > 0 && (
                <span className="ml-1.5 text-sm font-body text-[#5C5C6B] font-normal">
                  ({totalItems} {totalItems === 1 ? 'ítem' : 'ítems'})
                </span>
              )}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#5C5C6B] hover:text-[#1A1A2E] hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Cerrar carrito"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ITEMS */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            /* EMPTY STATE */
            <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
              <div className="text-6xl">🛒</div>
              <h3 className="font-display font-bold text-[#1A1A2E] text-lg">
                Tu carrito está vacío
              </h3>
              <p className="font-body text-[#5C5C6B] text-sm">
                Agregá productos y volvé acá para comprar
              </p>
              <Button variant="secondary" onClick={onClose}>
                Ver productos
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50 p-2">
              {items.map(item => (
                <li key={item.id} className="flex gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">

                  {/* IMAGEN */}
                  <div className="relative w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100">
                    <Image src={item.image} alt={item.name} fill className="object-contain p-1" />
                  </div>

                  {/* INFO */}
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-bold text-sm text-[#1A1A2E] line-clamp-2 leading-tight">
                      {item.name}
                    </p>
                    {item.variantLabel && (
                      <p className="text-xs font-body text-[#5C5C6B] mt-0.5">{item.variantLabel}</p>
                    )}
                    <p className="font-display font-black text-[#E8760A] text-base mt-1">
                      {formatPrice(item.unitPrice * item.quantity)}
                    </p>
                  </div>

                  {/* QUANTITY + DELETE */}
                  <div className="flex flex-col items-end justify-between gap-2 flex-shrink-0">
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="p-1 text-gray-300 hover:text-[#E53E3E] transition-colors"
                      aria-label={`Eliminar ${item.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center
                                  text-[#5C5C6B] hover:border-[#E8760A] hover:text-[#E8760A]
                                  disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        aria-label="Reducir cantidad"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center font-display font-bold text-sm text-[#1A1A2E]">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                        className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center
                                  text-[#5C5C6B] hover:border-[#E8760A] hover:text-[#E8760A] transition-colors"
                        aria-label="Aumentar cantidad"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* FOOTER — SUMMARY + CTA */}
        {items.length > 0 && (
          <div className="border-t border-gray-100 p-4 bg-white space-y-3">

            {/* SHIPPING NOTE */}
            <div className="flex items-center gap-2 bg-[#F0FAF0] rounded-xl px-3 py-2">
              <span className="text-base">🚚</span>
              <span className="text-xs font-body text-[#2D6A2D] font-medium">
                Envío gratis a CABA incluido
              </span>
            </div>

            {/* TOTALS */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm font-body text-[#5C5C6B]">
                <span>Subtotal</span>
                <span>{formatPrice(total)}</span>
              </div>
              <div className="flex justify-between text-sm font-body text-[#2D6A2D]">
                <span>Envío</span>
                <span className="font-bold">GRATIS</span>
              </div>
              <div className="flex justify-between font-display font-black text-[#1A1A2E] text-lg
                              border-t border-gray-100 pt-1.5">
                <span>Total</span>
                <span className="text-[#E8760A]">{formatPrice(total)}</span>
              </div>
            </div>

            {/* CTA BUTTONS */}
            <Button variant="primary" size="full" onClick={onCheckout}>
              Ir al checkout →
            </Button>
            <Button variant="ghost" size="full" onClick={onClose}>
              Seguir comprando
            </Button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}


// =============================================================================
// 9. PAYMENT SELECTOR — src/components/checkout/PaymentSelector.tsx
// =============================================================================

type PaymentMethod = 'MERCADOPAGO' | 'CASH_ON_DELIVERY'

interface PaymentSelectorProps {
  selected: PaymentMethod | null
  onChange: (method: PaymentMethod) => void
}

export function PaymentSelector({ selected, onChange }: PaymentSelectorProps) {
  const options: { method: PaymentMethod; icon: string; title: string; subtitle: string }[] = [
    {
      method: 'MERCADOPAGO',
      icon: '💙',
      title: 'MercadoPago',
      subtitle: 'Tarjeta, débito, dinero en cuenta MP',
    },
    {
      method: 'CASH_ON_DELIVERY',
      icon: '💵',
      title: 'Pagar al recibir',
      subtitle: 'Efectivo o transferencia bancaria',
    },
  ]

  return (
    <div className="space-y-3" role="radiogroup" aria-label="Método de pago">
      {options.map(opt => (
        <button
          key={opt.method}
          role="radio"
          aria-checked={selected === opt.method}
          onClick={() => onChange(opt.method)}
          className={cn(
            'w-full flex items-center gap-4 p-4 rounded-[16px] border-2 text-left',
            'transition-all duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8760A]',
            selected === opt.method
              ? 'border-[#E8760A] bg-[#FFF0E0]'
              : 'border-gray-200 bg-white hover:border-gray-300'
          )}
        >
          {/* RADIO INDICATOR */}
          <div className={cn(
            'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
            selected === opt.method ? 'border-[#E8760A]' : 'border-gray-300'
          )}>
            {selected === opt.method && (
              <div className="w-2.5 h-2.5 rounded-full bg-[#E8760A]" />
            )}
          </div>

          <span className="text-2xl">{opt.icon}</span>

          <div className="flex-1">
            <p className="font-display font-bold text-[#1A1A2E] text-base">{opt.title}</p>
            <p className="font-body text-[#5C5C6B] text-sm">{opt.subtitle}</p>
          </div>
        </button>
      ))}
    </div>
  )
}


// =============================================================================
// 10. STEP INDICATOR — src/components/checkout/StepIndicator.tsx
// =============================================================================

interface StepIndicatorProps {
  currentStep: 1 | 2
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const steps = [
    { number: 1, label: 'Pago' },
    { number: 2, label: 'Entrega' },
  ]

  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((step, index) => (
        <div key={step.number} className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-1">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center',
              'font-display font-bold text-sm transition-colors duration-300',
              currentStep > step.number
                ? 'bg-[#2D6A2D] text-white'           // done
                : currentStep === step.number
                  ? 'bg-[#E8760A] text-white'           // active
                  : 'bg-gray-200 text-[#5C5C6B]'        // pending
            )}>
              {currentStep > step.number ? '✓' : step.number}
            </div>
            <span className={cn(
              'text-xs font-body',
              currentStep === step.number ? 'text-[#E8760A] font-medium' : 'text-[#5C5C6B]'
            )}>
              {step.label}
            </span>
          </div>

          {/* CONNECTOR */}
          {index < steps.length - 1 && (
            <div className={cn(
              'w-12 h-0.5 mb-4 rounded-full transition-colors duration-300',
              currentStep > step.number ? 'bg-[#2D6A2D]' : 'bg-gray-200'
            )} />
          )}
        </div>
      ))}
    </div>
  )
}


// =============================================================================
// 11. ORDER NUMBER DISPLAY — src/components/checkout/OrderNumberDisplay.tsx
// =============================================================================

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface OrderNumberDisplayProps {
  orderNumber: string
}

export function OrderNumberDisplay({ orderNumber }: OrderNumberDisplayProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(orderNumber)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-[#FFF0E0] border-2 border-[#E8760A] rounded-[16px] p-6 text-center">
      <p className="font-body text-[#5C5C6B] text-sm mb-2">Tu número de pedido</p>
      <p className="font-display font-black text-3xl text-[#E8760A] tracking-widest mb-4">
        {orderNumber}
      </p>
      <button
        onClick={handleCopy}
        className={cn(
          'inline-flex items-center gap-1.5 px-4 py-2 rounded-pill',
          'text-sm font-body font-medium transition-all duration-200',
          copied
            ? 'bg-[#2D6A2D] text-white'
            : 'bg-white text-[#5C5C6B] border border-gray-200 hover:border-[#E8760A] hover:text-[#E8760A]'
        )}
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        {copied ? '¡Copiado!' : 'Copiar número'}
      </button>
    </div>
  )
}


// =============================================================================
// 12. TOAST NOTIFICATION — src/components/ui/Toast.tsx
// =============================================================================
// Aparece bottom-right (mobile: bottom-center)
// Auto-dismiss en 2.5s
// =============================================================================

import { CheckCircle2, AlertCircle, Info } from 'lucide-react'

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'info'
  onDismiss?: () => void
}

export function Toast({ message, type = 'success', onDismiss }: ToastProps) {
  const config = {
    success: {
      bg: 'bg-[#1A1A2E]',
      icon: <CheckCircle2 className="w-5 h-5 text-[#38A169] flex-shrink-0" />,
    },
    error: {
      bg: 'bg-[#1A1A2E]',
      icon: <AlertCircle className="w-5 h-5 text-[#E53E3E] flex-shrink-0" />,
    },
    info: {
      bg: 'bg-[#1A1A2E]',
      icon: <Info className="w-5 h-5 text-[#3B82F6] flex-shrink-0" />,
    },
  }

  useEffect(() => {
    const timer = setTimeout(() => onDismiss?.(), 2500)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div className={cn(
      'fixed bottom-4 right-4 left-4 sm:left-auto sm:w-auto sm:max-w-sm z-50',
      'flex items-center gap-3 px-4 py-3 rounded-[14px]',
      'text-white font-body text-sm',
      'shadow-[0_8px_32px_rgba(0,0,0,0.25)]',
      'animate-[slideInRight_0.3s_ease-out]',
      config[type].bg
    )}>
      {config[type].icon}
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss} className="p-0.5 opacity-60 hover:opacity-100 transition-opacity">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

/* TOAST USAGE (via Zustand toast store):
  addToast({ message: '✓ Catit Creamy agregado al carrito', type: 'success' })
*/


// =============================================================================
// 13. SKELETON LOADER — src/components/ui/Skeleton.tsx
// =============================================================================

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn(
      'animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200',
      'bg-[length:400%_100%]',
      'rounded-lg',
      className
    )} />
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-[16px] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-9 w-full rounded-pill" />
      </div>
    </div>
  )
}


// =============================================================================
// 14. FOOTER — src/components/layout/Footer.tsx
// =============================================================================

export function Footer() {
  return (
    <footer className="bg-[#16213E] text-white">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">

          {/* BRAND */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 bg-[#E8760A] rounded-full" />
              <span className="font-display font-black text-xl">
                MK-<span className="text-[#E8760A]">pets</span>
              </span>
            </div>
            <p className="font-body text-white/60 text-sm leading-relaxed">
              Tu mascota, nuestra prioridad. Todo lo que tu compañero necesita en un solo lugar.
            </p>
          </div>

          {/* CONTACT */}
          <div>
            <h3 className="font-display font-bold text-sm uppercase tracking-wide text-white/40 mb-3">
              Contacto
            </h3>
            <ul className="space-y-2 font-body text-sm text-white/80">
              <li>
                <a href="https://wa.me/5491166698395" className="flex items-center gap-2 hover:text-white transition-colors">
                  <span>💬</span> WhatsApp: 11 6669 8395
                </a>
              </li>
              <li className="flex items-center gap-2">
                <span>🚚</span> Envío gratis a CABA
              </li>
              <li className="flex items-center gap-2">
                <span>🕐</span> Lun–Sáb 9:00–20:00
              </li>
            </ul>
          </div>

          {/* CATEGORIES */}
          <div>
            <h3 className="font-display font-bold text-sm uppercase tracking-wide text-white/40 mb-3">
              Categorías
            </h3>
            <ul className="space-y-1.5 font-body text-sm text-white/80">
              {[
                ['🐱', 'Gatos', 'gatos'],
                ['🐶', 'Perros', 'perros'],
                ['🍬', 'Snacks', 'snacks'],
                ['🧴', 'Higiene', 'higiene'],
                ['🎾', 'Juguetes', 'juguetes'],
              ].map(([emoji, label, slug]) => (
                <li key={slug}>
                  <Link
                    href={`/productos?cat=${slug}`}
                    className="flex items-center gap-1.5 hover:text-white transition-colors"
                  >
                    <span>{emoji}</span> {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* BOTTOM BAR */}
        <div className="border-t border-white/10 mt-8 pt-6 flex flex-col sm:flex-row
                        items-center justify-between gap-3 text-xs font-body text-white/40">
          <span>© 2026 MK-Pets. Todos los derechos reservados.</span>
          <div className="flex items-center gap-4">
            <span>🔒 Compra segura</span>
            <span>🐾 Productos originales</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
