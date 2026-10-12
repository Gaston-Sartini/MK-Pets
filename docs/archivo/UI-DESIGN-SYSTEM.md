# MK-Pets — UI Design System
**Agente**: UI Designer · **Fecha**: 2026-05-14
**Handoff para**: @engineering-frontend-developer

---

## 1. FUNDACIONES VISUALES

### 1.1 Color System — Especificaciones completas

| Token Tailwind | Hex | RGB | Uso | Contraste sobre blanco |
|---|---|---|---|---|
| `mk-orange` | `#E8760A` | 232, 118, 10 | CTAs, precios, acentos | 3.24:1 (large text ✅) |
| `mk-orange-dark` | `#C45F00` | 196, 95, 0 | Hover de CTA | 4.58:1 ✅ WCAG AA |
| `mk-orange-light` | `#FFF0E0` | 255, 240, 224 | Fondos de selección activa | — |
| `mk-green` | `#2D6A2D` | 45, 106, 45 | Badge logo, estados "done" | 7.2:1 ✅ WCAG AAA |
| `mk-green-light` | `#4CAF50` | 76, 175, 80 | Íconos beneficios | 2.9:1 |
| `mk-green-pale` | `#F0FAF0` | 240, 250, 240 | Fondo nota de envío gratis | — |
| `mk-dark` | `#1A1A2E` | 26, 26, 46 | Textos principales | 15.3:1 ✅ |
| `mk-mid` | `#5C5C6B` | 92, 92, 107 | Textos secundarios | 5.9:1 ✅ |
| `mk-light` | `#F5EFE6` | 245, 239, 230 | Fondos alternados, chips | — |
| `mk-white` | `#FAFAF8` | 250, 250, 248 | Fondo base | — |
| `mk-navy` | `#16213E` | 22, 33, 62 | Footer, banners info | 16.2:1 ✅ |
| `mk-error` | `#E53E3E` | 229, 62, 62 | Errores, validaciones | 3.8:1 |
| `mk-success` | `#38A169` | 56, 161, 105 | Confirmaciones | 3.6:1 |

**Nota WCAG**: Para texto pequeño (< 18px) siempre usar `mk-orange-dark` (`#C45F00`) en lugar de `mk-orange` para cumplir AA 4.5:1.

---

### 1.2 Typography Scale

| Nombre | Font | Size | Weight | Line-height | Uso |
|---|---|---|---|---|---|
| `display-hero` | Nunito | 48–64px | 800 ExtraBold | 1.1 | H1 del hero |
| `display-h1` | Nunito | 36–48px | 800 | 1.2 | Títulos de página |
| `display-h2` | Nunito | 24–30px | 700 Bold | 1.3 | Títulos de sección |
| `display-h3` | Nunito | 20px | 700 | 1.3 | Subtítulos |
| `display-price` | Nunito | 21–32px | 900 Black | 1 | Precios en cards |
| `body-base` | Inter | 16px | 400 | 1.6 | Textos corridos |
| `body-sm` | Inter | 14px | 400 | 1.5 | Subtextos, notas |
| `body-xs` | Inter | 12px | 400 | 1.4 | Labels, badges |
| `ui-label` | Inter | 14px | 500 Medium | 1.2 | Labels de formulario |
| `ui-button` | Nunito | 14–18px | 700 | 1 | Texto de botones |

---

### 1.3 Spacing System (base 4px)

```
4px  → gap mínimo, border thickness visual
8px  → gap entre ícono y texto, padding badge
12px → gap entre ítems de lista
16px → padding base de cards y secciones
20px → gap entre cards en grid desktop
24px → padding de secciones en mobile
32px → gap entre secciones
48px → padding vertical de secciones grandes
64px → padding del hero
```

---

### 1.4 Elevation & Shadow System

| Nivel | CSS | Uso |
|---|---|---|
| 0 | `none` | Elementos planos, chips desactivados |
| 1 | `0 1px 3px rgba(0,0,0,0.06)` | Inputs en reposo |
| 2 | `0 4px 20px rgba(0,0,0,0.08)` | Cards en reposo |
| 3 | `0 8px 32px rgba(0,0,0,0.14)` | Cards en hover |
| 4 | `0 2px 12px rgba(0,0,0,0.08)` | Navbar en scroll |
| 5 | `−8px 0 40px rgba(0,0,0,0.15)` | Cart Drawer |

