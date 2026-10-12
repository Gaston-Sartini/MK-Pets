# MK-Pets — UX Foundation & Design System
**Agente**: UX Architect · **Fecha**: 2026-05-14
**Handoff para**: Frontend Developer (@engineering-frontend-developer)

---

## 1. ARQUITECTURA DE INFORMACIÓN

### 1.1 Mapa de Navegación

```
mkpets.com/
├── /                          → Home
├── /productos                 → Catálogo (todos)
│   └── /productos?cat=gatos   → Catálogo filtrado
├── /producto/[slug]           → Detalle de producto
├── /carrito                   → Carrito (también como drawer global)
├── /checkout                  → Checkout (2 pasos)
├── /pedido/[numero]           → Estado del pedido
│   └── /pedido/[numero]/modificar → Modificar pedido
└── /admin                     → Panel admin (protegido)
    ├── /admin/productos
    └── /admin/pedidos
```

### 1.2 User Flows Principales

#### FLOW 1: Compra Completa (happy path)
```
HOME → [ver producto destacado] → DETALLE → [seleccionar variante]
     → [agregar al carrito] → CART DRAWER → [ir al checkout]
     → CHECKOUT PASO 1 [elegir método de pago]
     → CHECKOUT PASO 2 [completar datos de entrega]
     → [confirmar pedido]
          ├── MercadoPago: → [redirect a MP] → [pagar] → CONFIRMACIÓN
          └── Efectivo:    → CONFIRMACIÓN (directo)
     → CONFIRMACIÓN [ver número de pedido + guardado en cache]
```

#### FLOW 2: Recuperar Pedido desde Cache
```
HOME → [detecta cookie mkpets_order] → banner "Tenés un pedido activo"
     → [click] → ESTADO DEL PEDIDO
```

#### FLOW 3: Buscar y Filtrar
```
HOME → [click en categoría] → CATÁLOGO FILTRADO
HOME → [usar buscador] → CATÁLOGO con resultados
CATÁLOGO → [cambiar chip de categoría] → actualiza grilla (sin reload)
```

#### FLOW 4: Modificar Pedido (ventana 30min)
```
ESTADO DEL PEDIDO → [si status=PENDING y < 30min]
→ [click "Modificar pedido"] → MODIFICAR PEDIDO
→ [editar cantidades / eliminar ítems]
→ [confirmar cambios] → ESTADO DEL PEDIDO actualizado
```

---

## 2. WIREFRAMES POR PANTALLA

### 2.1 NAVBAR (global — mobile y desktop)

```
MOBILE (375px)
┌─────────────────────────────────────────────┐
│ [🐾 Logo]              [🔍]  [🛒 (3)]       │
│  MK-pets                                    │
└─────────────────────────────────────────────┘

DESKTOP (1280px)
┌─────────────────────────────────────────────────────────────────────┐
│  [🐾 MK-pets]   [     🔍 Buscar productos...          ]  [📞 WhatsApp]  [🛒 Carrito (3)] │
│                  ─────────────────────────────────────               │
│  Gatos  Perros  Snacks  Higiene  Juguetes  Ropa                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Comportamiento:**
- Logo: siempre visible, click → home
- Buscador mobile: click en [🔍] expande barra de búsqueda en segunda línea
- Cart icon: badge naranja con número de ítems, click → abre CartDrawer
- WhatsApp: visible solo en desktop, ícono + número
- Sub-nav de categorías: solo desktop; en mobile son chips en la home/catálogo
- Sticky en scroll (sombra suave al hacer scroll)

---

### 2.2 HOME

```
MOBILE (375px)
┌─────────────────────────────────────────────┐
│ NAVBAR                                      │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │                                     │   │
│  │   [Foto mascota + productos]        │   │
│  │                                     │   │
│  │  Todo para tu mascota               │   │
│  │  en un solo lugar 🐾                │   │
│  │                                     │   │
│  │  [  Ver productos  ]  [  WhatsApp ] │   │
│  │                                     │   │
│  │  🚚 Envío gratis a CABA             │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ← CATEGORÍAS (scroll horizontal) →        │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│  │ 🐱   │ │ 🐶   │ │ 🍬   │ │ 🪨   │  →  │
│  │Gatos │ │Perros│ │Snacks│ │Arena │      │
│  └──────┘ └──────┘ └──────┘ └──────┘      │
│                                             │
│  ⭐ MÁS VENDIDOS                            │
│  ┌──────────────┐  ┌──────────────┐        │
│  │ [img]        │  │ [img]        │        │
│  │ 🟠 NUEVO     │  │              │        │
│  │ Catit Creamy │  │ Rubicat 15kg │        │
│  │ $4.800       │  │ $15.000      │        │
│  │ [+ Agregar]  │  │ [+ Agregar]  │        │
│  └──────────────┘  └──────────────┘        │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  🚚 ENVÍO GRATIS A CABA             │   │
│  │  En todos tus pedidos               │   │
│  │  📞 11 6669 8395                    │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  🐱 LÍNEA GATOS                            │
│  ┌──────────────┐  ┌──────────────┐        │
│  │ [img]        │  │ [img]        │        │
│  │ Nutrique     │  │ Purina Excl. │        │
│  │ $37.000      │  │ $8.300       │        │
│  │ [+ Agregar]  │  │ [+ Agregar]  │        │
│  └──────────────┘  └──────────────┘        │
│  [  Ver todos los productos de gatos  ]     │
│                                             │
│  🐶 LÍNEA PERROS                           │
│  ... (mismo patrón)                         │
│                                             │
│  🍬 SNACKS                                 │
│  ... (mismo patrón)                         │
│                                             │
│ FOOTER                                      │
└─────────────────────────────────────────────┘

