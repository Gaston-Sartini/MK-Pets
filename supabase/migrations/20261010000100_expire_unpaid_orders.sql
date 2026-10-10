-- ─────────────────────────────────────────────────────────────────────────────
-- MK-Pets — liberar stock de pedidos MercadoPago que nunca se pagaron
--
-- El stock se descuenta al crear el pedido (para no vender dos veces la misma
-- unidad mientras el cliente paga). Si el cliente abandona el checkout de MP,
-- ese stock quedaba reservado para siempre.
--
-- Cada 15 minutos se cancelan los pedidos MP sin pago aprobado con más de 2 h
-- y se devuelve su stock. La preferencia de MP vence a los 90 minutos
-- (MP_PAYMENT_WINDOW_MINUTES en src/lib/mercadopago.ts), así que nadie puede
-- pagar un pedido que ya fue cancelado acá.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.expire_unpaid_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired record;
  n       integer := 0;
begin
  for expired in
    update public."Order"
    set status = 'CANCELLED'
    where "paymentMethod" = 'MERCADOPAGO'
      and "paymentStatus" in ('PENDING', 'REJECTED')
      and status = 'PENDING'
      and "createdAt" < (now() at time zone 'utc') - interval '2 hours'
    returning id
  loop
    -- Productos sin variante
    update public."Product" p
    set stock = p.stock + i.qty
    from (
      select "productId", sum(quantity)::int as qty
      from public."OrderItem"
      where "orderId" = expired.id and "variantLabel" is null
      group by "productId"
    ) i
    where p.id = i."productId";

    -- Variantes
    update public."ProductVariant" v
    set stock = v.stock + i.qty
    from (
      select "productId", "variantLabel", sum(quantity)::int as qty
      from public."OrderItem"
      where "orderId" = expired.id and "variantLabel" is not null
      group by "productId", "variantLabel"
    ) i
    where v."productId" = i."productId" and v.label = i."variantLabel";

    n := n + 1;
  end loop;

  return n;
end
$$;

comment on function public.expire_unpaid_orders() is
  'Cancela pedidos MercadoPago impagos de más de 2 h y devuelve su stock. La corre pg_cron cada 15 min.';

-- Solo la ejecuta el cron (rol postgres): nadie más debe poder cancelar pedidos.
revoke execute on function public.expire_unpaid_orders() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'expire-unpaid-orders',
  '*/15 * * * *',
  $$select public.expire_unpaid_orders()$$
);
