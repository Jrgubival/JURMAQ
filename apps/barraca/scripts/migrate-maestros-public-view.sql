-- ============================================================================
-- MIGRATION: maestros_public view (Fase 2B.1 plan v2)
-- ============================================================================
--
-- Cierra el leak S0 de RUT + datos bancarios completos de maestros expuestos
-- a anon via PostgREST directo.
--
-- ANTES (vulnerable):
--   curl https://<proyecto>.supabase.co/rest/v1/maestros?select=* \
--     -H "apikey: <ANON_KEY>"
--   → devuelve rut, banco, numero_cuenta, tipo_cuenta, telefono, email
--
-- DESPUÉS (esta migration):
--   - REVOKE de la tabla base maestros a anon
--   - DROP de policy maestros_anon_validar (que daba SELECT sin filtrar columnas)
--   - View maestros_public con columnas seguras + RUT enmascarado
--   - GRANT SELECT en la view a anon, authenticated
--
-- IMPACTO EN CÓDIGO (verificar antes de aplicar):
--   El endpoint /api/public/maestros/[codigo]/route.ts DEBE leer de maestros_public
--   en vez de maestros. Si lee la tabla base con anon key, fallará silenciosamente.
--
-- PRE-APPLY: grep contra el repo
--   grep -rn "from('maestros')" apps/barraca/src
--   grep -rn 'from\("maestros"\)' apps/barraca/src
--   → cualquier query con supabase anon-key DEBE migrar a maestros_public
--   → queries con supabaseAdmin pueden seguir leyendo maestros directo
--
-- Pre-requisito: Fase 1.2 check 5 confirmó qué policies activas hay.
--
-- Aplicar: Supabase Dashboard → SQL Editor → Run.
-- Snapshot recomendado ANTES: Settings → Database → Backups.
-- ============================================================================

BEGIN;

-- 1. Drop policy permisiva existente (audit dijo "maestros_anon_validar" — confirmar nombre real)
DROP POLICY IF EXISTS maestros_anon_validar ON public.maestros;
DROP POLICY IF EXISTS maestros_anon_read ON public.maestros;       -- variantes posibles
DROP POLICY IF EXISTS maestros_public_select ON public.maestros;   -- variantes posibles

-- 2. REVOKE todo acceso de anon a la tabla base
REVOKE ALL ON public.maestros FROM anon;
-- authenticated mantiene acceso si lo necesitas para portal autenticado de maestros;
-- si NO lo necesitan, también REVOKE:
-- REVOKE ALL ON public.maestros FROM authenticated;

-- 3. Crear view pública limitada
CREATE OR REPLACE VIEW public.maestros_public AS
SELECT
  id,
  codigo,
  nombre,
  -- RUT enmascarado: muestra solo el cuerpo sin dígito verificador
  -- Ej: "12.345.678-9" → "12.345.***-*"
  REGEXP_REPLACE(rut, '^([0-9]{1,2}\.?[0-9]{0,3})\.?[0-9]*-?[0-9Kk]?$', '\1.***-*') AS rut_masked,
  porcentaje_comision,
  created_at,
  activo
FROM public.maestros
WHERE activo = true;

-- 4. GRANT SELECT en la view (no en la base)
GRANT SELECT ON public.maestros_public TO anon, authenticated;

-- 5. Comentario explicativo para el dashboard
COMMENT ON VIEW public.maestros_public IS
  'Vista pública con columnas seguras de maestros activos. Oculta RUT, banco, '
  'cuenta, email y teléfono. Usar desde endpoints públicos (anon key). '
  'Para datos completos usar supabaseAdmin contra la tabla base maestros.';

COMMIT;

-- ============================================================================
-- ROLLBACK INLINE
-- ============================================================================
-- BEGIN;
--   DROP VIEW IF EXISTS public.maestros_public;
--   GRANT SELECT ON public.maestros TO anon;
--   -- Si quieres restaurar policy original (NO recomendado — era el bug):
--   -- CREATE POLICY maestros_anon_validar ON public.maestros
--   --   FOR SELECT TO anon USING (true);
-- COMMIT;
-- ============================================================================

-- ============================================================================
-- VERIFICACIÓN POST-APPLY
-- ============================================================================
-- 1. Confirmar que anon NO puede leer maestros base:
--    SET ROLE anon;
--    SELECT count(*) FROM public.maestros;
--    -- esperado: ERROR permission denied (o 0 filas si RLS sin policy)
--    RESET ROLE;
--
-- 2. Confirmar que anon SÍ puede leer maestros_public con RUT enmascarado:
--    SET ROLE anon;
--    SELECT codigo, nombre, rut_masked FROM public.maestros_public LIMIT 3;
--    -- esperado: filas con rut_masked tipo "12.345.***-*"
--    RESET ROLE;
--
-- 3. Confirmar que supabaseAdmin (server-side) sigue leyendo todo:
--    SELECT codigo, nombre, rut, numero_cuenta FROM public.maestros LIMIT 3;
--    -- esperado: filas con datos completos (corriendo como service_role / postgres)
-- ============================================================================