DESKTOP (1280px) — Grid 4 columnas para products
┌────────────────────────────────────────────────────────────────┐
│ NAVBAR                                                         │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                 HERO (full width)                        │ │
│  │  [Foto mascotas izq]    Todo para tu mascota 🐾  [Foto] │ │
│  │                         en un solo lugar                 │ │
│  │                         [ Ver productos ] [WhatsApp]     │ │
│  │                         🚚 Envío gratis a CABA           │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ⭐ MÁS VENDIDOS                              [Ver todos →]   │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐              │
│  │ [img]  │  │ [img]  │  │ [img]  │  │ [img]  │              │
│  │ NUEVO  │  │        │  │ OFERTA │  │        │              │
│  │ Catit  │  │Rubicat │  │Old Pr. │  │Nutrique│              │
│  │ $4.800 │  │$15.000 │  │ $6.300 │  │$37.000 │              │
│  │[+Agr.] │  │[+Agr.] │  │[+Agr.] │  │[+Agr.] │              │
│  └────────┘  └────────┘  └────────┘  └────────┘              │
│                                                                │
│  [BANNER: 🚚 Envío gratis a CABA · 📞 11 6669 8395]          │
│                                                                │
│  🐱 LÍNEA GATOS                               [Ver todos →]   │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐              │
│  │  ...   │  │  ...   │  │  ...   │  │  ...   │              │
│  └────────┘  └────────┘  └────────┘  └────────┘              │
└────────────────────────────────────────────────────────────────┘
```

---

### 2.3 CATÁLOGO

```
MOBILE
┌─────────────────────────────────────────────┐
│ NAVBAR                                      │
├─────────────────────────────────────────────┤
│ Productos (124)                             │
│                                             │
│ ← CHIPS (scroll horizontal) →              │
│ [Todos ✓] [🐱 Gatos] [🐶 Perros] [🍬 Snacks] [→]│
│                                             │
│  ┌──────────────┐  ┌──────────────┐        │
│  │ [img]        │  │ [img]        │        │
│  │              │  │ 🟠 NUEVO     │        │
│  │ Catit Creamy │  │ Sabrositos   │        │
│  │ Pack x4      │  │ 15 KG        │        │
│  │ $4.800       │  │ $26.500      │        │
│  │ [+ Agregar]  │  │ [+ Agregar]  │        │
│  └──────────────┘  └──────────────┘        │
│                                             │
│  ┌──────────────┐  ┌──────────────┐        │
│  │ ...          │  │ ...          │        │
│  └──────────────┘  └──────────────┘        │
│                                             │
│  [Cargando más...]  ← infinite scroll       │
└─────────────────────────────────────────────┘

