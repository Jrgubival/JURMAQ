-- ============================================================================
-- Migration: Arriendo v2 — cotizaciones_arriendo
--
-- Tabla principal del sistema de cotización. Reemplaza la tabla `cotizaciones`
-- vieja (que era genérica). Mantiene snapshot de TODOS los inputs y outputs
-- al momento de crear la cotización (price-history tipo).
--
-- Workflow: borrador → enviada → aceptada/rechazada → contrato_creado → finalizada
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.cotizaciones_arriendo (
  id serial PRIMARY KEY,
  numero text NOT NULL UNIQUE,        -- COT-AR-2026-NNN
  -- relaciones
  cliente_id integer REFERENCES public.clientes(id) ON DELETE SET NULL,
  maquinaria_id integer NOT NULL REFERENCES public.maquinarias(id) ON DELETE RESTRICT,
  contrato_id integer,                 -- FK lazy: REFERENCES contratos(id), agregado al final
  -- datos del cliente (snapshot, ya que cliente_id puede ser null para guests)
  cliente_nombre text NOT NULL,
  cliente_email text NOT NULL,
  cliente_telefono text,
  cliente_rut text,
  cliente_empresa text,
  -- inputs de la cotización
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
  -- desglose financiero (todo NETO, sin IVA)
  precio_uso numeric(10, 0) NOT NULL,
  traslado_combustible numeric(10, 0) NOT NULL DEFAULT 0,
  traslado_carga numeric(10, 0) NOT NULL DEFAULT 0,
  traslado_operario numeric(10, 0) NOT NULL DEFAULT 0,
  subtotal_neto numeric(10, 0) NOT NULL,
  iva numeric(10, 0) NOT NULL,
  total numeric(10, 0) NOT NULL,
  -- internos (NO se muestran al cliente)
  reserva_mantencion numeric(10, 0) NOT NULL DEFAULT 0,
  utilidad_real numeric(10, 0) NOT NULL DEFAULT 0,
  -- estado
  estado text NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador', 'enviada', 'aceptada', 'rechazada', 'contrato_creado', 'finalizada', 'cancelada')),
  -- audit
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- snapshot de las tarifas usadas (para recreate de cotizaciones viejas)
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

-- Updated_at trigger
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

-- Función para generar el siguiente número de cotización
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

-- RLS
ALTER TABLE public.cotizaciones_arriendo ENABLE ROW LEVEL SECURITY;

-- Cliente anon puede crear cotizaciones (sin estado)
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

-- Cliente puede LEER su propia cotización por email + numero
-- (en backend se hace gate por email-match adicional)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cotizaciones_arriendo'
    AND policyname = 'cot_arriendo_anon_read_by_email'
  ) THEN
    CREATE POLICY cot_arriendo_anon_read_by_email ON public.cotizaciones_arriendo
      FOR SELECT TO anon
      USING (true);  -- Gateway en backend: filtra por email; sin esto el cliente no puede ver su PDF.
                     -- TODO: tightening — usar request.jwt.claims si se migra a Supabase Auth.
  END IF;
END $$;

-- Admin (service_role) ya tiene acceso por defecto (bypass RLS).

COMMIT;