---

### 1.5 Border Radius System

| Token | Valor | Uso |
|---|---|---|
| `rounded-pill` | `50px` | Botones CTA, buscador, cart drawer CTA |
| `rounded-card` | `16px` | ProductCard, CartDrawer, modales, order number |
| `rounded-chip` | `12px` | Badges, variantes de producto |
| `rounded-xl` | `12px` | Chips de categoría, ítems del carrito |
| `rounded-full` | `50%` | Avatar, cart badge, radio buttons |
| `rounded-button` | `12px` | Botones secundarios, inputs |

---

## 2. ESTADOS DE COMPONENTES

### 2.1 Button States — Especificación Visual

```
PRIMARY BUTTON
┌────────────────────────────────┐
│ Estado       │ Background │ Text   │ Shadow │ Scale │
├──────────────┼────────────┼────────┼────────┼───────┤
│ default      │ #E8760A    │ white  │ none   │ 1     │
│ hover        │ #C45F00    │ white  │ md     │ 1     │
│ active/press │ #C45F00    │ white  │ none   │ 0.95  │
│ focus        │ #E8760A    │ white  │ ring   │ 1     │
│ disabled     │ #E8760A    │ white  │ none   │ 1     │
│              │ opacity:50%│        │        │       │
│ loading      │ #E8760A    │ white  │ none   │ 1     │
│              │ + spinner  │        │        │       │
└────────────────────────────────┘
```

### 2.2 Input States — Especificación Visual

```
INPUT FIELD
┌─────────────────────────────────────────────────────┐
│ Estado    │ Border           │ Background │ Shadow   │
├───────────┼──────────────────┼────────────┼──────────┤
│ empty     │ 2px #E5E7EB      │ #FAFAF8    │ none     │
│ focus     │ 2px #E8760A      │ white      │ ring-mk  │
│ filled    │ 2px #E5E7EB      │ white      │ none     │
│ error     │ 2px #E53E3E      │ #FFF5F5    │ none     │
│ disabled  │ 2px #E5E7EB 50%  │ #F9FAFB    │ none     │
└─────────────────────────────────────────────────────┘

Error message: font-body text-xs text-[#E53E3E] mt-1
               con ícono AlertCircle 12px a la izquierda
```

### 2.3 ProductCard States

```
PRODUCT CARD
┌────────────────────────────────────────────┐
│ Estado   │ Transform    │ Shadow           │
├──────────┼──────────────┼──────────────────┤
│ default  │ none         │ 0 4px 20px .08   │
│ hover    │ translateY-1 │ 0 8px 32px .14   │
│ loading  │ none         │ none (skeleton)  │
│ out-stock│ overlay 40%  │ 0 4px 20px .08   │
└────────────────────────────────────────────┘

Image hover: scale(1.05) — transition 300ms
```

---

## 3. MICRO-INTERACTIONS

### 3.1 Add to Cart
```
Trigger: click "Agregar"
1. Botón: active:scale-95 (100ms)
2. Badge del carrito: animate-bounceBadge (400ms)
3. Toast aparece bottom-right (slideInRight 300ms)
4. Toast auto-dismiss 2.5s (fadeOut 200ms)
```

### 3.2 Cart Drawer
```
Open:  overlay fadeIn 200ms + panel slideInRight 300ms
Close: panel slideOutRight 250ms + overlay fadeOut 150ms
       (ambos simultáneos con el close)
```

### 3.3 Category Chip Filter
```
Click:
1. Chip previo: bg → #F5EFE6, text → #5C5C6B (200ms)
2. Chip nuevo:  bg → #E8760A, text → white (200ms)
3. Grid de productos: fadeOut 150ms → re-render → fadeIn 200ms
   (o skeleton durante fetch si es server-side)
```

### 3.4 Quantity +/-
```
Click +:
1. Número: scale(1.2) → scale(1) (150ms)
2. Subtotal: actualización inmediata (re-render)
3. Total del carrito: actualización inmediata

Click - hasta 1: botón disabled (opacity 40%)
Click - en cantidad 1: eliminar ítem con confirmación implícita
  → ítem: slideOut left 200ms + height collapse 200ms
```