DESKTOP
┌────────────────────────────────────────────────┐
│ NAVBAR                                         │
├────────────────────────────────────────────────┤
│                                                │
│ Chips: [Todos] [🐱 Gatos] [🐶 Perros] [🍬 Snacks] [💧 Húmedos] [🪨 Arena] [🧴 Higiene] [👕 Ropa] [🎾 Juguetes]│
│                                                │
│ Productos (124)              Ordenar: [Más vendidos ▾]│
│                                                │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐           │
│ │[img] │ │[img] │ │[img] │ │[img] │           │
│ │NUEVO │ │      │ │OFERTA│ │      │           │
│ │Catit │ │Rubic.│ │OldPr.│ │Nutr. │           │
│ │$4.800│ │$15k  │ │$6.300│ │$37k  │           │
│ │[+Agr]│ │[+Agr]│ │[+Agr]│ │[+Agr]│           │
│ └──────┘ └──────┘ └──────┘ └──────┘           │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐           │
│ │ ...  │ │ ...  │ │ ...  │ │ ...  │           │
│ └──────┘ └──────┘ └──────┘ └──────┘           │
└────────────────────────────────────────────────┘
```

---

### 2.4 DETALLE DE PRODUCTO

```
MOBILE
┌─────────────────────────────────────────────┐
│ NAVBAR                                      │
├─────────────────────────────────────────────┤
│ ← Volver al catálogo                        │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │                                     │   │
│  │           [IMAGEN PRODUCTO]         │   │
│  │                                     │   │
│  └─────────────────────────────────────┘   │
│  ● ○ ○    ← dots indicador galería         │
│                                             │
│  🟠 NUEVO                                   │
│  Catit Creamy — Snacks para Gatos           │
│  ⭐⭐⭐⭐⭐ (próxima versión)                │
│                                             │
│  VARIANTE:                                  │
│  [Pack x4 ✓] [Pack x8]                     │
│                                             │
│  $4.800                                     │
│  por unidad                                 │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │        [+ Agregar al carrito]        │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  ✅ Sin colorantes ni sabores artificiales  │
│  ✅ Textura cremosa y suave                 │
│  ✅ 3 sabores: Salmón, Pollo, Atún          │
│                                             │
│  ─────────────────────────────────────────  │
│  DESCRIPCIÓN                                │
│  Snack líquido ideal para premiar,          │
│  mezclar o consentir a tu gato...          │
│                                             │
│  ─────────────────────────────────────────  │
│  🚚 Envío gratis a CABA                     │
│  💬 Consultas: 11 6669 8395                 │
│                                             │
│  TAMBIÉN TE PUEDE GUSTAR                    │
│  ┌──────────────┐  ┌──────────────┐        │
│  │ [img]        │  │ [img]        │        │
│  │ Cat Chow     │  │ Whiskas      │        │
│  │ $2.500       │  │ $1.800       │        │
│  └──────────────┘  └──────────────┘        │
└─────────────────────────────────────────────┘
```

---

### 2.5 CART DRAWER

```
┌─────────────────────────────────────────────────────────────────────┐
│  [OVERLAY OSCURO 50% opacity]        ┌───────────────────────────┐  │
│                                      │ Tu carrito               ✕│  │
│                                      ├───────────────────────────┤  │
│                                      │ ┌───────────────────────┐ │  │
│                                      │ │[img] Catit Creamy x4   │ │  │
│                                      │ │      Pack x4           │ │  │
│                                      │ │      $4.800         🗑 │ │  │
│                                      │ │      [−] 2 [+]         │ │  │
│                                      │ └───────────────────────┘ │  │
│                                      │ ┌───────────────────────┐ │  │
│                                      │ │[img] Rubicat 15 KG     │ │  │
│                                      │ │      $15.000        🗑 │ │  │
│                                      │ │      [−] 1 [+]         │ │  │
│                                      │ └───────────────────────┘ │  │
│                                      │ ┌───────────────────────┐ │  │
│                                      │ │[img] Old Prince 1 KG   │ │  │
│                                      │ │      $6.300         🗑 │ │  │
│                                      │ │      [−] 1 [+]         │ │  │
│                                      │ └───────────────────────┘ │  │
│                                      ├───────────────────────────┤  │
│                                      │ 🚚 Envío gratis a CABA    │  │
│                                      │ ─────────────────────     │  │
│                                      │ Subtotal          $26.100 │  │
│                                      │ Envío             GRATIS  │  │
│                                      │ ─────────────────────     │  │
│                                      │ TOTAL             $26.100 │  │
│                                      │                           │  │
│                                      │ [ Ir al checkout →      ] │  │
│                                      │ [ Seguir comprando       ] │  │
│                                      └───────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 2.6 CHECKOUT — PASO 1: Método de Pago

