-- =============================================================================
-- 2026-10-31 · Panel de la tienda (barraca.jurmaq.cl/admin) + endurecimiento
-- =============================================================================
-- NO APLICADA. Aplicar en Supabase Dashboard → SQL Editor, DESPUÉS de:
--   2026_10_26_barraca_pedidos.sql, 2026_10_29_barraca_pedidos_despacho.sql,
--   2026_10_30_barraca_webpay.sql
-- (al 30-10 la tabla barraca_pedidos todavía no existe en producción).
--
-- Idempotente: se puede correr dos veces.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Tarifas del camión por zona (editables en /admin/despacho)
-- -----------------------------------------------------------------------------
-- La app lee esta tabla con caché de 60 s (src/lib/despacho/tarifas-db.ts) y,
-- si no existe, falla o viene vacía, usa las constantes de
-- src/lib/despacho/zonas.ts. Sólo el servidor (service_role) la lee y escribe.

create table if not exists public.barraca_zonas_despacho (
  id            text primary key check (id ~ '^[a-z][a-z-]{1,29}$'),
  nombre        text not null check (length(btrim(nombre)) between 1 and 80),
  -- Código de comuna (src/lib/despacho/comunas.ts), ej. 'ZMO' = Molina.
  comuna        text not null check (comuna ~ '^[A-Z0-9]{2,4}$'),
  costo         integer not null check (costo >= 0 and costo <= 10000000),
  gratis_desde  integer null check (gratis_desde is null or (gratis_desde > 0 and gratis_desde <= 10000000)),
  activo        boolean not null default true,
  orden         integer not null default 0,
  updated_at    timestamptz not null default now(),
  -- id del usuario admin (public.users.id) que hizo el último cambio.
  updated_by    text null
);

comment on table public.barraca_zonas_despacho is
  'Tarifas del despacho en camión propio por zona. Fuente de verdad del cobro (con respaldo en zonas.ts).';

-- Valores al 30-10-2026 (TARIFAS_DESPACHO_30-10.xlsx), los mismos de ZONAS_DESPACHO.
-- ON CONFLICT DO NOTHING: si alguien ya editó una tarifa, no se pisa.
insert into public.barraca_zonas_despacho (id, nombre, comuna, costo, gratis_desde, orden) values
  ('molina',          'Molina',          'ZMO',  5000, 150000,  1),
  ('lontue',          'Lontué',          'ZMO',  8000, 250000,  2),
  ('itahue',          'Itahue',          'ZMO',  8000, 250000,  3),
  ('cumpeo',          'Cumpeo',          'RCL', 10000, 350000,  4),
  ('curico',          'Curicó',          'CCO', 12000, 350000,  5),
  ('sagrada-familia', 'Sagrada Familia', 'SFA', 12000, 350000,  6),
  ('villa-prat',      'Villa Prat',      'SFA', 15000, 450000,  7),
  ('rauco',           'Rauco',           'RAU', 15000, 450000,  8),
  ('san-rafael',      'San Rafael',      'SRF', 15000, 450000,  9),
  ('romeral',         'Romeral',         'RML', 18000, 450000, 10),
  ('teno',            'Teno',            'TEN', 18000, 500000, 11),
  ('pelarco',         'Pelarco',         'PLC', 22000, 600000, 12),
  ('talca',           'Talca',           'ZCA', 25000, 650000, 13)
on conflict (id) do nothing;

alter table public.barraca_zonas_despacho enable row level security;
-- Sin policies: anon/authenticated no ven ni tocan nada. La tienda pública
-- recibe las tarifas por GET /api/tienda/zonas (servidor).
do $$ begin if to_regclass('public.barraca_zonas_despacho') is not null then execute 'revoke all on public.barraca_zonas_despacho from anon, authenticated'; end if; end $$;
grant select, insert, update, delete on public.barraca_zonas_despacho to service_role;

-- -----------------------------------------------------------------------------
-- 2. Defensa en profundidad: el rol anon/authenticated no escribe catálogo
-- -----------------------------------------------------------------------------
-- RLS ya está activo en estas tablas y sólo hay policies de SELECT, así que
-- hoy un UPDATE con la anon key afecta 0 filas. Pero el GRANT de escritura
-- sigue existiendo (PostgREST respondió 204, no 401, a un PATCH anónimo), y
-- basta una policy mal escrita para abrirlo. Se quita el privilegio.
do $$ begin if to_regclass('public.barraca_productos') is not null then execute 'revoke insert, update, delete, truncate on public.barraca_productos from anon, authenticated'; end if; end $$;
do $$ begin if to_regclass('public.barraca_categorias') is not null then execute 'revoke insert, update, delete, truncate on public.barraca_categorias from anon, authenticated'; end if; end $$;
do $$ begin if to_regclass('public.barraca_promociones') is not null then execute 'revoke insert, update, delete, truncate on public.barraca_promociones from anon, authenticated'; end if; end $$;
do $$ begin if to_regclass('public.barraca_reviews') is not null then execute 'revoke insert, update, delete, truncate on public.barraca_reviews from anon, authenticated'; end if; end $$;
do $$ begin if to_regclass('public.barraca_cupones') is not null then execute 'revoke insert, update, delete, truncate on public.barraca_cupones from anon, authenticated'; end if; end $$;
do $$ begin if to_regclass('public.barraca_cupones_usos') is not null then execute 'revoke insert, update, delete, truncate on public.barraca_cupones_usos from anon, authenticated'; end if; end $$;

-- Tablas con datos personales que no tenían RLS en ningún script del repo
-- (en producción la anon key ya recibe 401; esto lo deja escrito y fijo).
alter table if exists public.barraca_suscriptores enable row level security;
do $$ begin if to_regclass('public.barraca_suscriptores') is not null then execute 'revoke all on public.barraca_suscriptores from anon, authenticated'; end if; end $$;
alter table if exists public.users enable row level security;
do $$ begin if to_regclass('public.users') is not null then execute 'revoke all on public.users from anon, authenticated'; end if; end $$;

-- barraca_pedidos (creada en 2026_10_26): RLS activo y sin policies; se
-- asegura que anon/authenticated no tengan privilegios.
do $$
begin
  if to_regclass('public.barraca_pedidos') is not null then
    execute 'revoke all on public.barraca_pedidos from anon, authenticated';
  end if;
end $$;

commit;

-- -----------------------------------------------------------------------------
-- 3. OPCIONAL (revisar antes): ocultar el COSTO de los productos a la anon key
-- -----------------------------------------------------------------------------
-- Hoy cualquiera con la anon key (es pública, va en el navegador) puede leer
-- `barraca_productos.costo` por PostgREST, o sea el margen de cada producto.
-- La tienda pública no usa `costo`, pero hay al menos una consulta con
-- `select('*', { head: true })` (conteo) vía supabasePublic que fallaría con
-- privilegios por columna. Cambiar esa consulta a select('id', ...) y luego:
--
-- revoke select on public.barraca_productos from anon;
-- grant select (id, codigo, nombre, slug, descripcion, precio, precio_original,
--               en_oferta, solo_cotizar, stock, peso, unidad, categoria_id,
--               imagen, imagenes, producto_padre_id, medida, activo, destacado,
--               created_at, updated_at)
--   on public.barraca_productos to anon;
--
-- (Ajustar la lista a las columnas reales: `\d public.barraca_productos`.)
