-- migrate-users-sso-email.sql
--
-- SSO Google para admins: permite mapear la cuenta Google personal de un
-- admin a su fila en public.users sin cambiar su email de login.
--
-- El login SSO (packages/shared/src/auth/index.ts → findAdminPorSsoEmail)
-- acepta una cuenta Google si su email coincide con users.email O con
-- users.sso_email (filtrado por scope). Allowlist pura: sin fila, no hay
-- sesión.
--
-- Aplicar: ejecutar en Supabase Dashboard → SQL Editor.

BEGIN;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS sso_email text;

COMMENT ON COLUMN public.users.sso_email IS
  'Email de la cuenta Google autorizada para SSO de este usuario (puede diferir de email). NULL = sin SSO mapeado.';

-- Único e insensible a mayúsculas; parcial para permitir múltiples NULL.
CREATE UNIQUE INDEX IF NOT EXISTS users_sso_email_unique
  ON public.users (lower(sso_email))
  WHERE sso_email IS NOT NULL;

-- Cuenta Google del dueño → usuario id=1 (contacto@jurmaq.cl, scope='both').
UPDATE public.users
SET sso_email = 'jrgubival@gmail.com'
WHERE id = 1;

COMMIT;

-- Verificación:
--   SELECT id, email, sso_email, role, scope FROM public.users ORDER BY id;
