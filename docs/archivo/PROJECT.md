# MK-Pets — Marketplace Web · Documento de Proyecto
**Versión**: 1.0 · **Fecha**: 2026-05-14 · **PM**: Senior Project Manager Agent

---

## 1. VISIÓN DEL PRODUCTO

> **"Todo para tu mascota, en un solo lugar."**

MK-Pets es un marketplace e-commerce orientado a dueños de mascotas en CABA y alrededores. El sitio debe permitir comprar alimentos, snacks, productos de higiene, ropa y juguetes para perros y gatos, con entrega a domicilio. La experiencia de compra debe ser fluida, visualmente atractiva y confiable, reflejando la identidad cálida y profesional de la marca.

---

## 2. IDENTIDAD VISUAL — BRIEF PARA EQUIPO UI/UX

> Este apartado es mandatorio. El equipo de diseño debe respetar estos lineamientos en cada pantalla.

### 2.1 Logo

El logo de MK-Pets combina dos elementos fusionados:
- **Forma base**: corazón de color naranja (amor, calidez, cuidado)
- **Huella de pata**: integrada dentro del corazón (identidad pet-friendly)
- **Badge central**: óvalo verde oscuro con texto "MK-pets" y silueta de cara de gato

**Regla de uso**:
- Sobre fondos claros: logo completo full color
- Sobre fondos oscuros o fotos: versión blanca o con fondo naranja
- Nunca distorsionar proporciones
- Espacio mínimo de respiro: equivalente al ancho de la "M" en todos los lados

### 2.2 Paleta de Colores

| Rol | Color | Hex | Uso |
|---|---|---|---|
| Primary | Naranja MK | `#E8760A` | CTAs, botones principales, acentos |
| Primary Dark | Naranja oscuro | `#C45F00` | Hover states |
| Secondary | Verde MK | `#2D6A2D` | Badge logo, etiquetas "nuevo", highlights |
| Secondary Light | Verde claro | `#4CAF50` | Iconos de beneficios, checkmarks |
| Neutral Dark | Carbón | `#1A1A2E` | Textos principales, navbars oscuras |
| Neutral Mid | Gris cálido | `#5C5C6B` | Textos secundarios, subtítulos |
| Neutral Light | Arena | `#F5EFE6` | Fondos de secciones alternadas |
| Background | Blanco roto | `#FAFAF8` | Fondo general |
| Accent | Azul marino | `#16213E` | Footer, banners informativos |
| Error | Rojo | `#E53E3E` | Validaciones, stock agotado |
| Success | Verde | `#38A169` | Confirmaciones, pagos exitosos |

### 2.3 Tipografía

| Rol | Fuente | Peso | Uso |
|---|---|---|---|
| Display | Nunito | 800 ExtraBold | Títulos de hero, precios grandes |
| Heading | Nunito | 700 Bold | H1–H3, nombres de producto |
| Body | Inter | 400 Regular | Descripciones, textos corridos |
| UI | Inter | 500 Medium | Botones, labels, navegación |
| Price | Nunito | 900 Black | Precios en tarjetas de producto |

### 2.4 Estilo Visual General

- **Mood**: Cálido, energético, confiable, amigable con mascotas
- **Iconografía**: Rounded, con iconos de patas, corazones, animales — nunca cuadrados ni fríos
- **Fotografía**: Productos sobre fondo blanco limpio para catálogo; fotos de mascotas felices en hero y banners
- **Cards de producto**: Sombra suave (`box-shadow: 0 4px 20px rgba(0,0,0,0.08)`), bordes redondeados `16px`, badge naranja para "Nuevo" o "Oferta"
- **Botones**: Completamente redondeados (`border-radius: 50px`) en CTA principales; `12px` en secundarios
- **Banners promocionales**: Fondo azul marino con texto blanco y naranja (como se ve en los posts actuales)
- **Sección de envío**: Siempre visible con ícono de camión y "Envío gratis a CABA"

### 2.5 Componentes Clave a Diseñar

