-- ============================================================================
-- Migration: Arriendo v2 — COMPLETE (combined + bloqueos_maquinaria)
--
-- Combines all arriendo-v2 migrations into a single idempotent script.
-- Also creates bloqueos_maquinaria table for availability checking.
--
-- Run this ONCE in Supabase Dashboard SQL Editor.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Extend maquinarias with pricing columns
-- ============================================================================

ALTER TABLE public.maquinarias
  ADD COLUMN IF NOT EXISTS tarifa_neta numeric(10, 0),
  ADD COLUMN IF NOT EXISTS unidad_tarifa text
    CHECK (unidad_tarifa IS NULL OR unidad_tarifa IN ('hora', 'dia')),
  ADD COLUMN IF NOT EXISTS minimo_unidades numeric(4, 1),
  ADD COLUMN IF NOT EXISTS requiere_traslado boolean DEFAULT true;

-- Seed with official 2026-05-12 pricing (MAQUINARIAS_PRICING.md)
UPDATE public.maquinarias SET
  tarifa_neta = 30000, unidad_tarifa = 'hora', minimo_unidades = 6, requiere_traslado = true
WHERE LOWER(TRIM(nombre)) IN ('retroexcavadora', 'retro');

UPDATE public.maquinarias SET
  tarifa_neta = 25000, unidad_tarifa = 'hora', minimo_unidades = 6, requiere_traslado = true
WHERE LOWER(TRIM(nombre)) LIKE 'miniexcavadora%';

UPDATE public.maquinarias SET
  tarifa_neta = 25000, unidad_tarifa = 'hora', minimo_unidades = 6, requiere_traslado = true
WHERE LOWER(TRIM(nombre)) LIKE '%s650%' OR LOWER(TRIM(nombre)) LIKE 'minicargador s650%';

UPDATE public.maquinarias SET
  tarifa_neta = 24000, unidad_tarifa = 'hora', minimo_unidades = 6, requiere_traslado = true
WHERE LOWER(TRIM(nombre)) LIKE '%s550%' OR LOWER(TRIM(nombre)) LIKE 'minicargador s550%';

UPDATE public.maquinarias SET
  tarifa_neta = 24000, unidad_tarifa = 'hora', minimo_unidades = 6, requiere_traslado = true
WHERE LOWER(TRIM(nombre)) LIKE '%mustang%';

UPDATE public.maquinarias SET
  tarifa_neta = 120000, unidad_tarifa = 'dia', minimo_unidades = 1, requiere_traslado = true
WHERE LOWER(TRIM(nombre)) LIKE 'brazo articulado%' OR LOWER(TRIM(nombre)) LIKE '%articulado%';

UPDATE public.maquinarias SET
  tarifa_neta = 80000, unidad_tarifa = 'dia', minimo_unidades = 1, requiere_traslado = true
WHERE LOWER(TRIM(nombre)) LIKE 'fullen%';

UPDATE public.maquinarias SET
  tarifa_neta = 60000, unidad_tarifa = 'dia', minimo_unidades = 1, requiere_traslado = true
WHERE LOWER(TRIM(nombre)) LIKE 'genie%';

UPDATE public.maquinarias SET
  tarifa_neta = 30000, unidad_tarifa = 'hora', minimo_unidades = 6, requiere_traslado = false
WHERE LOWER(TRIM(nombre)) LIKE 'camion tolva%' OR LOWER(TRIM(nombre)) LIKE 'camión tolva%';

