-- ─────────────────────────────────────────────
-- MK-Pets — ajustes del sitio que se cambian desde el panel
--
-- Clave → valor (JSON). Hoy:
--   hero           textos e imagen de la portada
--   owner_whatsapp número que recibe los avisos de la tienda (pisa OWNER_WHATSAPP)
--
-- Lee y escribe solo el servidor (rol postgres, que saltea RLS), y escribe
-- únicamente desde rutas del panel que exigen sesión de admin.
-- ─────────────────────────────────────────────

create table if not exists public."SiteSetting" (
  key         text        primary key,
  value       jsonb       not null,
  "updatedAt" timestamptz not null default now()
);

alter table public."SiteSetting" enable row level security;
revoke all on public."SiteSetting" from anon, authenticated;