1. **Navbar**: Logo izq | Búsqueda centro | Carrito (con badge contador) + teléfono WhatsApp der
2. **Hero Banner**: Imagen full-width con tagline + CTA "Ver productos" + badge de envío gratis
3. **Card de Producto**: Imagen | Badge (Nuevo/Oferta) | Nombre | Precio | Variantes de peso | Botón "Agregar"
4. **Carrito lateral (drawer)**: Se abre desde el ícono, sin cambiar de página
5. **Formulario de checkout**: Paso 1: Método de pago | Paso 2: Datos de entrega
6. **Pantalla de confirmación**: Número de pedido grande y visible + instrucciones
7. **Chip de categoría**: Redondeado, con ícono + texto (Gatos, Perros, Snacks, Higiene, etc.)

---

## 3. STACK TECNOLÓGICO

> Metodología **Code First** con principios **SOLID** y **arquitectura escalable por capas**.

| Capa | Tecnología | Justificación |
|---|---|---|
| Framework | **Next.js 14** (App Router) + TypeScript | SSR/SSG para SEO, API Routes integradas, escalable |
| Estilos | **Tailwind CSS** + **shadcn/ui** | Velocidad de desarrollo, consistencia de diseño |
| ORM / DB | **Prisma** + **PostgreSQL** | Code First nativo, migraciones tipadas, relaciones claras |
| Estado global | **Zustand** | Liviano, sin boilerplate, ideal para carrito |
| Pagos | **MercadoPago SDK (Node.js)** | Requisito de negocio |
| Cache/Session | **localStorage** + **cookies** (js-cookie) | Persistencia de número de pedido en dispositivo |
| Hosting App | **Vercel** | Deploy automático, integración nativa con Next.js |
| Hosting DB | **Supabase** (PostgreSQL managed) | Free tier generoso, backups automáticos |
| Storage imágenes | **Supabase Storage** o **Cloudinary** | Upload de imágenes de productos desde admin |
| Testing | **Jest** + **React Testing Library** + **Playwright** (E2E) | Cobertura de unidad + integración + E2E |
| CI/CD | **GitHub Actions** | Pipeline automático en push a main |

### 3.1 Arquitectura de Carpetas (Code First — SOLID)

```
mkpets/
├── prisma/
│   ├── schema.prisma          ← Modelos = fuente de verdad (Code First)
│   ├── migrations/
│   └── seed.ts                ← Datos iniciales de categorías y productos
│
├── src/
│   ├── app/                   ← Next.js App Router
│   │   ├── (shop)/            ← Grupo: tienda pública (sin prefijo en URL)
│   │   │   ├── page.tsx       ← Home
│   │   │   ├── productos/
│   │   │   │   ├── page.tsx   ← Catálogo con filtros
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx ← Detalle de producto
│   │   │   ├── carrito/
│   │   │   │   └── page.tsx
│   │   │   ├── checkout/
│   │   │   │   └── page.tsx
│   │   │   └── pedido/
│   │   │       └── [numero]/
│   │   │           └── page.tsx ← Estado + modificación del pedido
│   │   │
│   │   ├── (admin)/           ← Grupo: panel administrativo
│   │   │   └── admin/
│   │   │       ├── page.tsx   ← Dashboard
│   │   │       ├── productos/ ← CRUD productos
│   │   │       └── pedidos/   ← Gestión de pedidos
│   │   │
│   │   └── api/               ← API Routes (backend)
│   │       ├── productos/
│   │       │   └── route.ts
│   │       ├── pedidos/
│   │       │   ├── route.ts
│   │       │   └── [numero]/
│   │       │       └── route.ts
│   │       └── webhooks/
│   │           └── mercadopago/
│   │               └── route.ts
│   │
│   ├── components/
│   │   ├── ui/                ← Átomos: Button, Input, Badge, Card...
│   │   ├── layout/            ← Navbar, Footer, CartDrawer
│   │   ├── catalog/           ← ProductCard, CategoryChip, ProductGrid, SearchBar
│   │   ├── cart/              ← CartItem, CartSummary, CartDrawer
│   │   └── checkout/          ← PaymentSelector, DeliveryForm, OrderConfirmation
│   │
│   ├── lib/
│   │   ├── prisma.ts          ← Singleton del cliente Prisma
│   │   ├── mercadopago.ts     ← Configuración del SDK de MP
│   │   ├── order-number.ts    ← Generador de números de pedido
│   │   └── validations/       ← Zod schemas para forms y API
│   │
│   ├── hooks/
│   │   ├── use-cart.ts        ← Hook del carrito (consume Zustand store)
│   │   ├── use-order.ts       ← Hook para recuperar pedido desde cache
│   │   └── use-products.ts
│   │
│   ├── store/
│   │   └── cart-store.ts      ← Zustand: estado del carrito + persistencia localStorage
│   │
│   └── types/
│       ├── product.ts
│       ├── order.ts
│       └── mercadopago.ts
│
├── public/
│   ├── logo.svg
│   └── og-image.png
│
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/                   ← Playwright
```

