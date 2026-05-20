-- migrate-maestros-referidos.sql
--
-- Tier 2 B1: Programa de Referidos para Maestros (SOLO barraca).
--
-- Reemplaza el concepto original de "Club Maestro" (tier de descuento) por
-- un modelo de afiliados:
--   - Maestro registrado tiene código MAE-YYYY-NNN
--   - Cliente compra en barraca + ingresa código en checkout
--   - JURMAQ paga 1% (configurable) del neto al maestro como comisión
--   - Estados: pendiente → devengada (al pagar venta) → pagada → anulada (si venta cancelada)
--
-- Aplicar: Supabase Dashboard → SQL Editor (proyecto barraca).

BEGIN;

-- ============================================================================
-- 1. Tabla maestros
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.maestros (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo              text UNIQUE NOT NULL,
  nombre              text NOT NULL,
  rut                 text NOT NULL,
  email               text,
  telefono            text,
  banco               text,
  tipo_cuenta         text CHECK (tipo_cuenta IS NULL OR tipo_cuenta IN ('cuenta_corriente','cuenta_vista','cuenta_ahorro')),
  numero_cuenta       text,
  porcentaje_comision numeric(5,2) NOT NULL DEFAULT 1.00 CHECK (porcentaje_comision >= 0 AND porcentaje_comision <= 100),
  activo              boolean NOT NULL DEFAULT true,
  notas               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid,
  CONSTRAINT maestros_codigo_format CHECK (codigo ~ '^MAE-[0-9]{4}-[0-9]+$')
);

CREATE INDEX IF NOT EXISTS maestros_codigo_idx ON public.maestros (codigo);
CREATE INDEX IF NOT EXISTS maestros_activo_idx ON public.maestros (activo) WHERE activo = true;
CREATE INDEX IF NOT EXISTS maestros_rut_idx ON public.maestros (rut);

-- ============================================================================
-- 2. Tabla comisiones_maestro
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.comisiones_maestro (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maestro_id          uuid NOT NULL REFERENCES public.maestros(id) ON DELETE RESTRICT,
  origen_tipo         text NOT NULL CHECK (origen_tipo IN ('barraca_cotizacion','barraca_venta')),
  origen_id           text NOT NULL,
  monto_venta_neto    numeric(12,0) NOT NULL CHECK (monto_venta_neto >= 0),
  porcentaje          numeric(5,2) NOT NULL CHECK (porcentaje >= 0 AND porcentaje <= 100),
  monto_comision      numeric(12,0) NOT NULL CHECK (monto_comision >= 0),
  estado              text NOT NULL DEFAULT 'pendiente'
                      CHECK (estado IN ('pendiente','devengada','pagada','anulada')),
  devengada_at        timestamptz,
  pagada_at           timestamptz,
  pagada_by           uuid,
  pago_referencia     text,
  notas               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comisiones_origen_unique UNIQUE (origen_tipo, origen_id)
);

CREATE INDEX IF NOT EXISTS comisiones_maestro_idx ON public.comisiones_maestro (maestro_id, estado);
CREATE INDEX IF NOT EXISTS comisiones_estado_idx ON public.comisiones_maestro (estado, devengada_at);

-- ============================================================================
-- 3. Columnas referidos en barraca_cotizaciones
-- ============================================================================
ALTER TABLE public.barraca_cotizaciones
  ADD COLUMN IF NOT EXISTS codigo_maestro text,
  ADD COLUMN IF NOT EXISTS maestro_id uuid REFERENCES public.maestros(id);

CREATE INDEX IF NOT EXISTS barraca_cotizaciones_maestro_idx
  ON public.barraca_cotizaciones (maestro_id)
  WHERE maestro_id IS NOT NULL;

-- ============================================================================
-- 4. Trigger: devengar comisión cuando cotización pasa a 'pagada'
--    + rollback (anular) cuando pasa a 'anulada' o 'cancelada'
-- ============================================================================
CREATE OR REPLACE FUNCTION public.devengar_comision_barraca() RETURNS trigger AS $$
BEGIN
  -- Devengo: cotización recién pagada con maestro asignado.
  IF NEW.estado = 'pagada' AND (OLD.estado IS NULL OR OLD.estado != 'pagada')
     AND NEW.maestro_id IS NOT NULL THEN
    INSERT INTO public.comisiones_maestro (
      maestro_id, origen_tipo, origen_id,
      monto_venta_neto, porcentaje, monto_comision,
      estado, devengada_at
    )
    SELECT
      NEW.maestro_id,
      'barraca_cotizacion',
      NEW.id::text,
      ROUND(NEW.total / 1.19),               -- neto (sin IVA)
      m.porcentaje_comision,
      ROUND(NEW.total / 1.19 * m.porcentaje_comision / 100),
      'devengada',
      now()
    FROM public.maestros m
    WHERE m.id = NEW.maestro_id
    ON CONFLICT (origen_tipo, origen_id) DO UPDATE
      SET estado = 'devengada', devengada_at = now();
  END IF;

  -- Rollback: cotización anulada/cancelada → comisión anulada.
  IF NEW.estado IN ('anulada','cancelada')
     AND (OLD.estado IS NULL OR OLD.estado NOT IN ('anulada','cancelada')) THEN
    UPDATE public.comisiones_maestro
       SET estado = 'anulada',
           notas = COALESCE(notas,'') || ' [auto-anulada: ' || NEW.estado || ']'
     WHERE origen_tipo = 'barraca_cotizacion'
       AND origen_id = NEW.id::text
       AND estado IN ('pendiente','devengada');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_devengar_comision_barraca ON public.barraca_cotizaciones;
CREATE TRIGGER trg_devengar_comision_barraca
  AFTER UPDATE ON public.barraca_cotizaciones
  FOR EACH ROW EXECUTE FUNCTION public.devengar_comision_barraca();

-- ============================================================================
-- 5. RPC para generar próximo código MAE-YYYY-NNN (numeración por año)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.next_maestro_codigo()
RETURNS text AS $$
DECLARE
  v_anio text := to_char(now(), 'YYYY');
  v_max integer;
  v_codigo text;
BEGIN
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(codigo, '-', 3) AS integer)
  ), 0)
  INTO v_max
  FROM public.maestros
  WHERE codigo LIKE 'MAE-' || v_anio || '-%';

  v_codigo := 'MAE-' || v_anio || '-' || LPAD((v_max + 1)::text, 3, '0');
  RETURN v_codigo;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. RLS
-- ============================================================================
ALTER TABLE public.maestros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comisiones_maestro ENABLE ROW LEVEL SECURITY;

-- Anon puede leer maestros activos (para validar código en checkout + stats pública).
-- NUNCA expone datos bancarios (filtrado por SELECT en endpoint).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'maestros'
      AND policyname = 'maestros_anon_validar'
  ) THEN
    CREATE POLICY maestros_anon_validar
      ON public.maestros FOR SELECT TO anon
      USING (activo = true);
  END IF;
END $$;

COMMIT;

-- Verificación:
--   SELECT next_maestro_codigo();      -- 'MAE-2026-001'
--   SELECT count(*) FROM maestros;     -- 0 inicial
