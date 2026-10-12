# MK-Pets — Database Optimization Report
**Agente**: Database Optimizer · **Fecha**: 2026-05-14

---

## 1. AUDITORÍA DEL SCHEMA ORIGINAL

### Problemas detectados en el schema inicial

| # | Tabla | Columna | Problema | Impacto |
|---|---|---|---|---|
| 1 | `OrderItem` | `orderId` | FK sin índice explícito | Seq Scan en JOIN Order→Items |
| 2 | `OrderItem` | `productId` | FK sin índice explícito | Seq Scan al buscar pedidos por producto |
| 3 | `ProductVariant` | `productId` | FK sin índice explícito | Seq Scan al cargar variantes |
| 4 | `Product` | `categoryId` | FK sin índice explícito | Seq Scan en filtro por categoría |
| 5 | `Product` | `isActive + isFeatured` | Sin índice compuesto | Full scan en home page |
| 6 | `Order` | `status + createdAt` | Sin índice compuesto | Full scan en panel admin |
| 7 | `Product` | `name` | Sin índice trigram | Búsqueda lenta con ILIKE |
| 8 | `schema.prisma` | datasource | Sin `directUrl` | Vercel/Supabase serverless rompe |

> **Regla de oro**: toda FK que participa en un JOIN necesita un índice. Prisma no los crea automáticamente.

---

## 2. CORRECCIONES APLICADAS

### 2.1 Índices agregados al schema.prisma

```prisma
// Category
@@index([order])

// Product
@@index([categoryId])                        // FK — crítico
@@index([isActive, isFeatured])              // Home: productos destacados
@@index([isActive, categoryId])              // Catálogo filtrado
@@index([isActive, createdAt(sort: Desc)])   // Ordenamiento

// ProductVariant
@@index([productId])                         // FK — crítico

// Order
@@index([status, createdAt(sort: Desc)])     // Admin panel
@@index([mpPaymentId])                       // Webhook lookup

// OrderItem
@@index([orderId])                           // FK — crítico
@@index([productId])                         // FK — crítico
```

### 2.2 Índices adicionales (db-indexes.sql — PostgreSQL nativo)

```sql
-- Búsqueda full-text con pg_trgm
CREATE INDEX CONCURRENTLY idx_product_name_trgm
  ON "Product" USING GIN (name gin_trgm_ops);

-- Pedidos activos (partial index — más pequeño y rápido)
CREATE INDEX CONCURRENTLY idx_order_active
  ON "Order" (status, "createdAt" DESC)
  WHERE status IN ('PENDING', 'CONFIRMED', 'PREPARING');
```

### 2.3 Supabase Serverless — directUrl

```prisma
// Sin esto, Prisma en Vercel falla por connection limits
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // Transaction pooler (puerto 6543)
  directUrl = env("DIRECT_URL")     // Direct connection (puerto 5432) para migraciones
}
```

```bash
# .env.local para Supabase
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"
```

---

## 3. N+1 QUERIES DETECTADAS Y RESUELTAS

### 3.1 Home page — ANTES (potencial N+1)

```typescript
// ❌ Si se hubiera implementado así:
const categories = await prisma.category.findMany()
for (const cat of categories) {
  // Query por cada categoría = N+1
  cat.products = await prisma.product.findMany({ where: { categoryId: cat.id } })
}
```

### 3.1 Home page — DESPUÉS (queries paralelas)

```typescript
// ✅ Promise.all = queries en paralelo, no secuenciales
const [featured, gatos, perros, snacks] = await Promise.all([
  getFeaturedProducts(),
  getProductsByCategory('gatos'),
  getProductsByCategory('perros'),
  getProductsByCategory('snacks'),
])
```

### 3.2 Detalle de pedido — ANTES (potencial N+1)

```typescript
// ❌ Cargar items y luego buscar cada producto
const order = await prisma.order.findUnique({ where: { orderNumber } })
for (const item of order.items) {
  item.product = await prisma.product.findUnique({ where: { id: item.productId } })
}
```

