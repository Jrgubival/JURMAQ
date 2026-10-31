-- Descuento por cantidad ("Lleva 2 por $12.000") en la tienda de la barraca.
-- Lo leen la ficha, el carrito y POST /api/pedidos (lib/combos-servidor.ts).
-- Sin estas columnas la tienda funciona igual, sin combos.

alter table public.barraca_productos
  add column if not exists combo_cantidad integer,
  add column if not exists combo_precio integer;

alter table public.barraca_productos
  drop constraint if exists barraca_productos_combo_chk;

alter table public.barraca_productos
  add constraint barraca_productos_combo_chk check (
    (combo_cantidad is null and combo_precio is null)
    or (combo_cantidad between 2 and 999 and combo_precio > 0)
  );
