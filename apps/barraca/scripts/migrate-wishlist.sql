-- migrate-wishlist.sql
--
-- D3 Tier 4: Wishlist (lista de deseos) para clientes barraca.
--
-- Cliente logueado: persistente cross-device.
-- Guest: localStorage (no usa esta tabla hasta registrarse).
--
-- Use case: cliente guarda fierros que comprará "después" — habilita emails
-- de re-engagement futuros ("productos de tu wishlist con descuento").

BEGIN;

CREATE TABLE IF NOT EXISTS public.barraca_wishlist (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  integer NOT NULL REFERENCES public.barraca_usuarios(id) ON DELETE CASCADE,
  producto_id integer NOT NULL REFERENCES public.barraca_productos(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT barraca_wishlist_unique UNIQUE (usuario_id, producto_id)
);

CREATE INDEX IF NOT EXISTS barraca_wishlist_usuario_idx ON public.barraca_wishlist (usuario_id);
CREATE INDEX IF NOT EXISTS barraca_wishlist_producto_idx ON public.barraca_wishlist (producto_id);

ALTER TABLE public.barraca_wishlist ENABLE ROW LEVEL SECURITY;

COMMIT;