```
MOBILE
┌─────────────────────────────────────────────┐
│ NAVBAR                                      │
├─────────────────────────────────────────────┤
│                                             │
│  ①─────②                                   │
│  Pago  Entrega                              │
│                                             │
│  📋 RESUMEN DE TU PEDIDO                    │
│  ┌─────────────────────────────────────┐   │
│  │ Catit Creamy x4   ×2   $9.600       │   │
│  │ Rubicat 15 KG     ×1   $15.000      │   │
│  │ Old Prince 1 KG   ×1   $6.300       │   │
│  │ ─────────────────────────────────   │   │
│  │ 🚚 Envío                  GRATIS    │   │
│  │ TOTAL                    $30.900    │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  💳 ELEGÍ CÓMO PAGAR                       │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  ⬤  💙 MercadoPago                  │   │
│  │     Tarjeta, débito, MP dinero       │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  ○   💵 Pagar al recibir            │   │
│  │     Efectivo o transferencia         │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  [ Continuar con los datos de entrega → ]   │
│                                             │
└─────────────────────────────────────────────┘
```

---

### 2.7 CHECKOUT — PASO 2: Datos de Entrega

```
MOBILE
┌─────────────────────────────────────────────┐
│ NAVBAR                                      │
├─────────────────────────────────────────────┤
│                                             │
│  ①─────②                                   │
│  Pago  Entrega ← (activo)                  │
│                                             │
│  👤 DATOS DE ENTREGA                        │
│                                             │
│  Nombre completo *                          │
│  ┌─────────────────────────────────────┐   │
│  │ Ej: María González                  │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Dirección de entrega *                     │
│  ┌─────────────────────────────────────┐   │
│  │ Calle, número, piso, depto (CABA)   │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Teléfono de contacto *                     │
│  ┌─────────────────────────────────────┐   │
│  │ 11 XXXX XXXX                        │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Nota adicional (opcional)                  │
│  ┌─────────────────────────────────────┐   │
│  │ Ej: tocar timbre departamento 4B... │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  [  Confirmar pedido — $30.900  ]   │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  🔒 Compra 100% segura                      │
│  🐾 Productos 100% originales               │
│                                             │
└─────────────────────────────────────────────┘
```

---

### 2.8 CONFIRMACIÓN DE PEDIDO

```
MOBILE
┌─────────────────────────────────────────────┐
│ [🐾 MK-pets]                                │
├─────────────────────────────────────────────┤
│                                             │
│            ✅                               │
│      ¡Pedido confirmado!                    │
│                                             │
│  Tu número de pedido:                       │
│  ┌─────────────────────────────────────┐   │
│  │                                     │   │
│  │      MKP-20260514-4821              │   │
│  │                                     │   │
│  │  [ 📋 Copiar número ]               │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ── SI ELEGISTE MERCADOPAGO ──              │
│  Tu pago fue procesado exitosamente.        │
│  Te llegará la confirmación pronto.         │
│                                             │
│  ── SI ELEGISTE EFECTIVO ──                 │
│  Pagás al recibir tu pedido.                │
│  Aceptamos efectivo y transferencia.        │
│                                             │
│  📋 TU PEDIDO                               │
│  Catit Creamy x4   ×2   $9.600             │
│  Rubicat 15 KG     ×1   $15.000            │
│  Old Prince 1 KG   ×1   $6.300             │
│  ─────────────────────────────────          │
│  TOTAL                     $30.900         │
│                                             │
│  📍 Entrega a:                              │
│  María González                             │
│  Av. Corrientes 1234, Piso 3 (CABA)        │
│  📞 11 9999 8888                            │
│                                             │
│  [ Ver estado de mi pedido ]                │
│  [ Seguir comprando 🐾 ]                   │
│                                             │
└─────────────────────────────────────────────┘
```

---

### 2.9 ESTADO DEL PEDIDO

