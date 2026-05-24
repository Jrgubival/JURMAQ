-- ============================================================================
-- MIGRATION: RLS base consolidado para barraca (Fase 2B.2 plan v2)
-- ============================================================================
--
-- Objetivo: defense-in-depth. La app actual funciona con supabaseAdmin
-- (service role) que bypassa RLS, pero las tablas core de barraca NO tienen
-- políticas RLS explícitas. Si alguna route accidentalmente usa supabasePublic
-- (anon key) en una tabla sensible, queda expuesta.
--
-- Esta migración:
--   1. ENABLE ROW LEVEL SECURITY en cada tabla core
--   2. Agrega policy "anon SELECT" donde tiene sentido (catálogo público)
--   3. REVOKE write para anon en TODAS
--   4. Marca silent-deny en tablas privadas (sin policy → null result para anon)
--
-- Pre-requisitos verificados antes de aplicar:
--   - Fase 1 SQL check #2 listó tablas con RLS habilitado pero sin policies
--   - Audit confirmó tablas core barraca sin RLS efectivo
--   - supabaseAdmin (service role) bypassa RLS — no afecta endpoints admin
--
-- IMPACTO EN APPS:
--   - Endpoints que usan supabaseAdmin → sin cambios (bypassa RLS)
--   - Endpoints que usan supabasePublic con `barraca_carrito`, `barraca_usuarios`,
--     `barraca_cotizaciones`, `barraca_wishlist`, `barraca_reviews`:
--     → fallan silenciosamente (devuelven [] o null). Hay que auditar y migrar
--       a supabaseAdmin con guard de session, o exponer via RPC firmada.
--
-- VERIFICAR ANTES (correr local):
--   grep -rn "supabasePublic.*from('barraca_carrito\|barraca_cotizaciones\|barraca_usuarios\|barraca_wishlist\|barraca_reviews')" apps/barraca/src
--   → cualquier match es código que se rompe después de aplicar esta SQL.
--
-- Aplicar: Supabase Dashboard → SQL Editor → Run.
-- Snapshot recomendado ANTES: Settings → Database → Backups.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. CATALOGO PÚBLICO — lectura anon OK, write bloqueado
-- ----------------------------------------------------------------------------

-- barraca_categorias: ya tiene RLS habilitado según harden-rls.js anterior.
-- Aseguramos policy + revoke writes.
ALTER TABLE IF EXISTS public.barraca_categorias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS barraca_categorias_public_read ON public.barraca_categorias;
CREATE POLICY barraca_categorias_public_read ON public.barraca_categorias
  FOR SELECT TO anon, authenticated
  USING (activa = true);
REVOKE INSERT, UPDATE, DELETE ON public.barraca_categorias FROM anon, authenticated;

-- barraca_productos: idem (la vista public ya existe, esto cierra base)
ALTER TABLE IF EXISTS public.barraca_productos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS barraca_productos_public_read ON public.barraca_productos;
CREATE POLICY barraca_productos_public_read ON public.barraca_productos
  FOR SELECT TO anon, authenticated
  USING (activo = true);
REVOKE INSERT, UPDATE, DELETE ON public.barraca_productos FROM anon, authenticated;

-- barraca_reviews: anon puede LEER reviews aprobadas. Write requiere sesión.
ALTER TABLE IF EXISTS public.barraca_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS barraca_reviews_public_read ON public.barraca_reviews;
CREATE POLICY barraca_reviews_public_read ON public.barraca_reviews
  FOR SELECT TO anon, authenticated
  USING (aprobada = true);
-- Inserts solo via supabaseAdmin con guard en endpoint /api/cuenta/reviews
REVOKE INSERT, UPDATE, DELETE ON public.barraca_reviews FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. DATOS PRIVADOS — silent-deny default, solo supabaseAdmin escribe/lee
-- ----------------------------------------------------------------------------

-- barraca_usuarios: contiene RUT + email + telefono. NUNCA exponer a anon.
ALTER TABLE IF EXISTS public.barraca_usuarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS barraca_usuarios_anon_select ON public.barraca_usuarios;
DROP POLICY IF EXISTS barraca_usuarios_select ON public.barraca_usuarios;
-- Sin policies → ENABLE RLS hace SILENT DENY a anon/authenticated.
-- supabaseAdmin (service_role) bypassa RLS, sigue funcionando.
REVOKE ALL ON public.barraca_usuarios FROM anon, authenticated;

