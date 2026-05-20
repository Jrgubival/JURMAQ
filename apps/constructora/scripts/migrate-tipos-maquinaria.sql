-- migrate-tipos-maquinaria.sql
--
-- E1 Tier 5: Normalización de tipos de maquinaria.
--
-- Hoy `maquinarias.tipo` es texto libre. Esto causa:
--   - Filtros por tipo se rompen ("Retroexcavadora" vs "retroexcavadora" vs "Retro-excavadora")
--   - Reportes inconsistentes
--   - SEO pobre (no hay canonical por tipo)
--
-- Fix: tabla `tipos_maquinaria` con FK + slug. La columna `tipo` (string)
-- se mantiene en `maquinarias` por compatibilidad — el nuevo `tipo_id`
-- es la fuente de verdad para filtros, y `tipo` queda como cache textual
-- (lo poblamos automáticamente via trigger desde el catálogo).
--
-- Aplicar: Supabase Dashboard → SQL Editor.

BEGIN;

CREATE TABLE IF NOT EXISTS public.tipos_maquinaria (
  id            serial PRIMARY KEY,
  slug          text UNIQUE NOT NULL,
  nombre        text NOT NULL,
  descripcion   text,
  orden         integer NOT NULL DEFAULT 100,
  activo        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tipos_maquinaria_slug_idx ON public.tipos_maquinaria (slug);
CREATE INDEX IF NOT EXISTS tipos_maquinaria_activo_idx ON public.tipos_maquinaria (activo, orden) WHERE activo = true;

-- Seed con tipos típicos de JURMAQ (referencia TIPOS_MAQUINA de packages/shared/src/seo).
INSERT INTO public.tipos_maquinaria (slug, nombre, descripcion, orden) VALUES
  ('retroexcavadora',  'Retroexcavadora',  'Equipo versátil para excavación + carga', 10),
  ('miniexcavadora',   'Miniexcavadora',   'Excavadora compacta para espacios reducidos', 20),
  ('minicargador',     'Minicargador',     'Cargador frontal compacto (Bobcat-type)', 30),
  ('brazo-articulado', 'Brazo articulado', 'Brazo telescópico de alcance largo', 40),
  ('grua',             'Grúa',             'Grúa móvil para levante de cargas', 50),
  ('camion-tolva',     'Camión tolva',     'Camión para transporte de áridos/escombros', 60),
  ('rodillo',          'Rodillo',          'Compactador vibratorio', 70),
  ('compactador',      'Compactador',      'Equipo compactación suelos/asfalto', 80)
ON CONFLICT (slug) DO NOTHING;

-- Agregar FK opcional en maquinarias (no NOT NULL para no romper datos existentes).
ALTER TABLE public.maquinarias
  ADD COLUMN IF NOT EXISTS tipo_id integer REFERENCES public.tipos_maquinaria(id);

-- Backfill: intentar matchear maquinaria.tipo (texto libre) con tipos_maquinaria.nombre
-- normalizando case + acentos.
UPDATE public.maquinarias m
   SET tipo_id = t.id
  FROM public.tipos_maquinaria t
 WHERE m.tipo_id IS NULL
   AND LOWER(TRIM(m.tipo)) IN (
     LOWER(t.nombre),
     LOWER(t.slug),
     REPLACE(LOWER(t.nombre), 'í', 'i')
   );

CREATE INDEX IF NOT EXISTS maquinarias_tipo_id_idx ON public.maquinarias (tipo_id);

ALTER TABLE public.tipos_maquinaria ENABLE ROW LEVEL SECURITY;

-- Política: lectura pública (necesario para filtros en /maquinarias listing).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tipos_maquinaria'
      AND policyname = 'tipos_maquinaria_anon_select'
  ) THEN
    CREATE POLICY tipos_maquinaria_anon_select
      ON public.tipos_maquinaria FOR SELECT TO anon
      USING (activo = true);
  END IF;
END $$;

COMMIT;

-- Verificación:
--   SELECT COUNT(*) FROM tipos_maquinaria;                              -- 8
--   SELECT COUNT(*) FROM maquinarias WHERE tipo_id IS NULL;            -- 0 idealmente
--   SELECT m.nombre, t.nombre FROM maquinarias m LEFT JOIN tipos_maquinaria t ON m.tipo_id = t.id LIMIT 5;
