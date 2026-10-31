-- Descuento por pagar con transferencia (2% sobre los productos).
-- total = subtotal - descuento_transferencia + costo_despacho.
alter table public.barraca_pedidos
  add column if not exists descuento_transferencia integer not null default 0;

alter table public.barraca_pedidos
  drop constraint if exists barraca_pedidos_descuento_transferencia_chk;

alter table public.barraca_pedidos
  add constraint barraca_pedidos_descuento_transferencia_chk
  check (descuento_transferencia >= 0 and descuento_transferencia <= subtotal);

-- El total ahora descuenta la transferencia (antes: total = subtotal + despacho).
alter table public.barraca_pedidos
  drop constraint if exists barraca_pedidos_total_cuadra;

alter table public.barraca_pedidos
  add constraint barraca_pedidos_total_cuadra
  check (total = subtotal - descuento_transferencia + coalesce(costo_despacho, 0));
