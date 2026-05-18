-- ============================================================================
-- Migration: users.scope para aislamiento de sesión entre barraca y constructora
--
-- Cada usuario admin declara a qué app(s) pertenece. El callback de auth en
-- packages/shared/src/auth filtra la query por scope, y el callback session
-- valida que el JWT vivo coincide con `AUTH_SCOPE` del proceso.
--
-- Valores: 'barraca' | 'constructora' | 'both'
-- - 'both' = el dueño / sysadmin que opera ambas (default para 'admin' role).
-- - 'constructora' = personal histórico que entró pre-Barraca (default).
-- - 'barraca' = vendedores / e-commerce only.
--
-- El dueño actualiza manualmente los 'both' / 'barraca' tras aplicar la
-- migración. Default `constructora` preserva el comportamiento legacy.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.
-- ============================================================================

BEGIN;

-- 1. Agregar columna con default seguro
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'constructora';

-- 2. Check constraint para los 3 valores válidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND conname = 'users_scope_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_scope_check CHECK (scope IN ('barraca', 'constructora', 'both'));
  END IF;
END $$;

-- 3. Índice compuesto para la query de login (filter por email + scope)
CREATE INDEX IF NOT EXISTS users_scope_email_idx ON public.users(scope, email);

-- 4. Auto-elevar el admin con email contacto@jurmaq.cl a 'both' si existe
--    (es el dueño — necesita entrar a ambos paneles)
UPDATE public.users
   SET scope = 'both'
 WHERE email = 'contacto@jurmaq.cl'
   AND scope = 'constructora';

COMMIT;