```
MOBILE
┌─────────────────────────────────────────────┐
│ [🐾 MK-pets]                                │
├─────────────────────────────────────────────┤
│                                             │
│  Pedido #MKP-20260514-4821                  │
│                                             │
│  ESTADO:                                    │
│  ┌─────────────────────────────────────┐   │
│  │ ●─────○─────○─────○                 │   │
│  │ Conf. Prep. Enviado Entregado       │   │
│  │                                     │   │
│  │ ✅ PEDIDO CONFIRMADO                 │   │
│  │ Hoy 14/05 · 16:32                   │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  [  ✏️ Modificar pedido  ]  ← (si < 30min) │
│   Podés modificar hasta las 17:02          │
│                                             │
│  📋 ÍTEMS                                   │
│  Catit Creamy x4   ×2   $9.600             │
│  Rubicat 15 KG     ×1   $15.000            │
│  Old Prince 1 KG   ×1   $6.300             │
│  ─────────────────────────────────          │
│  TOTAL                     $30.900         │
│                                             │
│  📍 ENTREGA                                 │
│  María González                             │
│  Av. Corrientes 1234, Piso 3 (CABA)        │
│  📞 11 9999 8888                            │
│                                             │
│  💳 Método: MercadoPago ✅ Aprobado         │
│                                             │
│  ────────────────────────────────────────   │
│  ¿Necesitás ayuda?                          │
│  [ 💬 Escribinos por WhatsApp ]             │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 3. DESIGN SYSTEM — TAILWIND CONFIG

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        mk: {
          // Primarios
          orange:      '#E8760A',
          'orange-dark':'#C45F00',
          'orange-light':'#FFF0E0',
          // Secundarios
          green:       '#2D6A2D',
          'green-light':'#4CAF50',
          'green-pale': '#F0FAF0',
          // Neutrales
          dark:        '#1A1A2E',
          mid:         '#5C5C6B',
          light:       '#F5EFE6',
          white:       '#FAFAF8',
          // Acento
          navy:        '#16213E',
          // Semánticos
          error:       '#E53E3E',
          success:     '#38A169',
          warning:     '#D69E2E',
        }
      },
      fontFamily: {
        display: ['Nunito', 'sans-serif'],
        body:    ['Inter', 'sans-serif'],
      },
      fontWeight: {
        'display-black': '900',
        'display-extra': '800',
        'display-bold':  '700',
      },
      borderRadius: {
        'pill':   '50px',
        'card':   '16px',
        'chip':   '12px',
        'button': '12px',
      },
      boxShadow: {
        'card':    '0 4px 20px rgba(0,0,0,0.08)',
        'card-hover': '0 8px 32px rgba(0,0,0,0.14)',
        'drawer':  '−8px 0 40px rgba(0,0,0,0.15)',
        'navbar':  '0 2px 12px rgba(0,0,0,0.08)',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '68': '17rem',   // Cart drawer width mobile
        '96': '24rem',   // Cart drawer width desktop
      },
      screens: {
        'xs': '375px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
      animation: {
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'fade-in':        'fadeIn 0.2s ease-out',
        'bounce-badge':   'bounceBadge 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97)',
      },
      keyframes: {
        slideInRight: {
          '0%':   { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        bounceBadge: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%':      { transform: 'scale(1.4)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
```

---

## 4. CSS VARIABLES (globals.css)

