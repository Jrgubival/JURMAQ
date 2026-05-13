-- ============================================================================
-- Migration: RLS para barraca_promociones + barraca_cotizacion_items
--
-- Audit 1B H4+H5: estas tablas se usan extensamente desde código pero NO
-- aparecen en ninguna migración RLS del repo. Si están sin RLS, son accesibles
-- vía la PostgREST API anon directamente (data leak).
--
-- Idempotente: ENABLE RLS y CREATE POLICY usan IF NOT EXISTS donde Postgres
-- lo soporta, y se chequea pg_policies antes de crear.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- barraca_promociones — promociones por categoría
-- Acceso: SELECT público (necesario para getDailyPromotions desde SSR/anon),
-- INSERT/UPDATE/DELETE solo via service_role (admin).
-- ---------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.barraca_promociones ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'barraca_promociones'
      AND policyname = 'promociones_public_read'
  ) THEN
    CREATE POLICY promociones_public_read
      ON public.barraca_promociones
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

-- INSERT/UPDATE/DELETE quedan sin policies → solo service_role puede.

-- ---------------------------------------------------------------------------
-- barraca_cotizacion_items — items de una cotización
-- Acceso: SELECT/INSERT solo si la cotización padre es del cliente (matched
--   por email) o si es service_role.
-- Estrategia simplificada: leer/escribir solo via service_role (admin + APIs).
-- Cliente nunca consulta esta tabla directamente — siempre via endpoint que
-- gateway por email-match.
-- ---------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.barraca_cotizacion_items ENABLE ROW LEVEL SECURITY;

-- Sin policies = acceso bloqueado para anon/authenticated. Solo service_role.
-- Si en el futuro se quiere lectura pública (cliente lee sus items), agregar:
--   CREATE POLICY cot_items_owner_read ON public.barraca_cotizacion_items
--     FOR SELECT TO anon
--     USING (
--       EXISTS (
--         SELECT 1 FROM barraca_cotizaciones c
--         WHERE c.id = cotizacion_id
--         AND c.email = current_setting('request.jwt.claims', true)::json->>'email'
--       )
--     );
-- pero por ahora dejamos solo service_role.

-- ---------------------------------------------------------------------------
-- Verificación final (no falla si los valores difieren, solo informa)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  promo_rls boolean;
  items_rls boolean;
BEGIN
  SELECT relrowsecurity INTO promo_rls
  FROM pg_class WHERE relname = 'barraca_promociones';
  SELECT relrowsecurity INTO items_rls
  FROM pg_class WHERE relname = 'barraca_cotizacion_items';

  RAISE NOTICE 'RLS status post-migration:';
  RAISE NOTICE '  barraca_promociones: %', COALESCE(promo_rls::text, 'TABLE NOT FOUND');
  RAISE NOTICE '  barraca_cotizacion_items: %', COALESCE(items_rls::text, 'TABLE NOT FOUND');
END $$;

COMMIT;