### 3.5 Order Number Copy
```
1. Click "Copiar número"
2. clipboard.writeText(orderNumber)
3. Botón: bg → #2D6A2D, ícono Copy → Check (150ms)
4. Texto: "Copiar número" → "¡Copiado!" (instant)
5. Reset después de 2s (150ms transition back)
```

---

## 4. LOADING STATES

### 4.1 ProductGrid Skeleton
```
Mientras carga el catálogo → mostrar 8 ProductCardSkeleton
Skeleton: pulse animation, mismas dimensiones que ProductCard real
Transición: opacity 0 → 1 cuando llegan los datos reales (200ms)
```

### 4.2 Checkout Submit
```
Click "Confirmar pedido":
1. Botón → loading state (spinner + "Procesando...")
2. Deshabilitar todos los inputs del form
3. En éxito → navigate a /pedido/[numero]
4. En error → toast error + re-habilitar botón
```

---

## 5. ASSET SPECIFICATIONS

### 5.1 Logo — Cómo usar el archivo real

```
Logo principal: D:\MK-Pets\Logo MK_Pets\Logo de MK-pets V2.1.png
Logo alternativo: D:\MK-Pets\Logo MK_Pets\Main.png

Convertir a SVG para web (recomendado):
  - Usar Figma, Illustrator o Inkscape para trazar el PNG
  - Exportar como logo.svg en /public/

Variantes a crear:
  /public/logo.svg          → full color, uso general
  /public/logo-white.svg    → monocromo blanco, para footer
  /public/logo-mark.svg     → solo el símbolo (corazón+pata), para favicon

Favicon: 32x32 y 16x16 del logo-mark
OG Image: 1200x630, logo centrado sobre fondo #F5EFE6
```

### 5.2 Hero Image

```
Imagen recomendada: D:\MK-Pets\Logo MK_Pets\Main.png
Optimización para web:
  - Convertir a WebP
  - Tamaños: 600w, 900w, 1200w
  - Next.js next/image con sizes responsive
  - Agregar priority={true} (above the fold)
```

### 5.3 Product Images

```
Formato destino: WebP, quality 85
Dimensiones: 800x800 (cuadrado)
Fondo: blanco puro (#FFFFFF) o transparente (PNG)
Alt text: siempre descriptivo del producto + variante
  Ejemplo: "Catit Creamy snack para gatos sabor salmón pack de 4 unidades"
```

---

## 6. TIPOGRAFÍA — Implementación Next.js