-- ============================================================================
-- 2. tarifas_traslado (singleton config)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tarifas_traslado (
  id serial PRIMARY KEY,
  vigente_desde timestamptz NOT NULL DEFAULT now(),
  costo_km numeric(8, 0) NOT NULL,
  costo_hora_operario numeric(8, 0) NOT NULL,
  carga_descarga_horas numeric(4, 2) NOT NULL DEFAULT 0.5,
  reserva_mantencion_pct numeric(4, 2) NOT NULL DEFAULT 0.25,
  reserva_utilidad_pct numeric(4, 2) NOT NULL DEFAULT 0.25,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS tarifas_traslado_vigente_desde_idx
  ON public.tarifas_traslado (vigente_desde DESC);

ALTER TABLE public.tarifas_traslado ENABLE ROW LEVEL SECURITY;

INSERT INTO public.tarifas_traslado
  (costo_km, costo_hora_operario, carga_descarga_horas, reserva_mantencion_pct, reserva_utilidad_pct, notas)
SELECT 300, 5000, 0.5, 0.25, 0.25, 'Seed inicial 2026-05-12 (MAQUINARIAS_PRICING.md)'
WHERE NOT EXISTS (SELECT 1 FROM public.tarifas_traslado);

CREATE OR REPLACE VIEW public.tarifa_traslado_actual WITH (security_invoker = true) AS
SELECT *
FROM public.tarifas_traslado
WHERE vigente_desde <= now()
ORDER BY vigente_desde DESC
LIMIT 1;

-- ============================================================================
-- 3. cotizaciones_arriendo
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cotizaciones_arriendo (
  id serial PRIMARY KEY,
  numero text NOT NULL UNIQUE,
  cliente_id integer REFERENCES public.clientes(id) ON DELETE SET NULL,
  maquinaria_id integer NOT NULL REFERENCES public.maquinarias(id) ON DELETE RESTRICT,
  contrato_id integer,
  cliente_nombre text NOT NULL,
  cliente_email text NOT NULL,
  cliente_telefono text,
  cliente_rut text,
  cliente_empresa text,
  fecha_solicitud timestamptz NOT NULL DEFAULT now(),
  fecha_servicio date NOT NULL,
  ubicacion_servicio text NOT NULL,
  distancia_km numeric(6, 1) NOT NULL DEFAULT 0,
  unidades_solicitadas numeric(4, 1) NOT NULL,
  unidad text NOT NULL CHECK (unidad IN ('hora', 'dia')),
  peajes numeric(10, 0) NOT NULL DEFAULT 0,
  operarios integer NOT NULL DEFAULT 1,
  horas_operario_estimadas numeric(4, 1) NOT NULL DEFAULT 0,
  notas_cliente text,
  precio_uso numeric(10, 0) NOT NULL,
  traslado_combustible numeric(10, 0) NOT NULL DEFAULT 0,
  traslado_carga numeric(10, 0) NOT NULL DEFAULT 0,
  traslado_operario numeric(10, 0) NOT NULL DEFAULT 0,
  subtotal_neto numeric(10, 0) NOT NULL,
  iva numeric(10, 0) NOT NULL,
  total numeric(10, 0) NOT NULL,
  reserva_mantencion numeric(10, 0) NOT NULL DEFAULT 0,
  utilidad_real numeric(10, 0) NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador', 'enviada', 'aceptada', 'rechazada', 'contrato_creado', 'finalizada', 'cancelada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  snapshot_tarifa_neta numeric(10, 0) NOT NULL,
  snapshot_costo_km numeric(8, 0) NOT NULL,
  snapshot_costo_hora_operario numeric(8, 0) NOT NULL,
  snapshot_mantencion_pct numeric(4, 2) NOT NULL,
  snapshot_utilidad_pct numeric(4, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS cot_arriendo_estado_idx ON public.cotizaciones_arriendo (estado);
CREATE INDEX IF NOT EXISTS cot_arriendo_fecha_servicio_idx ON public.cotizaciones_arriendo (fecha_servicio);
CREATE INDEX IF NOT EXISTS cot_arriendo_cliente_email_idx ON public.cotizaciones_arriendo (cliente_email);
CREATE INDEX IF NOT EXISTS cot_arriendo_numero_idx ON public.cotizaciones_arriendo (numero);
CREATE INDEX IF NOT EXISTS cot_arriendo_created_at_idx ON public.cotizaciones_arriendo (created_at DESC);

CREATE OR REPLACE FUNCTION public.cot_arriendo_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cot_arriendo_updated_at_trigger ON public.cotizaciones_arriendo;
CREATE TRIGGER cot_arriendo_updated_at_trigger
  BEFORE UPDATE ON public.cotizaciones_arriendo
  FOR EACH ROW EXECUTE FUNCTION public.cot_arriendo_set_updated_at();

CREATE OR REPLACE FUNCTION public.next_cot_arriendo_numero()
RETURNS text AS $$
DECLARE
  yyyy text;
  next_n integer;
  formatted text;
BEGIN
  yyyy := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(numero FROM 'COT-AR-' || yyyy || '-(\d+)') AS integer)
  ), 0) + 1 INTO next_n
  FROM public.cotizaciones_arriendo
  WHERE numero LIKE 'COT-AR-' || yyyy || '-%';
  formatted := 'COT-AR-' || yyyy || '-' || LPAD(next_n::text, 4, '0');
  RETURN formatted;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.cotizaciones_arriendo ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cotizaciones_arriendo'
    AND policyname = 'cot_arriendo_anon_insert'
  ) THEN
    CREATE POLICY cot_arriendo_anon_insert ON public.cotizaciones_arriendo
      FOR INSERT TO anon, authenticated
      WITH CHECK (estado IN ('borrador', 'enviada'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cotizaciones_arriendo'
    AND policyname = 'cot_arriendo_anon_read_by_email'
  ) THEN
    CREATE POLICY cot_arriendo_anon_read_by_email ON public.cotizaciones_arriendo
      FOR SELECT TO anon
      USING (true);
  END IF;
END $$;

-- ============================================================================
-- 4. bloqueos_maquinaria (availability calendar)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bloqueos_maquinaria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maquinaria_id integer NOT NULL REFERENCES public.maquinarias(id) ON DELETE CASCADE,
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  motivo text NOT NULL DEFAULT 'mantencion',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT bloqueos_fecha_valida CHECK (fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS bloqueos_maquinaria_maquinaria_id_idx
  ON public.bloqueos_maquinaria (maquinaria_id);
CREATE INDEX IF NOT EXISTS bloqueos_maquinaria_fechas_idx
  ON public.bloqueos_maquinaria (maquinaria_id, fecha_inicio, fecha_fin);

ALTER TABLE public.bloqueos_maquinaria ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bloqueos_maquinaria'
    AND policyname = 'bloqueos_anon_read'
  ) THEN
    CREATE POLICY bloqueos_anon_read ON public.bloqueos_maquinaria
      FOR SELECT TO anon
      USING (true);
  END IF;
END $$;

-- ============================================================================
-- 5. verificar_disponibilidad function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.verificar_disponibilidad(
  p_maquinaria_id integer,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE (
  disponible boolean,
  conflictos jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    NOT EXISTS (
      SELECT 1 FROM public.bloqueos_maquinaria b
      WHERE b.maquinaria_id = p_maquinaria_id
        AND b.fecha_inicio <= p_fecha_fin
        AND b.fecha_fin >= p_fecha_inicio
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.cotizaciones_arriendo c
      WHERE c.maquinaria_id = p_maquinaria_id
        AND c.estado IN ('aceptada', 'contrato_creado', 'finalizada')
        AND c.fecha_servicio <= p_fecha_fin
        AND (c.fecha_servicio + (c.unidades_solicitadas * interval '1 day')::interval) >= p_fecha_inicio
    ) AS disponible,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'tipo', 'bloqueo',
          'fecha_inicio', b.fecha_inicio,
          'fecha_fin', b.fecha_fin,
          'motivo', b.motivo
        )
      ) FILTER (WHERE b.id IS NOT NULL),
      '[]'::jsonb
    ) || COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'tipo', 'cotizacion',
          'numero', c.numero,
          'fecha_servicio', c.fecha_servicio,
          'estado', c.estado
        )
      ) FILTER (WHERE c.id IS NOT NULL),
      '[]'::jsonb
    ) AS conflictos
  FROM public.bloqueos_maquinaria b
  FULL OUTER JOIN public.cotizaciones_arriendo c
    ON c.maquinaria_id = p_maquinaria_id
    AND c.estado IN ('aceptada', 'contrato_creado', 'finalizada')
    AND c.fecha_servicio <= p_fecha_fin
    AND (c.fecha_servicio + (c.unidades_solicitadas * interval '1 day')::interval) >= p_fecha_inicio
  WHERE (b.maquinaria_id = p_maquinaria_id
    AND b.fecha_inicio <= p_fecha_fin
    AND b.fecha_fin >= p_fecha_inicio)
    OR (c.maquinaria_id = p_maquinaria_id
    AND c.estado IN ('aceptada', 'contrato_creado', 'finalizada')
    AND c.fecha_servicio <= p_fecha_fin
    AND (c.fecha_servicio + (c.unidades_solicitadas * interval '1 day')::interval) >= p_fecha_inicio)
  LIMIT 1;

  IF NOT FOUND THEN
    disponible := true;
    conflictos := '[]'::jsonb;
    RETURN NEXT;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

COMMIT;