### 3.2 Modelo de Datos — Prisma Schema (Code First)

```prisma
model Category {
  id        String    @id @default(cuid())
  name      String
  slug      String    @unique
  icon      String?
  order     Int       @default(0)
  products  Product[]
  createdAt DateTime  @default(now())
}

model Product {
  id          String        @id @default(cuid())
  name        String
  slug        String        @unique
  description String?
  images      String[]
  basePrice   Decimal       @db.Decimal(10, 2)
  stock       Int           @default(0)
  isActive    Boolean       @default(true)
  isFeatured  Boolean       @default(false)
  badge       String?       // "Nuevo", "Oferta", "Más vendido"
  category    Category      @relation(fields: [categoryId], references: [id])
  categoryId  String
  variants    ProductVariant[]
  orderItems  OrderItem[]
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
}

model ProductVariant {
  id        String   @id @default(cuid())
  label     String   // "1 KG", "2 KG", "15 KG", "Pack x4"
  price     Decimal  @db.Decimal(10, 2)
  stock     Int      @default(0)
  product   Product  @relation(fields: [productId], references: [id])
  productId String
}

model Order {
  id            String      @id @default(cuid())
  orderNumber   String      @unique
  status        OrderStatus @default(PENDING)
  paymentMethod PaymentMethod
  paymentStatus PaymentStatus @default(PENDING)
  mpPaymentId   String?
  customerName  String
  address       String
  phone         String
  notes         String?
  items         OrderItem[]
  total         Decimal     @db.Decimal(10, 2)
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  expiresAt     DateTime?   // Límite para modificar el pedido
}

model OrderItem {
  id          String  @id @default(cuid())
  order       Order   @relation(fields: [orderId], references: [id])
  orderId     String
  product     Product @relation(fields: [productId], references: [id])
  productId   String
  variantLabel String?
  quantity    Int
  unitPrice   Decimal @db.Decimal(10, 2)
}

enum OrderStatus {
  PENDING
  CONFIRMED
  PREPARING
  SHIPPED
  DELIVERED
  CANCELLED
  MODIFIED
}

enum PaymentMethod {
  MERCADOPAGO
  CASH_ON_DELIVERY
}

enum PaymentStatus {
  PENDING
  APPROVED
  REJECTED
  REFUNDED
}
```

---

## 4. PRODUCT BACKLOG

> Prioridad: **ALTA** = Must Have · **MEDIA** = Should Have · **BAJA** = Nice to Have
> Story Points: escala Fibonacci (1, 2, 3, 5, 8, 13)

---

### ÉPICA E01 — Infraestructura y Setup

