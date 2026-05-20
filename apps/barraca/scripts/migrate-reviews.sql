-- migrate-reviews.sql
--
-- Tier 4 D2: Reviews/ratings de productos barraca.
--
-- Modelo:
--   - Cliente logueado escribe review (1-5 estrellas + texto opcional)
--   - Solo clientes que tienen cotización 'pagada' con ese producto pueden
--     reseñar (verificación server-side al crear)
--   - 1 review por (usuario, producto) — unique constraint
--   - Estados moderación: pendiente | aprobada | rechazada
--   - Solo aprobadas son públicas (resto solo el admin las ve)
--   - Vista materializada barraca_productos_rating cachea avg+count
--
-- Aplicar: Supabase Dashboard → SQL Editor (proyecto barraca).

BEGIN;

-- ============================================================================
-- 1. Tabla barraca_reviews
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.barraca_reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    integer NOT NULL REFERENCES public.barraca_usuarios(id) ON DELETE CASCADE,
  producto_id   integer NOT NULL REFERENCES public.barraca_productos(id) ON DELETE CASCADE,
  rating        smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  titulo        text,
  comentario    text,
  estado        text NOT NULL DEFAULT 'pendiente'
                CHECK (estado IN ('pendiente','aprobada','rechazada')),
  -- Snapshot del comprador en el momento (cambio de nombre no afecta review).
  usuario_nombre text NOT NULL,
  -- Bandera: cliente con compra confirmada (verificación server-side al crear).
  compra_verificada boolean NOT NULL DEFAULT false,
  -- Likes/útil del review (otros usuarios pueden marcar "me sirvió").
  utiles_count  integer NOT NULL DEFAULT 0,
  -- Moderación
  moderado_at   timestamptz,
  moderado_by   uuid,
  notas_moderacion text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT barraca_reviews_unique UNIQUE (usuario_id, producto_id)
);

CREATE INDEX IF NOT EXISTS barraca_reviews_producto_idx
  ON public.barraca_reviews (producto_id, estado)
  WHERE estado = 'aprobada';
CREATE INDEX IF NOT EXISTS barraca_reviews_usuario_idx
  ON public.barraca_reviews (usuario_id);
CREATE INDEX IF NOT EXISTS barraca_reviews_pendientes_idx
  ON public.barraca_reviews (created_at DESC)
  WHERE estado = 'pendiente';

-- ============================================================================
-- 2. Tabla barraca_reviews_likes (un cliente marca "me sirvió" max 1 vez)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.barraca_reviews_likes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   uuid NOT NULL REFERENCES public.barraca_reviews(id) ON DELETE CASCADE,
  usuario_id  integer NOT NULL REFERENCES public.barraca_usuarios(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT barraca_reviews_likes_unique UNIQUE (review_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS barraca_reviews_likes_review_idx
  ON public.barraca_reviews_likes (review_id);

-- ============================================================================
-- 3. Trigger: mantener utiles_count sincronizado
-- ============================================================================
CREATE OR REPLACE FUNCTION public.barraca_review_like_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.barraca_reviews
       SET utiles_count = utiles_count + 1
     WHERE id = NEW.review_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.barraca_reviews
       SET utiles_count = GREATEST(0, utiles_count - 1)
     WHERE id = OLD.review_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_barraca_review_like_count ON public.barraca_reviews_likes;
CREATE TRIGGER trg_barraca_review_like_count
  AFTER INSERT OR DELETE ON public.barraca_reviews_likes
  FOR EACH ROW EXECUTE FUNCTION public.barraca_review_like_count();

-- ============================================================================
-- 4. Vista barraca_productos_rating (agregado público de avg+count)
-- ============================================================================
-- security_invoker garantiza que la vista hereda permisos del rol que consulta.
DROP VIEW IF EXISTS public.barraca_productos_rating;
CREATE VIEW public.barraca_productos_rating
  WITH (security_invoker = true) AS
SELECT
  producto_id,
  COUNT(*)::integer       AS total_reviews,
  ROUND(AVG(rating)::numeric, 2) AS rating_promedio,
  COUNT(*) FILTER (WHERE rating = 5)::integer AS r5,
  COUNT(*) FILTER (WHERE rating = 4)::integer AS r4,
  COUNT(*) FILTER (WHERE rating = 3)::integer AS r3,
  COUNT(*) FILTER (WHERE rating = 2)::integer AS r2,
  COUNT(*) FILTER (WHERE rating = 1)::integer AS r1
FROM public.barraca_reviews
WHERE estado = 'aprobada'
GROUP BY producto_id;

-- ============================================================================
-- 5. RLS
-- ============================================================================
ALTER TABLE public.barraca_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barraca_reviews_likes ENABLE ROW LEVEL SECURITY;

-- Anon puede leer solo reviews aprobadas (para mostrar en producto público).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'barraca_reviews'
      AND policyname = 'barraca_reviews_anon_aprobadas'
  ) THEN
    CREATE POLICY barraca_reviews_anon_aprobadas
      ON public.barraca_reviews FOR SELECT TO anon
      USING (estado = 'aprobada');
  END IF;
END $$;

COMMIT;

-- Verificación:
--   SELECT * FROM barraca_productos_rating LIMIT 5;
--   SELECT count(*) FROM barraca_reviews WHERE estado = 'pendiente';
