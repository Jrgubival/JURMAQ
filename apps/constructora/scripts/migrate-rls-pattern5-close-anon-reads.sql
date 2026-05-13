-- ============================================================================
-- Pattern 5 audit (2026-05-13) — cerrar SELECT a anon en tablas sensibles
-- ============================================================================
--
-- Hallazgo: vía REST `apikey=anon`, las siguientes tablas devolvian filas:
--   - public.cotizaciones_arriendo  (0 filas hoy, PII al primer cliente)
--   - public.proyectos              (10 filas → "Nestle Chile" + montos)
--   - public.iva_libro_ventas       (0 hoy, datos contables / SII)
--   - public.iva_libro_compras      (0 hoy, datos contables / SII)
--
-- Cero client-side fetch usa estas tablas directamente — solo backends que
-- usan supabaseAdmin (bypass RLS). Cerrar SELECT a anon es safe.
--
-- Idempotente: usa DROP POLICY IF EXISTS y revoca explícitamente.
-- ============================================================================

BEGIN;

-- 1) cotizaciones_arriendo: dropear la policy permisiva "USING (true)" y
--    reemplazarla por ninguna (anon nunca debe llegar acá; backend ya usa admin).
DROP POLICY IF EXISTS cot_arriendo_anon_read_by_email ON public.cotizaciones_arriendo;

-- 2) proyectos: revocar SELECT a anon. RLS sigue habilitada, falta de policy
--    significa "deny all" para anon.
REVOKE SELECT ON public.proyectos FROM anon;

-- 3) iva_libro_ventas / iva_libro_compras: igual
REVOKE SELECT ON public.iva_libro_ventas  FROM anon;
REVOKE SELECT ON public.iva_libro_compras FROM anon;

-- 4) Defensa en profundidad — asegurar RLS está habilitada en las 4
ALTER TABLE public.cotizaciones_arriendo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proyectos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iva_libro_ventas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iva_libro_compras     ENABLE ROW LEVEL SECURITY;

-- 5) Limpieza de Pattern 1 (LOW): la view `barraca_productos_public` heredó
--    GRANTs INSERT/UPDATE/DELETE/TRIGGER/TRUNCATE/REFERENCES a anon de la
--    creación inicial. No son explotables (la tabla subyacente no permite
--    write a anon) pero son ruido confuso. Quitarlos.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.barraca_productos_public
  FROM anon, authenticated;
-- (Mantenemos SELECT en la view — esa es su razón de ser.)

-- 6) Verificación final (lee y muestra)
SELECT 'cot_arriendo policies after' AS check, count(*) AS n
  FROM pg_policies WHERE schemaname='public' AND tablename='cotizaciones_arriendo';
SELECT 'proyectos anon grants after' AS check, count(*) AS n
  FROM information_schema.role_table_grants
  WHERE table_schema='public' AND table_name='proyectos' AND grantee='anon';
SELECT 'iva_libro anon grants after' AS check, count(*) AS n
  FROM information_schema.role_table_grants
  WHERE table_schema='public' AND table_name IN ('iva_libro_ventas','iva_libro_compras') AND grantee='anon';

COMMIT;
