-- Cupones en los pedidos de la tienda (checkout).
-- NO aplicar hasta que Jorge lo decida: encender el interruptor de cupones
-- (D1 "ajustes", clave cupones_checkout) lo comprueba y se niega si falta.
-- Con el interruptor apagado los pedidos no usan estas columnas.
--
-- total = subtotal - descuento_transferencia - cupon_descuento + costo_despacho.

alter table public.barraca_pedidos
  add column if not exists cupon_id uuid references public.barraca_cupones(id),
  add column if not exists cupon_codigo text,
  add column if not exists cupon_descuento integer not null default 0;

alter table public.barraca_pedidos
  drop constraint if exists barraca_pedidos_cupon_descuento_chk;

alter table public.barraca_pedidos
  add constraint barraca_pedidos_cupon_descuento_chk
  check (cupon_descuento >= 0 and cupon_descuento + descuento_transferencia <= subtotal);

alter table public.barraca_pedidos
  drop constraint if exists barraca_pedidos_total_cuadra;

alter table public.barraca_pedidos
  add constraint barraca_pedidos_total_cuadra
  check (total = subtotal - descuento_transferencia - cupon_descuento + coalesce(costo_despacho, 0));