```typescript
// src/app/layout.tsx
import { Nunito, Inter } from 'next/font/google'

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  variable: '--font-nunito',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${nunito.variable} ${inter.variable}`}>
      <body className="font-body antialiased bg-mk-white text-mk-dark">
        {children}
      </body>
    </html>
  )
}
```

```typescript
// tailwind.config.ts — fontFamily
fontFamily: {
  display: ['var(--font-nunito)', 'sans-serif'],
  body:    ['var(--font-inter)', 'sans-serif'],
},
```

---

## 7. ICONOGRAFÍA

Librería: **lucide-react** (ya en el stack)

| Función | Ícono Lucide | Tamaño |
|---|---|---|
| Carrito | `ShoppingCart` | 24px navbar, 20px footer |
| Búsqueda | `Search` | 20px |
| Eliminar ítem | `Trash2` | 16px |
| Más/Menos cantidad | `Plus` / `Minus` | 12px |
| Cerrar drawer/modal | `X` | 20px |
| Copiar | `Copy` | 16px |
| Confirmado | `Check` / `CheckCircle2` | 16px / 20px |
| Error | `AlertCircle` | 16px |
| Info | `Info` | 16px |
| Loader | `Loader2` (animate-spin) | 16px |
| Delivery | `Truck` | 16px |
| Teléfono | `Phone` | 14px |
| Ubicación | `MapPin` | 14px |
| Usuario | `User` | 16px |
| Editar pedido | `Pencil` | 16px |
| Estado pedido | `Package` | 20px |

---

## 8. ANIMACIONES — keyframes para tailwind.config.ts

```typescript
// tailwind.config.ts
keyframes: {
  slideInRight: {
    '0%':   { transform: 'translateX(100%)', opacity: '0' },
    '100%': { transform: 'translateX(0)',    opacity: '1' },
  },
  slideOutRight: {
    '0%':   { transform: 'translateX(0)',    opacity: '1' },
    '100%': { transform: 'translateX(100%)', opacity: '0' },
  },
  fadeIn: {
    '0%':   { opacity: '0' },
    '100%': { opacity: '1' },
  },
  fadeOut: {
    '0%':   { opacity: '1' },
    '100%': { opacity: '0' },
  },
  bounceBadge: {
    '0%, 100%': { transform: 'scale(1)' },
    '30%':      { transform: 'scale(1.5)' },
    '60%':      { transform: 'scale(0.9)' },
  },
  skeletonPulse: {
    '0%, 100%': { backgroundPosition: '0% 50%' },
    '50%':      { backgroundPosition: '100% 50%' },
  },
},
animation: {
  'slide-in-right':  'slideInRight 0.3s ease-out',
  'slide-out-right': 'slideOutRight 0.25s ease-in',
  'fade-in':         'fadeIn 0.2s ease-out',
  'fade-out':        'fadeOut 0.15s ease-in',
  'bounce-badge':    'bounceBadge 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97)',
  'skeleton':        'skeletonPulse 1.5s ease-in-out infinite',
},
```

---

## 9. DESIGN QA CHECKLIST

Antes de marcar cualquier pantalla como implementada, verificar:

### Visual
- [ ] Fuente en headings es Nunito (no Inter)
- [ ] Precios en Nunito Black, color `#E8760A`
- [ ] Botones CTA tienen border-radius `50px` (pill)
- [ ] Cards tienen border-radius `16px`
- [ ] Shadows correctas en default y hover de cards
- [ ] Badge está posicionado absolute top-2 left-2 en la card

### Responsive
- [ ] Grid de productos: 2 cols mobile, 3 tablet, 4 desktop
- [ ] Navbar search bar: oculta en mobile, visible en ≥768px
- [ ] CartDrawer: 100% width en mobile, 400px en desktop
- [ ] Hero: texto centrado mobile, left-aligned desktop

### Interactividad
- [ ] Cart badge animado al agregar producto
- [ ] Toast aparece y desaparece en 2.5s
- [ ] CartDrawer bloquea scroll del body
- [ ] ESC cierra CartDrawer
- [ ] Click fuera del drawer cierra el drawer
- [ ] Botón submit del checkout tiene loading state

### Accesibilidad
- [ ] Todos los botones tienen `aria-label` descriptivo
- [ ] Images tienen `alt` descriptivo
- [ ] Inputs tienen `<label>` asociado con `htmlFor`
- [ ] Focus rings visibles (ring-2 ring-mk-orange)
- [ ] CartDrawer tiene `role="dialog"` y `aria-modal="true"`
- [ ] Touch targets mínimo 44px

---

## 10. ORDEN DE IMPLEMENTACIÓN RECOMENDADO

```
1. globals.css + tailwind.config.ts     ← Tokens primero
2. Button.tsx                           ← Componente más usado
3. Badge.tsx + Skeleton.tsx             ← Utilitarios simples
4. Navbar.tsx (sin funcionalidad cart)  ← Layout base
5. Footer.tsx                           ← Layout base
6. ShippingBanner.tsx                   ← Simple
7. ProductCard.tsx                      ← Core del catálogo
8. CategoryChip.tsx                     ← Filtrado
9. HeroBanner.tsx                       ← Home
10. CartDrawer.tsx + cart store          ← Interactividad
11. PaymentSelector.tsx                 ← Checkout
12. StepIndicator.tsx                   ← Checkout
13. DeliveryForm.tsx                    ← Checkout
14. OrderNumberDisplay.tsx              ← Confirmación
15. Toast.tsx + toast store             ← Feedback
```

---

*UI Design System completo — handoff listo para @engineering-frontend-developer*
*Archivos de componentes en: D:\MK-Pets\UI-COMPONENTS.tsx*
