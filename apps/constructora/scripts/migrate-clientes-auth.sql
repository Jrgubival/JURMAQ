-- migrate-clientes-auth.sql
--
-- Sprint 3: Portal Cliente Arriendo.
--
-- Hoy `clientes` se popula manualmente desde admin o vía wizard de cotización
-- (sin auth). Pasamos a soportar login real para que el cliente arrendatario
-- vea sus contratos, descargue PDFs, lance nuevas cotizaciones pre-cargadas,
-- y eventualmente gestione su tarjeta guardada (PARTE 1 Klap).
--
-- Decisión: extender `clientes` en lugar de crear `arriendo_usuarios`. Razones:
--   - Reusa los datos personales ya recolectados (RUT, empresa, dirección).
--   - Evita FK ambigua (usuario↔cliente).
--   - Compatibilidad: clientes históricos sin password siguen funcionando;
--     al primer intento de login con su email, se les envía link
--     "configura tu contraseña" (reset_token).
--
-- Aplicar: Supabase Dashboard → SQL Editor.

BEGIN;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS email_verificado_at timestamptz,
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_via text NOT NULL DEFAULT 'admin'
    CHECK (created_via IN ('admin','self_signup','migracion','cotizacion')),
  ADD COLUMN IF NOT EXISTS reset_token text,
  ADD COLUMN IF NOT EXISTS reset_token_expira_at timestamptz,
  ADD COLUMN IF NOT EXISTS ultimo_login_at timestamptz;

-- Email único por cliente — case-insensitive. Si ya hay duplicados, la
-- migración va a fallar acá; resolver duplicados primero.
CREATE UNIQUE INDEX IF NOT EXISTS clientes_email_unique
  ON public.clientes (LOWER(email))
  WHERE email IS NOT NULL;

-- Lookup rápido del reset_token cuando el cliente abre el link.
CREATE INDEX IF NOT EXISTS clientes_reset_token_idx
  ON public.clientes (reset_token)
  WHERE reset_token IS NOT NULL;

COMMENT ON COLUMN public.clientes.password_hash IS 'bcrypt hash. NULL para clientes históricos sin password todavía configurado.';
COMMENT ON COLUMN public.clientes.created_via IS 'Origen del registro: admin (creado por staff), self_signup (registro directo), migracion (importado), cotizacion (auto-creado al cotizar).';
COMMENT ON COLUMN public.clientes.reset_token IS 'Token único para reset de password / primera configuración. NULL si no hay reset activo.';

COMMIT;

-- Verificación:
--   \d clientes
--   SELECT count(*) FROM clientes WHERE password_hash IS NULL;
--   (cantidad inicial de clientes históricos sin password)