-- barraca_carrito + barraca_carrito_items: sessionId-based.
-- Acceso debe ser via RPC firmada o supabaseAdmin con session guard.
-- Aquí simplemente cerramos anon escribir / leer la tabla directo.
ALTER TABLE IF EXISTS public.barraca_carrito ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.barraca_carrito_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.barraca_carrito FROM anon, authenticated;
REVOKE ALL ON public.barraca_carrito_items FROM anon, authenticated;

-- barraca_carrito_abandonado: contiene email + datos del cliente. supabaseAdmin only.
ALTER TABLE IF EXISTS public.barraca_carrito_abandonado ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.barraca_carrito_abandonado FROM anon, authenticated;

-- barraca_cotizaciones: contiene email + RUT + total. supabaseAdmin only.
ALTER TABLE IF EXISTS public.barraca_cotizaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS barraca_cotizaciones_anon ON public.barraca_cotizaciones;
REVOKE ALL ON public.barraca_cotizaciones FROM anon, authenticated;

-- barraca_wishlist: sessionId-based o usuario_id. supabaseAdmin only.
ALTER TABLE IF EXISTS public.barraca_wishlist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.barraca_wishlist FROM anon, authenticated;

-- barraca_reset_tokens (si existe — usado por flow de reset password)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'barraca_reset_tokens') THEN
    ALTER TABLE public.barraca_reset_tokens ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.barraca_reset_tokens FROM anon, authenticated;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. ADMIN / TELEMETRY — silent-deny estricto
-- ----------------------------------------------------------------------------

-- admin_emails_log: registro de emails enviados (contiene PII de destinatarios)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'admin_emails_log') THEN
    ALTER TABLE public.admin_emails_log ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.admin_emails_log FROM anon, authenticated;
  END IF;
END $$;

-- admin_notifications (Tier 6 F4)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'admin_notifications') THEN
    ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.admin_notifications FROM anon, authenticated;
  END IF;
END $$;

-- precio_historial (interno)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'precio_historial') THEN
    ALTER TABLE public.precio_historial ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.precio_historial FROM anon, authenticated;
  END IF;
END $$;

-- promociones (la lectura pública la maneja el endpoint con supabaseAdmin
-- ya rate-limited en commit acb3177)
ALTER TABLE IF EXISTS public.promociones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.promociones FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. MAESTROS — ya cubierto por migrate-maestros-public-view.sql
-- ----------------------------------------------------------------------------
-- comisiones_maestro: contiene montos por referido. supabaseAdmin only.
ALTER TABLE IF EXISTS public.comisiones_maestro ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.comisiones_maestro FROM anon, authenticated;

-- pagos_maestros: idem.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pagos_maestros') THEN
    ALTER TABLE public.pagos_maestros ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.pagos_maestros FROM anon, authenticated;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK INLINE (si rompe algo en producción)
-- ============================================================================
-- BEGIN;
--   -- Restaurar lecturas anon (en caso de emergencia)
--   GRANT SELECT ON public.barraca_usuarios TO anon;
--   GRANT SELECT ON public.barraca_carrito TO anon;
--   GRANT SELECT ON public.barraca_cotizaciones TO anon;
--   -- etc — pero IDEALMENTE arregla el endpoint para usar supabaseAdmin
-- COMMIT;
-- ============================================================================

-- ============================================================================
-- VERIFICACIÓN POST-APPLY
-- ============================================================================
-- 1. Confirmar todas las tablas con RLS habilitado:
--    SELECT tablename, rowsecurity FROM pg_tables
--    WHERE schemaname = 'public'
--      AND tablename LIKE 'barraca_%'
--      AND rowsecurity = true
--    ORDER BY tablename;
--
-- 2. Confirmar que anon no tiene SELECT en tablas privadas:
--    SELECT grantee, table_name, privilege_type
--    FROM information_schema.table_privileges
--    WHERE table_name IN ('barraca_usuarios','barraca_carrito','barraca_cotizaciones',
--                         'barraca_wishlist','admin_emails_log','comisiones_maestro')
--      AND grantee IN ('anon','authenticated');
--    -- esperado: 0 filas
--
-- 3. Smoke test desde el browser (Network tab):
--    - Cargar /maestros — debe mostrar maestros (lee de maestros_public via supabasePublic)
--    - Cargar /producto/xxx — debe mostrar producto
--    - Cargar /categorias/fierros — debe mostrar productos
--    - Agregar al carrito — debe funcionar (route usa supabaseAdmin con session guard)
-- ============================================================================