| ID | User Story | Criterio de Aceptación | SP | Prioridad |
|---|---|---|---|---|
| US-001 | Como dev quiero el proyecto Next.js inicializado con TypeScript, Tailwind y ESLint | Proyecto corre en localhost:3000 sin errores | 2 | ALTA |
| US-002 | Como dev quiero Prisma configurado con PostgreSQL y schema inicial | `prisma migrate dev` crea tablas sin error | 3 | ALTA |
| US-003 | Como dev quiero variables de entorno documentadas en `.env.example` | Todos los secrets tienen placeholder documentado | 1 | ALTA |
| US-004 | Como dev quiero un pipeline de CI en GitHub Actions que corra tests en cada PR | Pipeline verde en PR de prueba | 3 | ALTA |
| US-005 | Como dev quiero un seed con categorías y 10 productos de prueba | `prisma db seed` puebla la DB sin error | 2 | ALTA |

---

### ÉPICA E02 — Identidad Visual y Design System

| ID | User Story | Criterio de Aceptación | SP | Prioridad |
|---|---|---|---|---|
| US-006 | Como UI/UX quiero los tokens de color, tipografía y espaciado definidos en Tailwind config | Variables disponibles como `text-mk-primary`, `bg-mk-secondary` | 2 | ALTA |
| US-007 | Como dev quiero componentes base: Button, Badge, Card, Input, Spinner | Storybook o página /dev muestra todos los estados | 3 | ALTA |
| US-008 | Como usuario quiero ver el logo de MK-Pets en el navbar con enlace a home | Logo visible en mobile y desktop, hace redirect a "/" | 1 | ALTA |
| US-009 | Como usuario quiero un Footer con info de contacto, WhatsApp y redes | Footer incluye teléfono, "Envío gratis a CABA", links | 2 | MEDIA |

---

### ÉPICA E03 — Catálogo de Productos

| ID | User Story | Criterio de Aceptación | SP | Prioridad |
|---|---|---|---|---|
| US-010 | Como cliente quiero ver una página de inicio con productos destacados y categorías | Hero + sección "Más vendidos" + sección por categoría visible | 5 | ALTA |
| US-011 | Como cliente quiero ver todos los productos en una grilla con filtro por categoría | Chips de categoría filtrables, grilla de cards responsive | 5 | ALTA |
| US-012 | Como cliente quiero buscar productos por nombre | Search bar con debounce 300ms, resultados en tiempo real | 3 | ALTA |
| US-013 | Como cliente quiero ver el detalle de un producto (fotos, descripción, precio, variantes) | Página con galería, selector de variante de peso/tamaño, precio actualizado | 5 | ALTA |
| US-014 | Como cliente quiero ver un badge "Nuevo", "Oferta" o "Más vendido" en las cards | Badge configurable desde admin, visible en card y detalle | 2 | MEDIA |
| US-015 | Como cliente quiero ver productos relacionados en la página de detalle | Sección "También te puede gustar" con 4 productos de la misma categoría | 3 | BAJA |

**Categorías iniciales a implementar:**
- 🐱 Gatos — Alimento seco
- 🐶 Perros — Alimento seco
- 🍬 Snacks (gatos y perros)
- 💧 Sobres húmedos
- 🪨 Arenas para gatos
- 🧴 Higiene
- 👕 Ropa para mascotas
- 🎾 Juguetes

---

### ÉPICA E04 — Carrito de Compras

| ID | User Story | Criterio de Aceptación | SP | Prioridad |
|---|---|---|---|---|
| US-016 | Como cliente quiero agregar un producto al carrito desde la card o el detalle | Botón "Agregar al carrito", carrito se actualiza sin recargar | 3 | ALTA |
| US-017 | Como cliente quiero ver el carrito en un panel lateral (drawer) | Drawer se abre al hacer click en ícono, sin cambiar de página | 3 | ALTA |
| US-018 | Como cliente quiero modificar la cantidad de cada ítem en el carrito | Botones +/- con actualización inmediata del subtotal | 2 | ALTA |
| US-019 | Como cliente quiero eliminar un ítem del carrito | Botón eliminar por ítem, confirmación implícita (inmediato) | 1 | ALTA |
| US-020 | Como cliente quiero que el carrito persista si cierro el navegador | Estado del carrito en localStorage, se recupera al volver | 2 | ALTA |
| US-021 | Como cliente quiero ver el subtotal y total en el carrito | Total actualizado en tiempo real con cada cambio | 1 | ALTA |
| US-022 | Como cliente quiero ver un badge con la cantidad de ítems en el ícono del carrito | Badge naranja con número, se actualiza en tiempo real | 1 | ALTA |

