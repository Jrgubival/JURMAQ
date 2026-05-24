-- ============================================================================
-- MIGRATION: user_sessions (Fase 2A.1 plan v2)
-- ============================================================================
--
-- Crea la tabla compartida entre constructora + barraca para sesiones revocables.
--
-- Diseño:
--   - id (uuid) = session_id que va en el JWT como `sid`
--   - user_id (text) = ID del usuario en su app correspondiente
--                      (acepta uuid o int como string para no atar al schema legacy)
--   - scope = 'constructora' | 'barraca' | 'app' (cross-app isolation)
--   - revoked_at = nullable, idempotent revocation
--   - expires_at = horizon del JWT (siempre se chequea contra now())
--
-- Pre-requisito:
--   - AUTH_SECRET seteado en ambas apps (mismo valor — comparten signing key).
--   - supabaseAdmin disponible en `@jurmaq/shared`.
--
-- Aplicar: Supabase Dashboard → SQL Editor → Run.
-- Snapshot recomendado ANTES de aplicar: Settings → Database → Backups.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text NOT NULL,
  scope           text NOT NULL CHECK (scope IN ('constructora','barraca','app')),
  role            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_used_at    timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  revoked_at      timestamptz,
  ip              text,
  user_agent      text
);

-- Indexes para lookups frecuentes
CREATE INDEX IF NOT EXISTS user_sessions_active_idx
  ON public.user_sessions (user_id, scope)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS user_sessions_expires_idx
  ON public.user_sessions (expires_at)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS user_sessions_id_lookup_idx
  ON public.user_sessions (id, scope, user_id)
  WHERE revoked_at IS NULL;

-- RLS: la tabla solo se accede via supabaseAdmin. Anon/authenticated NUNCA tocan
-- la tabla directo — ENABLE RLS sin policies = silent deny (default).
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Revocar acceso a anon/authenticated por defensa en profundidad
REVOKE ALL ON public.user_sessions FROM anon, authenticated;

COMMIT;

-- ============================================================================
-- ROLLBACK INLINE (si hay que revertir)
-- ============================================================================
-- BEGIN;
--   DROP TABLE IF EXISTS public.user_sessions;
-- COMMIT;
-- ============================================================================

-- ============================================================================
-- VERIFICACIÓN POST-APPLY
-- ============================================================================
-- 1. Confirmar tabla creada:
--    SELECT count(*) FROM public.user_sessions;  -- esperado: 0
--
-- 2. Confirmar RLS habilitada:
--    SELECT rowsecurity FROM pg_tables WHERE tablename = 'user_sessions';
--    -- esperado: true
--
-- 3. Confirmar permisos anon/authenticated revocados:
--    SELECT grantee, privilege_type FROM information_schema.table_privileges
--    WHERE table_name = 'user_sessions';
--    -- esperado: solo postgres + service_role
-- ============================================================================