```css
/* src/app/globals.css */
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Inter:wght@400;500;600&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --mk-orange:       #E8760A;
    --mk-orange-dark:  #C45F00;
    --mk-green:        #2D6A2D;
    --mk-navy:         #16213E;
    --mk-dark:         #1A1A2E;
    --mk-mid:          #5C5C6B;
    --mk-light:        #F5EFE6;
    --mk-white:        #FAFAF8;
  }

  html { @apply scroll-smooth; }

  body {
    @apply bg-mk-white text-mk-dark font-body antialiased;
  }

  h1, h2, h3, h4 {
    @apply font-display font-bold;
  }
}

@layer components {

  /* ── BOTONES ─────────────────────────────────────────── */
  .btn-primary {
    @apply bg-mk-orange text-white font-display font-bold
           px-6 py-3 rounded-pill
           transition-all duration-200
           hover:bg-mk-orange-dark hover:shadow-md
           active:scale-95
           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mk-orange focus-visible:ring-offset-2
           disabled:opacity-50 disabled:cursor-not-allowed;
  }

  .btn-secondary {
    @apply bg-transparent text-mk-orange font-display font-bold
           px-6 py-3 rounded-pill
           border-2 border-mk-orange
           transition-all duration-200
           hover:bg-mk-orange-light
           active:scale-95;
  }

  .btn-ghost {
    @apply bg-transparent text-mk-mid font-body font-medium
           px-4 py-2 rounded-button
           transition-colors duration-200
           hover:text-mk-dark hover:bg-mk-light;
  }

  /* ── CARDS ───────────────────────────────────────────── */
  .product-card {
    @apply bg-white rounded-card shadow-card
           transition-all duration-200
           hover:shadow-card-hover hover:-translate-y-1
           cursor-pointer overflow-hidden;
  }

  /* ── BADGES ──────────────────────────────────────────── */
  .badge-new {
    @apply bg-mk-orange text-white text-xs font-display font-bold
           px-2 py-0.5 rounded-chip uppercase tracking-wide;
  }

  .badge-sale {
    @apply bg-mk-green text-white text-xs font-display font-bold
           px-2 py-0.5 rounded-chip uppercase tracking-wide;
  }

  .badge-hot {
    @apply bg-mk-navy text-white text-xs font-display font-bold
           px-2 py-0.5 rounded-chip uppercase tracking-wide;
  }

  /* ── CHIPS DE CATEGORÍA ──────────────────────────────── */
  .category-chip {
    @apply flex flex-col items-center gap-1
           px-4 py-2 rounded-chip
           bg-mk-light text-mk-mid
           font-body font-medium text-sm
           transition-colors duration-200 cursor-pointer
           hover:bg-mk-orange-light hover:text-mk-orange
           whitespace-nowrap;
  }

  .category-chip.active {
    @apply bg-mk-orange text-white;
  }

  /* ── INPUTS ──────────────────────────────────────────── */
  .input-field {
    @apply w-full px-4 py-3 rounded-button
           border-2 border-gray-200 bg-white
           font-body text-mk-dark
           transition-colors duration-200
           focus:outline-none focus:border-mk-orange
           placeholder:text-mk-mid;
  }

  /* ── PRICE ───────────────────────────────────────────── */
  .price-display {
    @apply font-display font-black text-mk-dark;
  }

  .price-large {
    @apply font-display font-black text-3xl text-mk-orange;
  }

  /* ── SHIPPING BANNER ─────────────────────────────────── */
  .shipping-banner {
    @apply bg-mk-navy text-white
           flex items-center justify-center gap-6
           py-3 px-4 text-sm font-body font-medium;
  }

  /* ── SECTION HEADERS ─────────────────────────────────── */
  .section-title {
    @apply font-display font-bold text-xl md:text-2xl text-mk-dark
           flex items-center gap-2 mb-4;
  }

  /* ── ORDER NUMBER ────────────────────────────────────── */
  .order-number-display {
    @apply font-display font-black text-2xl md:text-3xl
           text-mk-orange tracking-widest text-center
           bg-mk-orange-light rounded-card px-6 py-4;
  }

  /* ── CHECKOUT STEP INDICATOR ─────────────────────────── */
  .step-indicator {
    @apply flex items-center gap-2 font-body text-sm;
  }

  .step-dot {
    @apply w-8 h-8 rounded-full flex items-center justify-center
           font-display font-bold text-sm;
  }

  .step-dot.active {
    @apply bg-mk-orange text-white;
  }

  .step-dot.done {
    @apply bg-mk-green text-white;
  }

  .step-dot.pending {
    @apply bg-gray-200 text-mk-mid;
  }

  /* ── CART BADGE ──────────────────────────────────────── */
  .cart-badge {
    @apply absolute -top-1.5 -right-1.5
           w-5 h-5 rounded-full
           bg-mk-orange text-white
           flex items-center justify-center
           text-xs font-display font-bold
           animate-bounce-badge;
  }
}

@layer utilities {
  .text-price {
    /* Formatea precios ARS: sin decimales, con punto como separador de miles */
    font-variant-numeric: tabular-nums;
  }

  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
}
```

---

## 5. COMPONENTES — JERARQUÍA Y ESPECIFICACIONES

### 5.1 Jerarquía de Componentes