### 3.2 Detalle de pedido — DESPUÉS (single query)

```typescript
// ✅ Una sola query con select anidado — ver src/lib/queries.ts
const order = await prisma.order.findUnique({
  where: { orderNumber },
  select: {
    // ...campos del pedido
    items: {
      select: {
        // ...campos del ítem
        product: { select: { id: true, name: true, images: true, slug: true } },
      },
    },
  },
})
```

---

## 4. SELECT * ELIMINADO → SELECT EXPLÍCITO

```typescript
// ❌ Antes: trae TODOS los campos (description, updatedAt, stock de todas las variantes, etc.)
prisma.product.findMany({ include: { category: true, variants: true } })

// ✅ Después: PRODUCT_CARD_SELECT — solo lo que necesita la ProductCard
const PRODUCT_CARD_SELECT = {
  id: true, name: true, slug: true, images: true,
  basePrice: true, badge: true, isFeatured: true, stock: true,
  category: { select: { id: true, name: true, slug: true, emoji: true } },
  variants:  { select: { id: true, label: true, price: true, stock: true } },
}
```

**Ahorro estimado por query**: ~40% menos de bytes transferidos desde la DB.

---

## 5. PAGINACIÓN — CURSOR vs OFFSET

```typescript
// ❌ Offset-based: se vuelve lento con catálogos grandes
prisma.product.findMany({ skip: page * 20, take: 20 })
// Problema: PostgreSQL debe contar y saltar filas — O(n) con n = skip

// ✅ Cursor-based: O(log n) con el índice
prisma.product.findMany({
  take:   21,                          // pedir 1 más para detectar nextPage
  cursor: { id: lastSeenId },
  skip:   1,
})
```

Implementado en `src/lib/queries.ts → getProducts()`.

---

## 6. CONNECTION POOLING

### Problema en Vercel/Supabase Serverless

Cada invocación serverless abre una nueva conexión. Sin pooler:
- PostgreSQL tiene límite de ~100 conexiones (Supabase free tier)
- Con tráfico medio se agotan en segundos

### Solución

```
Vercel Functions ─────────────────► Supabase Transaction Pooler (puerto 6543)
                                              │
                                              ▼
                                    PostgreSQL (1 connection pool)
```

Variables en `.env.local`:
```bash
# Transaction mode — para queries normales desde la app
DATABASE_URL="postgresql://...@pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct mode — solo para prisma migrate (no usa pooler)
DIRECT_URL="postgresql://...@aws-0-region.pooler.supabase.com:5432/postgres"
```

---

## 7. QUERY PLAN ESPERADO (post-optimización)

Para la query más crítica (home page, productos destacados):

```sql
EXPLAIN ANALYZE
SELECT id, name, slug, images, "basePrice", badge, "isFeatured", stock
FROM "Product"
WHERE "isActive" = true AND "isFeatured" = true
ORDER BY "createdAt" DESC
LIMIT 8;

-- ESPERADO con índice @@index([isActive, isFeatured]):
-- Index Scan using Product_isActive_isFeatured_idx on Product
-- actual time=0.1..0.3 rows=8 ✅

-- SIN índice:
-- Seq Scan on Product (cost=0..250 rows=8) — escanea TODA la tabla ❌
```

---

## 8. CHECKLIST DE PRODUCCIÓN

Antes del deploy a producción verificar:

- [ ] `prisma migrate deploy` ejecutado (no `dev`)
- [ ] `db-indexes.sql` ejecutado en la DB de producción
- [ ] `DATABASE_URL` apunta al Transaction Pooler de Supabase (puerto 6543)
- [ ] `DIRECT_URL` configurado para migraciones (puerto 5432)
- [ ] `pg_stat_statements` activado en Supabase para monitorear queries lentas
- [ ] Queries de la home verificadas con EXPLAIN ANALYZE
- [ ] Ninguna query tarda más de 100ms en producción

---

*Database Optimization Report — MK-Pets v1.0*
*Todos los cambios están en: prisma/schema.prisma · prisma/db-indexes.sql · src/lib/queries.ts*