---

### ÉPICA E05 — Checkout y Método de Pago

| ID | User Story | Criterio de Aceptación | SP | Prioridad |
|---|---|---|---|---|
| US-023 | Como cliente quiero elegir entre MercadoPago o Pagar al recibir | Paso 1 del checkout muestra ambas opciones claramente | 3 | ALTA |
| US-024 | Como cliente quiero ver el resumen de mi pedido antes de confirmar | Lista de productos, variantes, cantidades y total visible en checkout | 2 | ALTA |
| US-025 | Como cliente quiero completar el formulario con nombre, dirección y teléfono | Validación de campos requeridos, formato de teléfono, dirección no vacía | 3 | ALTA |
| US-026 | Como cliente quiero que mi formulario sea fácil de completar en mobile | Inputs grandes, teclado numérico para teléfono, autofill compatible | 2 | ALTA |
| US-027 | Como cliente quiero agregar una nota adicional al pedido (opcional) | Campo de texto libre, no obligatorio | 1 | BAJA |

---

### ÉPICA E06 — Integración MercadoPago

| ID | User Story | Criterio de Aceptación | SP | Prioridad |
|---|---|---|---|---|
| US-028 | Como cliente quiero ser redirigido a la pantalla de pago de MercadoPago | Al seleccionar MP y confirmar, se crea preferencia y redirige | 5 | ALTA |
| US-029 | Como sistema quiero recibir el webhook de MP y actualizar el estado del pedido | Webhook en `/api/webhooks/mercadopago` actualiza `paymentStatus` en DB | 5 | ALTA |
| US-030 | Como cliente quiero ver una página de éxito con mi número de pedido luego del pago | Redirect de MP a `/pedido/[numero]?status=success` | 3 | ALTA |
| US-031 | Como cliente quiero ver una página de error si el pago falla | Redirect a `/checkout?error=payment_failed` con mensaje claro | 3 | ALTA |
| US-032 | Como sistema quiero que los pedidos pagados con MP no se confirmen hasta recibir webhook | Pedido en estado `PENDING` hasta webhook `approved` | 3 | ALTA |

---

### ÉPICA E07 — Gestión de Pedidos

| ID | User Story | Criterio de Aceptación | SP | Prioridad |
|---|---|---|---|---|
| US-033 | Como sistema quiero generar un número de pedido único y legible | Formato: `MKP-YYYYMMDD-XXXX` (ej: `MKP-20260514-4821`) | 2 | ALTA |
| US-034 | Como cliente quiero ver mi número de pedido al finalizar la compra | Número grande y visible en pantalla de confirmación, con opción de copiar | 2 | ALTA |
| US-035 | Como cliente quiero que mi número de pedido se guarde en mi dispositivo | Guardado en localStorage key `mkpets_last_order`, también en cookie | 2 | ALTA |
| US-036 | Como cliente quiero acceder a mi pedido sin necesidad de ingresar el número nuevamente | Si existe en cache, redirige automáticamente a `/pedido/[numero]` | 3 | ALTA |
| US-037 | Como cliente quiero ver el estado actual de mi pedido | Página `/pedido/[numero]` muestra estado, ítems, y datos de entrega | 3 | ALTA |
| US-038 | Como cliente quiero modificar mi pedido dentro de los 30 minutos posteriores a la compra | Botón "Modificar pedido" visible si `createdAt + 30min > now` y status es PENDING | 8 | MEDIA |
| US-039 | Como cliente quiero recibir confirmación de la modificación | Al guardar cambios, se actualiza el pedido y se muestra confirmación | 5 | MEDIA |

---

