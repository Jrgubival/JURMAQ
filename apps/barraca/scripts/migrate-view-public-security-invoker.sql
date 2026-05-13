-- ============================================================================
-- Migration: barraca_productos_public con security_invoker=true
--
-- Audit 1B H6: las vistas en Postgres ejecutan por default con privilegios
-- del OWNER (security_definer-like). Si la view fue creada por superuser,
-- saltarse RLS de las tablas subyacentes.
--
-- security_invoker=true hace que la view use los privilegios del USUARIO
-- que la consulta, respetando las RLS policies de las tablas base.
--
-- Idempotente: recrea la view con la nueva opción.
-- ============================================================================

BEGIN;

-- Solo recrear si la view existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public'
      AND viewname = 'barraca_productos_public'
  ) THEN
    -- Capturar la definición actual
    -- (En producción asume que la view tiene la columna `costo` excluida)
    EXECUTE $sql$
      ALTER VIEW public.barraca_productos_public SET (security_invoker = true);
    $sql$;
    RAISE NOTICE 'View barraca_productos_public ahora usa security_invoker';
  ELSE
    RAISE NOTICE 'View barraca_productos_public NO EXISTE — crearla con security_invoker desde el principio';
  END IF;
END $$;

-- Verify
DO $$
DECLARE
  opts text[];
BEGIN
  SELECT reloptions INTO opts FROM pg_class WHERE relname = 'barraca_productos_public';
  RAISE NOTICE 'View options: %', COALESCE(opts::text, 'NULL');
END $$;

COMMIT;
