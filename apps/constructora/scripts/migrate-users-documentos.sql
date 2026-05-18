-- ============================================================================
-- Migration: users_documentos + Storage bucket
--
-- Mirror del sistema maquinaria_documentos, pero para documentos del
-- personal/operarios (Matías Zúñiga, Mauricio Ricciardi, etc.):
--   - Tabla con metadata + path al archivo en Storage
--   - Bucket privado `users-documentos` (acceso solo via signed URLs)
--   - 7 categorías predefinidas con check constraint
--
-- Idempotente: CREATE TABLE IF NOT EXISTS, ON CONFLICT DO NOTHING.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Tabla principal
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users_documentos (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN (
    'licencia_municipal',
    'cedula',
    'contrato_laboral',
    'capacitacion',
    'examen_psicosensometrico',
    'foto',
    'otro'
  )),
  nombre text NOT NULL,
  descripcion text,
  archivo_path text NOT NULL UNIQUE,
  archivo_mime text NOT NULL,
  archivo_size_bytes integer NOT NULL CHECK (archivo_size_bytes > 0 AND archivo_size_bytes <= 10485760),
  fecha_emision date,
  fecha_vencimiento date CHECK (
    fecha_vencimiento IS NULL
    OR fecha_emision IS NULL
    OR fecha_vencimiento >= fecha_emision
  ),
  created_by integer REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_docs_user_tipo_idx
  ON public.users_documentos (user_id, tipo);

CREATE INDEX IF NOT EXISTS users_docs_vencimiento_idx
  ON public.users_documentos (fecha_vencimiento)
  WHERE fecha_vencimiento IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Trigger updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.users_docs_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_docs_updated_at_trigger ON public.users_documentos;
CREATE TRIGGER users_docs_updated_at_trigger
  BEFORE UPDATE ON public.users_documentos
  FOR EACH ROW EXECUTE FUNCTION public.users_docs_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: solo service_role (admin via supabaseAdmin)
-- ---------------------------------------------------------------------------
ALTER TABLE public.users_documentos ENABLE ROW LEVEL SECURITY;
-- Sin policies = acceso bloqueado para anon/authenticated. Solo service_role.

-- ---------------------------------------------------------------------------
-- Storage bucket: users-documentos (privado)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'users-documentos',
  'users-documentos',
  false,  -- privado: solo signed URLs
  10485760,  -- 10 MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

COMMIT;
