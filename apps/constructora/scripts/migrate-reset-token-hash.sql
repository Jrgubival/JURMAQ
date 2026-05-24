-- ============================================================================
-- MIGRATION: clientes.reset_token_hash (Fase 2A.3 plan v2)
-- ============================================================================
--
-- Reemplaza el plaintext de clientes.reset_token por un hash bcrypt en una nueva
-- columna. Mantiene la columna vieja durante 1 release como fallback de rollback.
--
-- ANTES (vulnerable):
--   clientes.reset_token TEXT  -- plaintext
--   → DB read (vía SQLi, dump, backup leak, dev con prod data, etc.) = takeover
--     de cualquier cuenta con reset pendiente.
--
-- DESPUÉS:
--   clientes.reset_token_hash TEXT  -- bcrypt hash con cost factor 10
--   → DB read inútil (atacante necesitaría además romper bcrypt por cada hash)
--
-- IMPACTO EN CÓDIGO (siguiente PR, no parte de esta migration):
--   - Endpoint que GENERA reset token:
--     * Genera `rawToken = crypto.randomBytes(32).toString('base64url')`
--     * Guarda `await bcrypt.hash(rawToken, 10)` en `reset_token_hash`
--     * Envía `rawToken` raw al email del usuario (única vez visible)
--   - Endpoint que VERIFICA reset token:
--     * Recibe `rawToken` del URL
--     * `await bcrypt.compare(rawToken, row.reset_token_hash)`
--     * Si match → permite cambio password
--
-- Side effect: tokens emitidos ANTES de esta migration son inválidos. Si hay
-- usuarios con reset pendiente, comunicar y pedir que pidan uno nuevo.
--
-- Aplicar: Supabase Dashboard → SQL Editor → Run.
-- Snapshot ANTES: Settings → Database → Backups.
-- ============================================================================

BEGIN;

-- 1. Agregar nueva columna hasheada (nullable durante transición)
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS reset_token_hash text;

-- 2. Comentario explicativo
COMMENT ON COLUMN public.clientes.reset_token_hash IS
  'bcrypt hash del reset token. Generado con cost=10. Reemplaza reset_token plaintext '
  '(plan v2 Fase 2A.3). La columna reset_token quedará nullable hasta el próximo '
  'release y luego se DROP.';

-- 3. Invalidar tokens viejos: limpiar reset_token plaintext de todas las filas activas
--    (los usuarios deberán pedir uno nuevo — comunicar antes de aplicar).
UPDATE public.clientes
  SET reset_token = NULL,
      reset_token_expira_at = NULL  -- nombre real de la columna en clientes (confirmado en codebase)
  WHERE reset_token IS NOT NULL;

COMMIT;

-- ============================================================================
-- ROLLBACK INLINE
-- ============================================================================
-- BEGIN;
--   ALTER TABLE public.clientes DROP COLUMN IF EXISTS reset_token_hash;
-- COMMIT;
-- ============================================================================

-- ============================================================================
-- POST-RELEASE NEXT (cuando el código nuevo esté en prod y haya pasado 1 semana
-- sin issues): drop de la columna vieja para evitar regresión.
-- ============================================================================
-- BEGIN;
--   ALTER TABLE public.clientes DROP COLUMN IF EXISTS reset_token;
--   -- mantener reset_token_expires_at por ahora si el código lo usa.
-- COMMIT;
-- ============================================================================

-- ============================================================================
-- VERIFICACIÓN POST-APPLY
-- ============================================================================
-- 1. Confirmar columna nueva existe:
--    \d public.clientes
--    -- debe listar reset_token_hash text
--
-- 2. Confirmar que reset_token quedó nulo en todas las filas:
--    SELECT count(*) FROM public.clientes WHERE reset_token IS NOT NULL;
--    -- esperado: 0
--
-- 3. Post-código-deploy: confirmar que un nuevo flow de reset funciona:
--    a. Pedir reset → enviar email
--    b. Click link en email → reset_token_hash poblado en DB (no reset_token)
--    c. Cambio de password exitoso
-- ============================================================================
