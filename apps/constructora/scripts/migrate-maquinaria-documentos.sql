-- ============================================================================
-- Migration: maquinaria_documentos + Storage bucket
--
-- Feature de documentación de maquinarias (admin-only):
-- - Tabla con metadata + path al archivo en Storage
-- - Bucket privado `maquinaria-documentos` (acceso solo via signed URLs)
-- - 9 categorías predefinidas con check constraint
--
-- Idempotente: CREATE TABLE IF NOT EXISTS, ON CONFLICT DO NOTHING.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Tabla principal
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.maquinaria_documentos (
  id serial PRIMARY KEY,
  maquinaria_id integer NOT NULL REFERENCES public.maquinarias(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN (
    'rt',
    'permiso_circulacion',
    'soap',
    'seguro_rc',
    'ficha_tecnica',
    'manual_operacion',
    'mantencion',
    'capacitacion_operador',
    'foto'
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

CREATE INDEX IF NOT EXISTS maq_docs_maquinaria_tipo_idx
  ON public.maquinaria_documentos (maquinaria_id, tipo);

CREATE INDEX IF NOT EXISTS maq_docs_vencimiento_idx
  ON public.maquinaria_documentos (fecha_vencimiento)
  WHERE fecha_vencimiento IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Trigger updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.maq_docs_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS maq_docs_updated_at_trigger ON public.maquinaria_documentos;
CREATE TRIGGER maq_docs_updated_at_trigger
  BEFORE UPDATE ON public.maquinaria_documentos
  FOR EACH ROW EXECUTE FUNCTION public.maq_docs_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: solo service_role (admin via supabaseAdmin)
-- ---------------------------------------------------------------------------
ALTER TABLE public.maquinaria_documentos ENABLE ROW LEVEL SECURITY;
-- Sin policies = acceso bloqueado para anon/authenticated. Solo service_role.

-- ---------------------------------------------------------------------------
-- Storage bucket: maquinaria-documentos (privado)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'maquinaria-documentos',
  'maquinaria-documentos',
  false,  -- privado: solo signed URLs
  10485760,  -- 10 MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Storage policies (deny anon, deny authenticated — solo service_role)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- Asegurar que el bucket NO sea accesible por anon/authenticated.
  -- Sin policies de SELECT/INSERT/DELETE para roles non-service, queda bloqueado.
  -- Pueden quedar policies legacy de proyectos previos; las eliminamos por nombre conocido si existen.
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'maq_docs_anon_read') THEN
    DROP POLICY maq_docs_anon_read ON storage.objects;
  END IF;
END $$;

COMMIT;

-- ---------------------------------------------------------------------------
-- Verificación
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  tabla_existe boolean;
  bucket_existe boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='maquinaria_documentos')
    INTO tabla_existe;
  SELECT EXISTS (SELECT 1 FROM storage.buckets WHERE id='maquinaria-documentos')
    INTO bucket_existe;
  RAISE NOTICE 'maquinaria_documentos table: %', tabla_existe;
  RAISE NOTICE 'maquinaria-documentos bucket: %', bucket_existe;
END $$;
