-- Despacho con costo en la tienda barraca: cómo viaja el pedido (camión propio
-- o courier), la comuna por código y el seguimiento del courier.
-- Aplicar DESPUÉS de 2026_10_26_barraca_pedidos.sql (SQL Editor de Supabase).

alter table public.barraca_pedidos
  add column if not exists despacho_tipo       text check (despacho_tipo in ('propio', 'courier')),
  add column if not exists comuna_codigo       text,
  add column if not exists courier             text,            -- 'bluex' | ...
  add column if not exists courier_seguimiento text;

-- El total siempre es productos + despacho (despacho null = a coordinar, no suma).
alter table public.barraca_pedidos
  drop constraint if exists barraca_pedidos_total_cuadra,
  add constraint barraca_pedidos_total_cuadra
    check (total = subtotal + coalesce(costo_despacho, 0));
