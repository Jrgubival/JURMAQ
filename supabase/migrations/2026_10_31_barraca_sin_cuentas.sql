-- Tienda barraca sin cuentas de cliente (oct-2026, decisión de Jorge).
-- SIN APLICAR. Aplicar DESPUÉS de 2026_10_30_barraca_webpay.sql, en el SQL
-- Editor de Supabase. No borra datos: sólo agrega columnas e índices.
--
-- 1) Opiniones con el enlace del correo post-entrega (/opinar/<numero>/<token>):
--    se atan al pedido, no a un usuario. Una sola por (pedido, producto).
-- 2) Marca de "ya se pidió la opinión" en el pedido (una vez por pedido).

begin;

-- 1. barraca_reviews ---------------------------------------------------------
-- usuario_id era NOT NULL (scripts/migrate-reviews.sql). Las opiniones nuevas
-- no tienen usuario. La FK a barraca_usuarios se mantiene para las antiguas.
alter table public.barraca_reviews
  alter column usuario_id drop not null;

alter table public.barraca_reviews
  add column if not exists pedido_numero text references public.barraca_pedidos(numero) on delete set null,
  -- Nombre que se publica: nombre + inicial del apellido ("Juan P.").
  -- usuario_nombre se llena con el mismo valor para no romper lo existente.
  add column if not exists autor_publico text;

-- Una opinión por producto de cada pedido (lo que hace "de un solo uso" al
-- enlace). Las antiguas (pedido_numero null) no cuentan: en un índice único
-- los NULL no chocan entre sí.
create unique index if not exists barraca_reviews_pedido_producto_uq
  on public.barraca_reviews (pedido_numero, producto_id);

-- Toda opinión nueva debe venir de un usuario (antiguas) o de un pedido.
alter table public.barraca_reviews
  drop constraint if exists barraca_reviews_origen_chk,
  add constraint barraca_reviews_origen_chk
    check (usuario_id is not null or pedido_numero is not null) not valid;

-- 2. barraca_pedidos ---------------------------------------------------------
alter table public.barraca_pedidos
  add column if not exists opinion_solicitada_at timestamptz;

-- El cron busca entregados sin correo de opinión, por updated_at.
create index if not exists barraca_pedidos_opinion_pendiente_idx
  on public.barraca_pedidos (updated_at)
  where estado = 'entregado' and opinion_solicitada_at is null;

commit;

-- Verificación:
--   select column_name, is_nullable from information_schema.columns
--    where table_name = 'barraca_reviews' and column_name in ('usuario_id','pedido_numero','autor_publico');
--   select count(*) from barraca_pedidos where estado = 'entregado' and opinion_solicitada_at is null;
--
-- Quedan SIN USO (no se borran; decidir aparte, con respaldo):
--   barraca_usuarios (cuentas de cliente; ojo: barraca_reviews.usuario_id y
--     barraca_cotizaciones.usuario_id la referencian),
--   barraca_wishlist, barraca_reviews_likes (+ trigger trg_barraca_review_like_count
--     y la columna barraca_reviews.utiles_count),
--   user_sessions con scope 'barraca' (sesiones JWT de clientes),
--   account_erasure_log (sólo lo escribía /api/cuenta/eliminar en barraca),
--   barraca_cotizaciones.usuario_id, barraca_carrito_abandonado.usuario_id,
--   barraca_cotizaciones.review_request_sent_at (el cron ya no pide opinión de cotizaciones).