### ÉPICA E08 — Panel de Administración

| ID | User Story | Criterio de Aceptación | SP | Prioridad |
|---|---|---|---|---|
| US-040 | Como admin quiero ver el listado de pedidos del día con su estado | Tabla con número, cliente, total, estado, método de pago | 5 | ALTA |
| US-041 | Como admin quiero cambiar el estado de un pedido | Select de estado por fila, cambio inmediato con confirmación | 3 | ALTA |
| US-042 | Como admin quiero ver el detalle de un pedido | Modal/página con todos los datos del cliente, ítems y pago | 3 | ALTA |
| US-043 | Como admin quiero crear, editar y eliminar productos | Formulario con nombre, categoría, precio, variantes, imágenes, badge | 8 | ALTA |
| US-044 | Como admin quiero subir imágenes para los productos | Upload a Supabase Storage, previsualización antes de guardar | 5 | ALTA |
| US-045 | Como admin quiero gestionar las categorías | CRUD de categorías con nombre, slug e ícono | 3 | MEDIA |
| US-046 | Como admin quiero una autenticación básica para el panel | Login con email/password, solo accesible desde ruta `/admin` | 3 | ALTA |

---

## 5. PLAN DE SPRINTS (Metodología Ágil — Sprints de 2 semanas)

```
SPRINT 0 — Fundamentos (Semanas 1-2)
├── US-001  Setup Next.js + TypeScript + Tailwind
├── US-002  Prisma + PostgreSQL + Schema inicial
├── US-003  Variables de entorno
├── US-004  CI/CD con GitHub Actions
├── US-005  Seed de datos
├── US-006  Design tokens en Tailwind config
└── US-046  Auth básica para admin

SPRINT 1 — Identidad y Catálogo (Semanas 3-4)
├── US-007  Componentes base (Button, Badge, Card, Input)
├── US-008  Navbar con logo y WhatsApp
├── US-009  Footer
├── US-010  Home: Hero + Destacados + Categorías
├── US-011  Catálogo con filtro por categoría
└── US-012  Buscador de productos

SPRINT 2 — Detalle y Carrito (Semanas 5-6)
├── US-013  Página de detalle de producto
├── US-014  Badges en cards
├── US-016  Agregar al carrito
├── US-017  CartDrawer (panel lateral)
├── US-018  Modificar cantidades
├── US-019  Eliminar ítem
├── US-020  Persistencia en localStorage
├── US-021  Totales en carrito
└── US-022  Badge contador en ícono

SPRINT 3 — Checkout y Pedidos (Semanas 7-8)
├── US-023  Selección método de pago
├── US-024  Resumen de pedido
├── US-025  Formulario de entrega (validaciones)
├── US-026  UX mobile del formulario
├── US-033  Generador de número de pedido
├── US-034  Pantalla de confirmación
├── US-035  Persistencia número de pedido en cache
└── US-036  Auto-redirect si hay pedido en cache

SPRINT 4 — MercadoPago (Semanas 9-10)
├── US-028  Preferencia de pago + redirect a MP
├── US-029  Webhook de MP
├── US-030  Página de éxito post-pago
├── US-031  Página de error post-pago
└── US-032  Control de estado por webhook

SPRINT 5 — Estado y Modificación de Pedidos (Semanas 11-12)
├── US-037  Página de estado del pedido
├── US-038  Modificación de pedido (ventana de 30min)
└── US-039  Confirmación de modificación

SPRINT 6 — Panel Admin (Semanas 13-14)
├── US-040  Listado de pedidos
├── US-041  Cambio de estado de pedido
├── US-042  Detalle de pedido
├── US-043  CRUD de productos
├── US-044  Upload de imágenes
└── US-045  Gestión de categorías

SPRINT 7 — QA, Polish y Deploy (Semanas 15-16)
├── Tests E2E con Playwright (flujo completo de compra)
├── Optimización de imágenes (next/image)
├── SEO básico (metadata, OG tags)
├── Performance (Lighthouse > 90)
├── Deploy a Vercel + Supabase producción
└── US-015  Productos relacionados (nice to have)
```

