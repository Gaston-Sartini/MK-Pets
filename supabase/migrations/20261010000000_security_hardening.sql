-- ─────────────────────────────────────────────────────────────────────────────
-- MK-Pets — hardening de seguridad
--
-- Antes de esta migración cualquiera con la anon key (que es pública) podía leer
-- los pedidos con nombre/dirección/teléfono, cambiar precios, borrar productos y
-- subir o borrar archivos del bucket de imágenes.
--
-- Modelo de acceso después:
--   anon / visitante  → solo LEE el catálogo (categorías, productos activos, variantes)
--   admin (JWT con app_metadata.role = 'admin') → lee y escribe todo
--   servidor Next.js (Prisma, rol postgres, dueño de las tablas) → no pasa por RLS;
--                       es quien crea y consulta pedidos
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Rol admin ─────────────────────────────────────────────────────────────

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;

comment on function public.is_admin() is
  'true si el JWT del request tiene app_metadata.role = admin. app_metadata solo se edita con service role / SQL, nunca desde el cliente.';

-- El único usuario existente es el dueño del panel. La condición count(*) = 1
-- evita promover a alguien que se haya registrado mientras el signup estuvo abierto.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where (select count(*) from auth.users) = 1;

-- ── 2. IDs y updatedAt generados por la base ─────────────────────────────────
-- Prisma genera cuid() y @updatedAt del lado cliente. El panel admin escribe por
-- la API REST de Supabase, que no pasa por Prisma: sin estos defaults, crear un
-- producto o categoría fallaba por id NULL y editar un producto borraba sus variantes.

create or replace function public.gen_id()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'c' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 24)
$$;

alter table public."Category"       alter column id set default public.gen_id();
alter table public."Product"        alter column id set default public.gen_id();
alter table public."ProductVariant" alter column id set default public.gen_id();
alter table public."Order"          alter column id set default public.gen_id();
alter table public."OrderItem"      alter column id set default public.gen_id();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new."updatedAt" = (now() at time zone 'utc');
  return new;
end
$$;

drop trigger if exists product_set_updated_at on public."Product";
create trigger product_set_updated_at
  before update on public."Product"
  for each row execute function public.set_updated_at();

drop trigger if exists order_set_updated_at on public."Order";
create trigger order_set_updated_at
  before update on public."Order"
  for each row execute function public.set_updated_at();

-- ── 3. Row Level Security ────────────────────────────────────────────────────

alter table public."Category"       enable row level security;
alter table public."Product"        enable row level security;
alter table public."ProductVariant" enable row level security;
alter table public."Order"          enable row level security;
alter table public."OrderItem"      enable row level security;

-- (select public.is_admin()) → se evalúa una vez por consulta, no una vez por fila.

-- Catálogo: lectura pública
create policy "catalog_read_categories" on public."Category"
  for select to anon, authenticated
  using (true);

create policy "catalog_read_products" on public."Product"
  for select to anon, authenticated
  using ("isActive" or (select public.is_admin()));

create policy "catalog_read_variants" on public."ProductVariant"
  for select to anon, authenticated
  using (true);

-- Catálogo: escritura solo admin
create policy "admin_insert_categories" on public."Category"
  for insert to authenticated with check ((select public.is_admin()));
create policy "admin_update_categories" on public."Category"
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin_delete_categories" on public."Category"
  for delete to authenticated using ((select public.is_admin()));

create policy "admin_insert_products" on public."Product"
  for insert to authenticated with check ((select public.is_admin()));
create policy "admin_update_products" on public."Product"
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin_delete_products" on public."Product"
  for delete to authenticated using ((select public.is_admin()));

create policy "admin_insert_variants" on public."ProductVariant"
  for insert to authenticated with check ((select public.is_admin()));
create policy "admin_update_variants" on public."ProductVariant"
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin_delete_variants" on public."ProductVariant"
  for delete to authenticated using ((select public.is_admin()));

-- Pedidos: datos personales. Sin política para anon = sin acceso público.
create policy "admin_all_orders" on public."Order"
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "admin_all_order_items" on public."OrderItem"
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Defensa en profundidad: aunque RLS ya bloquea, anon no necesita estos permisos.
revoke insert, update, delete, truncate, references, trigger
  on public."Category", public."Product", public."ProductVariant", public."Order", public."OrderItem"
  from anon;
revoke select on public."Order", public."OrderItem" from anon;
revoke truncate, references, trigger
  on public."Category", public."Product", public."ProductVariant", public."Order", public."OrderItem"
  from authenticated;

-- ── 4. Storage: bucket de imágenes de productos ──────────────────────────────

drop policy if exists "Anyone can upload to products bucket"  on storage.objects;
drop policy if exists "Anyone can update products bucket"      on storage.objects;
drop policy if exists "Anyone can delete from products bucket" on storage.objects;

create policy "Admins upload product images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'products' and (select public.is_admin()));

create policy "Admins update product images" on storage.objects
  for update to authenticated
  using (bucket_id = 'products' and (select public.is_admin()))
  with check (bucket_id = 'products' and (select public.is_admin()));

create policy "Admins delete product images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'products' and (select public.is_admin()));

update storage.buckets
set file_size_limit    = 5242880,  -- 5 MB, igual que el límite de /api/admin/upload
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
where id = 'products';

-- ── 5. Funciones del chat ────────────────────────────────────────────────────

-- La versión de 1 argumento quedó de una iteración anterior. Con las dos, una
-- llamada REST con solo {limit_n} es ambigua y PostgREST la rechaza.
drop function if exists public.top_promos(integer);

alter function public.top_promos(integer, text)                set search_path = public;
alter function public.products_by_category(text, integer)      set search_path = public;
alter function public.categories_with_sample()                 set search_path = public;
alter function public.search_product_with_alternatives(text)   set search_path = public;
