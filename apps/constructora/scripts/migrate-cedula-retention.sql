-- migrate-cedula-retention.sql
--
-- Fix L-1 del Sprint 1 (política de retención de cédulas de identidad).
--
-- Ley 19.628 (Protección de la Vida Privada) requiere que los datos
-- personales sensibles (incluyendo imágenes de documentos de identidad)
-- se mantengan solo el tiempo estrictamente necesario para la finalidad
-- por la cual fueron recolectados. Para JURMAQ, esa finalidad termina
-- una vez firmado el contrato y resueltas las disputas razonables.
--
-- Definimos retención de 90 días post-firma. Después:
--   - Borramos el archivo de Storage (bucket `cedulas-firma`).
--   - Anulamos `cedula_url` en la base.
--   - Registramos `cedula_purged_at` para auditoría.
--   - Mantenemos `cedula_hash` (SHA-256) porque es parte del evidence
--     package que valida `firma_hash` — sin él, perdemos integridad de
--     la firma electrónica. Es un hash, no recupera datos personales.
--
-- Aplicar: ejecutar en Supabase Dashboard → SQL Editor.

BEGIN;

ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS cedula_purged_at timestamptz;

COMMENT ON COLUMN public.contratos.cedula_purged_at IS
  'Timestamp del borrado de la imagen de cédula del Storage. Cuando es NOT NULL, cedula_url debe estar NULL. Ley 19.628 — retención 90 días post-firma.';

-- Si existe la tabla contratos_audit_log con CHECK sobre event_type, hay que
-- agregar 'cedula_purged' y 'auto_expired' (este último para M-1) al CHECK.
-- Hacemos esto idempotente: DROP CONSTRAINT IF EXISTS, recrear.
--
-- Si tu CHECK actual tiene OTROS valores no listados acá, edita la lista para
-- INCLUIRLOS antes de aplicar la migración.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'contratos_audit_log'
  ) THEN
    ALTER TABLE public.contratos_audit_log
      DROP CONSTRAINT IF EXISTS contratos_audit_log_event_type_check;
    ALTER TABLE public.contratos_audit_log
      ADD CONSTRAINT contratos_audit_log_event_type_check
      CHECK (event_type IN (
        'identity_uploaded',
        'otp_requested',
        'otp_verified',
        'otp_failed',
        'sign_completed',
        'sign_failed',
        'arrendador_signed',
        'arrendador_unsigned',
        'cedula_purged',
        'auto_expired'
      ));
  END IF;
END $$;

COMMIT;

-- Verificación post-aplicación:
--   SELECT count(*) FROM contratos WHERE cedula_purged_at IS NOT NULL;
--   (debe ser 0 inicialmente; sube cuando el cron empieza a correr)