---

## 6. REGLAS DE NEGOCIO CRÍTICAS

| # | Regla |
|---|---|
| RN-01 | Un pedido NUNCA se confirma hasta que el pago de MP sea `approved` (vía webhook) o el cliente seleccione "Pagar al recibir" |
| RN-02 | Los pedidos en efectivo pasan directamente a estado `CONFIRMED` al finalizar el checkout |
| RN-03 | El número de pedido se guarda en `localStorage['mkpets_last_order']` y en una cookie con 30 días de expiración |
| RN-04 | Un pedido solo puede modificarse si su estado es `PENDING` o `CONFIRMED` y no han pasado más de 30 minutos desde la creación |
| RN-05 | El carrito se limpia completamente al confirmar el pedido |
| RN-06 | El stock se descuenta al confirmar el pedido, no al agregar al carrito |
| RN-07 | Precios en ARS (pesos argentinos), sin decimales en la UI (mostrar `$6.300` no `$6300.00`) |
| RN-08 | Envío gratis para todos los pedidos a CABA (hardcoded en MVP) |

---

## 7. CRITERIOS DE DEFINICIÓN DE DONE (DoD)

Una User Story se considera **Done** cuando:

- [ ] El código está en una branch de feature y aprobado en Pull Request
- [ ] Tests unitarios escritos para la lógica de negocio crítica
- [ ] Responsive: funciona correctamente en mobile (375px), tablet (768px) y desktop (1280px)
- [ ] No hay errores en consola del navegador
- [ ] El flujo fue probado manualmente en Chrome y Safari mobile
- [ ] Tipado TypeScript estricto (sin `any`)
- [ ] Los componentes siguen los tokens del Design System
- [ ] CI verde (lint + tests + build)

---

## 8. RIESGOS Y MITIGACIONES

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Webhooks de MP no llegan en sandbox | Media | Alto | Usar MP CLI para simular webhooks en dev |
| El cliente cambia precios frecuentemente | Alta | Medio | Panel admin desde Sprint 6, mientras tanto edición directa en seed |
| Falta de imágenes de productos con fondo blanco | Media | Medio | Usar las imágenes existentes de posts; pedir al cliente imágenes recortadas |
| Scope creep (ropita, juguetes sin productos reales) | Alta | Medio | Crear las categorías vacías desde Sprint 1, productos se agregan desde admin |
| Modificación de pedidos = complejidad alta | Media | Medio | Limitar a 30 min y solo ítems (no cambio de dirección ni método de pago) |

---

## 9. FUERA DE SCOPE (MVP)

Los siguientes features quedan explícitamente **fuera del MVP** para evitar scope creep:

- Sistema de cuentas de usuario / login de clientes
- Historial de compras (más allá del último pedido en cache)
- Sistema de reviews y calificaciones
- Cupones y descuentos
- Envíos a otras provincias (fuera de CABA)
- Notificaciones por email o WhatsApp automáticas
- App móvil nativa
- Múltiples vendedores / marketplace multi-tenant

---

## 10. DEFINICIÓN DE DONE DEL PROYECTO

El proyecto está listo para producción cuando:

- [ ] Flujo completo de compra (home → producto → carrito → checkout → pago → confirmación) funciona sin errores
- [ ] MercadoPago sandbox aprobado y rechazado manejados correctamente
- [ ] Pago en efectivo genera pedido confirmado
- [ ] Número de pedido persiste en cache y permite consultar estado
- [ ] Panel admin permite gestionar pedidos y productos
- [ ] Lighthouse Performance Score > 85 en mobile
- [ ] Deploy estable en Vercel + Supabase producción
- [ ] Al menos 1 test E2E cubriendo el flujo completo de compra

---

*Documento generado por Senior Project Manager Agent — MK-Pets Marketplace v1.0*
*Para consultas: gaston.sartini@gmail.com | Tel cliente: 11 6669 8395*