```
src/components/
│
├── layout/
│   ├── Navbar.tsx              ← Logo + Search + CartIcon + WhatsApp
│   ├── NavbarSearch.tsx        ← Buscador con debounce
│   ├── CategorySubnav.tsx      ← Links de categorías (solo desktop)
│   ├── CartDrawer.tsx          ← Panel lateral del carrito
│   ├── Footer.tsx              ← Info, contacto, redes
│   └── ShippingBanner.tsx      ← Barra "Envío gratis a CABA"
│
├── ui/
│   ├── Button.tsx              ← variant: primary | secondary | ghost
│   ├── Badge.tsx               ← variant: new | sale | hot
│   ├── Input.tsx               ← label + error + helper text
│   ├── Spinner.tsx
│   ├── Toast.tsx               ← "Producto agregado al carrito"
│   └── Modal.tsx               ← base para confirmaciones
│
├── catalog/
│   ├── ProductCard.tsx         ← Card de producto para grilla
│   ├── ProductGrid.tsx         ← Grid responsive de ProductCards
│   ├── ProductDetail.tsx       ← Vista completa del producto
│   ├── ProductGallery.tsx      ← Galería de imágenes con dots
│   ├── VariantSelector.tsx     ← Chips de variante (1kg, 2kg...)
│   ├── CategoryChips.tsx       ← Chips de categoría filtrables
│   └── SearchBar.tsx           ← Input de búsqueda
│
├── cart/
│   ├── CartItem.tsx            ← Ítem en el drawer (+/- + eliminar)
│   ├── CartSummary.tsx         ← Subtotal, envío, total
│   └── CartEmpty.tsx           ← Estado vacío del carrito
│
└── checkout/
    ├── PaymentSelector.tsx     ← Opciones MP | Efectivo
    ├── DeliveryForm.tsx        ← Formulario de entrega + validaciones
    ├── OrderSummaryPanel.tsx   ← Resumen de ítems en checkout
    ├── StepIndicator.tsx       ← Indicador de pasos 1/2
    ├── OrderConfirmation.tsx   ← Pantalla de éxito
    └── OrderStatusTimeline.tsx ← Timeline de estados del pedido
```

---

### 5.2 ProductCard — Especificación Completa

```typescript
// Props
interface ProductCardProps {
  id: string
  name: string
  slug: string
  image: string
  basePrice: number       // Precio de la variante seleccionada
  badge?: 'new' | 'sale' | 'hot'
  badgeLabel?: string     // "NUEVO", "OFERTA", "MÁS VENDIDO"
  variants?: { label: string; price: number }[]
  isLoading?: boolean
}

// Layout (mobile-first):
// ┌─────────────────────────────┐
// │ [imagen 1:1, object-cover]  │ ← aspect-square, overflow-hidden
// │ [badge top-left si existe]  │
// ├─────────────────────────────┤
// │ Nombre del producto         │ ← font-display bold, 2 líneas max (line-clamp-2)
// │ Variante: [chip] [chip]     │ ← solo si tiene variantes
// │ $4.800                      │ ← price-large, ARS format
// │ [    + Agregar al carrito ] │ ← btn-primary full width
// └─────────────────────────────┘

// Comportamiento:
// - Click en card (fuera del botón): navega a /producto/[slug]
// - Click en "+ Agregar": addToCart() sin navegar + Toast "Producto agregado"
// - Hover: shadow-card-hover + -translate-y-1
// - Si múltiples variantes: seleccionar chip actualiza precio mostrado
```

---

### 5.3 CartDrawer — Especificación Completa

```typescript
// Trigger: Zustand cartStore, abierto por isDrawerOpen
// Animación: slide-in-right en apertura

// Comportamiento:
// - Se monta en <body> via portal (no en el árbol normal del DOM)
// - Overlay: click fuera cierra el drawer
// - ESC key: cierra el drawer
// - Scroll del body: bloqueado mientras el drawer está abierto
// - Ancho: 100% en mobile, 400px en desktop
// - Posición: fixed right-0 top-0 h-full

// Estados:
// - Con ítems: lista + summary + botones
// - Vacío: ícono + "Tu carrito está vacío" + "Ver productos"
// - Loading: skeleton mientras procesa "agregar"
```

---

### 5.4 DeliveryForm — Validaciones (Zod)

```typescript
// src/lib/validations/checkout.ts
import { z } from 'zod'

export const deliveryFormSchema = z.object({
  customerName: z
    .string()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(100, 'Nombre demasiado largo'),

  address: z
    .string()
    .min(10, 'Ingresá una dirección completa (calle y número)')
    .max(200, 'Dirección demasiado larga'),

  phone: z
    .string()
    .regex(/^(11|15|\+54)\s?\d{4}[\s-]?\d{4}$/, 'Ingresá un teléfono de Buenos Aires válido')
    .transform(val => val.replace(/\s|-/g, '')),

  notes: z
    .string()
    .max(500, 'La nota no puede superar los 500 caracteres')
    .optional(),
})

export type DeliveryFormData = z.infer<typeof deliveryFormSchema>
```

