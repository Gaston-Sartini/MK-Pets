-- ─────────────────────────────────────────────
-- MK-Pets — límites de uso persistentes y conteo de visitas
--
-- 1. RateLimit: los límites de uso (login, pedidos, consulta de pedidos) se
--    contaban en la memoria de cada instancia del sitio, así que eran aproximados.
--    Con la cuenta en la base valen para todas las instancias.
--
-- 2. PageView: cuántas veces se vio cada página por día. Sin cookies ni datos
--    personales: solo fecha, ruta y cantidad. Reemplaza a un servicio externo
--    de estadísticas.
--
-- A las dos tablas solo escribe el servidor (rol postgres, que saltea RLS).
-- El admin puede leer las visitas; nadie más ve ni toca nada.
-- ─────────────────────────────────────────────

-- ── 1. Límites de uso ───────────────────────────────────────────────────────
create table if not exists public."RateLimit" (
  key       text        primary key,
  count     integer     not null,
  "resetAt" timestamptz not null
);

alter table public."RateLimit" enable row level security;
revoke all on public."RateLimit" from anon, authenticated;

-- Cuenta un intento y dice si entra en el límite. Una sola sentencia: dos pedidos
-- simultáneos no pueden pasar los dos por haber leído el contador a la vez.
create or replace function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer;
begin
  insert into public."RateLimit" as r (key, count, "resetAt")
  values (p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (key) do update set
    count     = case when r."resetAt" < now() then 1 else r.count + 1 end,
    "resetAt" = case when r."resetAt" < now() then now() + make_interval(secs => p_window_seconds) else r."resetAt" end
  returning r.count into current_count;

  return current_count <= p_limit;
end
$$;

revoke execute on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;

-- ── 2. Visitas ──────────────────────────────────────────────────────────────
create table if not exists public."PageView" (
  day   date    not null,
  path  text    not null,
  views integer not null default 0,
  primary key (day, path)
);

alter table public."PageView" enable row level security;
revoke all on public."PageView" from anon, authenticated;
grant select on public."PageView" to authenticated;

drop policy if exists "El admin ve las visitas" on public."PageView";
create policy "El admin ve las visitas" on public."PageView"
  for select to authenticated
  using ((select public.is_admin()));

-- ── Limpieza diaria ─────────────────────────────────────────────────────────
-- Contadores vencidos y visitas de hace más de un año.
create or replace function public.cleanup_counters()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public."RateLimit" where "resetAt" < now() - interval '1 day';
  delete from public."PageView"  where day < current_date - 400;
$$;

revoke execute on function public.cleanup_counters() from public, anon, authenticated;

select cron.unschedule('cleanup-counters') where exists (select 1 from cron.job where jobname = 'cleanup-counters');
select cron.schedule('cleanup-counters', '17 6 * * *', $$select public.cleanup_counters()$$);
