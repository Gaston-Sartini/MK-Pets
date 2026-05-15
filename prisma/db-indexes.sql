-- MK-Pets — Índices adicionales (ejecutar DESPUÉS de la migración inicial)
-- DB Optimizer: índices que requieren sintaxis PostgreSQL nativa
-- Usar CONCURRENTLY para no lockear tablas en producción

-- GIN index para búsqueda full-text en nombre de producto
-- Permite queries: WHERE name ILIKE '%whiskas%' con rendimiento aceptable
-- Para escala mayor, considerar pg_trgm o Supabase Full Text Search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_name_trgm
  ON "Product" USING GIN (name gin_trgm_ops);

-- Index para búsqueda case-insensitive en campos de texto del pedido
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_customer_name
  ON "Order" (lower("customerName"));

-- Index parcial para pedidos activos (los que más se consultan)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_active
  ON "Order" (status, "createdAt" DESC)
  WHERE status IN ('PENDING', 'CONFIRMED', 'PREPARING');

-- CÓMO EJECUTAR:
-- En Supabase: SQL Editor → pegar este archivo → Run
-- En local:    psql $DATABASE_URL -f prisma/db-indexes.sql
-- En Prisma:   NO usar prisma migrate (usa SQL nativo para CONCURRENTLY)