---

## 6. RESPONSIVE STRATEGY

### Grid de Productos

| Breakpoint | Columnas | Gap |
|---|---|---|
| mobile (< 640px) | 2 columnas | 12px |
| tablet (640–1023px) | 3 columnas | 16px |
| desktop (1024–1279px) | 4 columnas | 20px |
| large (≥ 1280px) | 4–5 columnas | 24px |

```css
/* Tailwind classes para el grid */
grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5
gap-3 sm:gap-4 lg:gap-5
```

### Navbar Breakpoints

| Elemento | Mobile | Desktop |
|---|---|---|
| Logo | Solo ícono + "MK-pets" | Logo completo |
| Búsqueda | Ícono → expande en tap | Barra visible siempre |
| Sub-nav categorías | Oculto | Visible |
| WhatsApp | Oculto | Visible |
| Cart | Ícono + badge | Ícono + badge + texto |

### CartDrawer Breakpoints

| | Mobile | Desktop |
|---|---|---|
| Ancho | 100vw | 400px |
| Posición | bottom sheet (opción B) o full right | right panel |

---

## 7. ACCESIBILIDAD (WCAG 2.1 AA)

- **Contraste de texto**: Naranja `#E8760A` sobre blanco → ratio 3.24:1 (OK para large text/UI). Para texto pequeño usar `#C45F00` → ratio 4.58:1 ✅
- **Focus visible**: Todos los elementos interactivos tienen `focus-visible:ring-2 ring-mk-orange`
- **ARIA labels**: CartDrawer con `aria-label="Carrito de compras"`, badge con `aria-label="3 productos en el carrito"`
- **Keyboard nav**: Tab order lógico en formularios, ESC cierra modales/drawers
- **Imágenes**: Todo `<Image>` con `alt` descriptivo del producto
- **Formularios**: `<label>` asociado a cada `<input>` vía `htmlFor`/`id`
- **Loading states**: `aria-busy="true"` durante cargas, skeleton visible

---

## 8. INTERACTION PATTERNS

### Agregar al carrito
```
[Click "+ Agregar"]
    ↓
[Optimistic update: badge +1 animado]
    ↓
[Toast bottom-right: "✓ Catit Creamy agregado" — 2.5s]
    ↓
[CartStore actualizado en Zustand + localStorage]
```

### Navegación con pedido en cache
```
[Usuario llega a home con cookie mkpets_order]
    ↓
[Middleware detecta cookie]
    ↓
[Banner sticky top: "Tenés el pedido #MKP-XXX activo → Ver pedido"]
    ↓
[Dismiss: banner desaparece por sesión]
```

### Formato de precios ARS
```typescript
// Siempre mostrar sin decimales, con punto como separador de miles
const formatPrice = (amount: number): string =>
  `$${amount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`

// $4800 → "$4.800"
// $37000 → "$37.000"
// $63000 → "$63.000"
```

---

## 9. HANDOFF CHECKLIST PARA FRONTEND DEVELOPER

Antes de comenzar la implementación, confirmar:

- [ ] Fuentes Nunito + Inter importadas en `layout.tsx` (o via next/font)
- [ ] `tailwind.config.ts` con los tokens de MK-Pets aplicado
- [ ] `globals.css` con los componentes de layer y variables CSS
- [ ] Prisma schema migrado y DB corriendo
- [ ] Zustand cart store creado con middleware persist
- [ ] Variables de entorno configuradas (`.env.local`)
- [ ] Estructura de carpetas `src/modules/` y `src/components/` creada

**Prioridad de implementación:**
1. Tokens + globals.css
2. Layout (Navbar + Footer + ShippingBanner)
3. ProductCard + ProductGrid
4. CategoryChips + SearchBar
5. Home page
6. Catálogo
7. CartDrawer + CartStore
8. Checkout flow
9. MercadoPago integration
10. Order status page

---

*UX Foundation completo — listo para handoff a @engineering-frontend-developer*
*Próximo agente recomendado: @design-ui-designer para validar composición visual detallada de cada pantalla*
