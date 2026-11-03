-- ============================================================================
-- Migration: panel de rental.jurmaq.cl (máquinas y cotizaciones)
--
-- NO CORRER sin el OK de Jorge. Se aplica en Supabase Dashboard → SQL Editor.
-- Antes de correr, reemplazar los tres valores de la sección 0. Si quedan sin
-- reemplazar, el script se detiene sin cambiar nada. El formato de Jorge es el
-- número solo, sin prefijo ni ceros: prefijo vacío y relleno 0. El último
-- número se confirma con Jorge el día de correrlo, porque él sigue cotizando.
--
-- Todo es aditivo. Sólo se relaja lo necesario en cotizaciones_arriendo: filas
-- existentes, formulario web, /cuenta y el admin de jurmaq.cl siguen iguales.
--
-- Efectos conocidos, por diseño:
--  - El panel sólo usa los estados borrador, enviada, aceptada, rechazada y
--    cancelada: no dispara cot_arriendo_iva_ventas_trigger.
--  - next_cot_arriendo_numero() no se toca: las solicitudes web siguen con
--    COT-AR-AAAA-NNN y no consumen el correlativo de Jorge.
--  - Las cotizaciones del panel no llenan cliente_email ni cliente_id: el correo
--    va en contacto_email. /cuenta busca por cliente_email, así que el cliente
--    no las ve ni las cancela, y no hay que tocar apps/constructora.
--  - maquinaria_id guarda la primera máquina de la cotización. El calendario
--    de disponibilidad mira sólo esa columna y no conoce la unidad 'mes'.
--    El bloqueo real de una obra multi-máquina o mensual lo da el contrato.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. Datos del formato de Jorge
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE _rental_config ON COMMIT DROP AS
SELECT
  '__ULTIMO_NUMERO__'::text AS ultimo,   -- último número ya usado
  '__PREFIJO__'::text       AS prefijo,  -- formato de Jorge: '' (vacío)
  '__RELLENO__'::text       AS relleno;  -- formato de Jorge: 0

DO $$
DECLARE
  c _rental_config%ROWTYPE;
BEGIN
  SELECT * INTO c FROM _rental_config;
  IF c.ultimo !~ '^[0-9]+$' OR c.relleno !~ '^[0-9]+$' OR c.prefijo LIKE '\_\_%' THEN
    RAISE EXCEPTION 'Faltan los datos del formato de Jorge en la sección 0';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 1. maquinarias: fotos, zonas y publicación desde el panel
-- ----------------------------------------------------------------------------
ALTER TABLE public.maquinarias
  ADD COLUMN IF NOT EXISTS imagenes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS foto_referencial boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS precios jsonb,
  ADD COLUMN IF NOT EXISTS publicada boolean NOT NULL DEFAULT true;

-- Valores referenciales por período. Parte de la tarifa actual; lista vacía = "Cotizar".
UPDATE public.maquinarias
SET precios = CASE
  WHEN tarifa_neta IS NULL OR tarifa_neta <= 0 OR unidad_tarifa IS NULL THEN '[]'::jsonb
  ELSE jsonb_build_array(jsonb_build_object(
    'unidad', unidad_tarifa,
    'valor', tarifa_neta,
    'incluye', CASE
      WHEN unidad_tarifa = 'hora' AND minimo_unidades > 1 THEN 'Mínimo ' || trim_scale(minimo_unidades)::text || ' horas'
      ELSE ''
    END
  ))
END
WHERE precios IS NULL;

ALTER TABLE public.maquinarias
  ALTER COLUMN precios SET DEFAULT '[]'::jsonb,
  ALTER COLUMN precios SET NOT NULL;

-- Acentos que faltan en nombres y descripciones de la flota.
UPDATE public.maquinarias SET
  nombre = regexp_replace(nombre, '^Camion\y', 'Camión'),
  descripcion = replace(replace(replace(replace(replace(
    descripcion, 'versatil', 'versátil'), 'multiples', 'múltiples'), 'construccion', 'construcción'),
    'electrico', 'eléctrico'), 'electrica', 'eléctrica');

-- ----------------------------------------------------------------------------
-- 2. cotizaciones_arriendo: cotizaciones hechas a mano desde el panel
-- ----------------------------------------------------------------------------
ALTER TABLE public.cotizaciones_arriendo
  ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'web'
    CHECK (origen IN ('web', 'panel')),
  ADD COLUMN IF NOT EXISTS solicitud_id integer
    REFERENCES public.cotizaciones_arriendo(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fecha_emision date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS validez_dias integer
    CHECK (validez_dias IS NULL OR validez_dias BETWEEN 1 AND 365),
  ADD COLUMN IF NOT EXISTS descuento_neto numeric(12, 0) NOT NULL DEFAULT 0
    CHECK (descuento_neto >= 0),
  ADD COLUMN IF NOT EXISTS enviada_at timestamptz,
  -- Campos del formato de Jorge. Destino: nombre aquí, dirección en ubicacion_servicio.
  ADD COLUMN IF NOT EXISTS cliente_contacto text,
  ADD COLUMN IF NOT EXISTS contacto_email text,
  ADD COLUMN IF NOT EXISTS cliente_direccion text,
  ADD COLUMN IF NOT EXISTS destino_nombre text,
  ADD COLUMN IF NOT EXISTS servicio_detalle text,
  ADD COLUMN IF NOT EXISTS entrega_at timestamp,
  ADD COLUMN IF NOT EXISTS retiro_fecha date;

-- Al cotizar por teléfono no siempre se sabe el correo, la fecha ni el lugar.
ALTER TABLE public.cotizaciones_arriendo
  ALTER COLUMN cliente_email DROP NOT NULL,
  ALTER COLUMN fecha_servicio DROP NOT NULL,
  ALTER COLUMN ubicacion_servicio DROP NOT NULL;

-- Unidades 'semana' y 'mes'. El CHECK original no tiene nombre declarado: se busca por columna.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
    WHERE con.conrelid = 'public.cotizaciones_arriendo'::regclass
      AND con.contype = 'c'
      AND att.attname = 'unidad'
  LOOP
    EXECUTE format('ALTER TABLE public.cotizaciones_arriendo DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.cotizaciones_arriendo
  ADD CONSTRAINT cotizaciones_arriendo_unidad_check
  CHECK (unidad IN ('hora', 'dia', 'semana', 'mes'));

CREATE INDEX IF NOT EXISTS cot_arriendo_origen_idx
  ON public.cotizaciones_arriendo (origen, created_at DESC);
CREATE INDEX IF NOT EXISTS cot_arriendo_cliente_nombre_idx
  ON public.cotizaciones_arriendo (lower(cliente_nombre));
CREATE INDEX IF NOT EXISTS cot_arriendo_solicitud_idx
  ON public.cotizaciones_arriendo (solicitud_id);

-- ----------------------------------------------------------------------------
-- 3. Líneas de la cotización: máquinas y adicionales
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cotizacion_arriendo_lineas (
  id serial PRIMARY KEY,
  cotizacion_id integer NOT NULL
    REFERENCES public.cotizaciones_arriendo(id) ON DELETE CASCADE,
  orden integer NOT NULL DEFAULT 0,
  tipo text NOT NULL
    CHECK (tipo IN ('maquina', 'traslado', 'alojamiento', 'operador', 'otro')),
  maquinaria_id integer REFERENCES public.maquinarias(id) ON DELETE SET NULL,
  descripcion text NOT NULL CHECK (char_length(descripcion) BETWEEN 1 AND 300),
  -- Segunda línea en gris del PDF, ej: el período del arriendo.
  detalle text CHECK (detalle IS NULL OR char_length(detalle) <= 300),
  cantidad numeric(8, 2) NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  unidad text NOT NULL DEFAULT 'global'
    CHECK (unidad IN ('hora', 'dia', 'semana', 'mes', 'viaje', 'noche', 'global')),
  -- Neto, editable: puede ser mayor o menor que la tarifa del catálogo.
  precio_unitario numeric(12, 0) NOT NULL CHECK (precio_unitario >= 0),
  subtotal numeric(14, 0) GENERATED ALWAYS AS (round(cantidad * precio_unitario)) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cot_arriendo_lineas_cotizacion_idx
  ON public.cotizacion_arriendo_lineas (cotizacion_id, orden);
CREATE INDEX IF NOT EXISTS cot_arriendo_lineas_maquinaria_idx
  ON public.cotizacion_arriendo_lineas (maquinaria_id);

-- ----------------------------------------------------------------------------
-- 4. Correlativo de Jorge: atómico, sigue desde su último número
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cotizacion_arriendo_contador (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ultimo integer NOT NULL CHECK (ultimo >= 0),
  prefijo text NOT NULL DEFAULT '',
  relleno smallint NOT NULL DEFAULT 0 CHECK (relleno BETWEEN 0 AND 12),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.cotizacion_arriendo_contador (id, ultimo, prefijo, relleno)
SELECT 1, ultimo::integer, prefijo, relleno::smallint FROM _rental_config
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.next_cot_panel_numero()
RETURNS text
LANGUAGE sql
SET search_path = public, pg_temp
AS $$
  UPDATE public.cotizacion_arriendo_contador
  SET ultimo = ultimo + 1, updated_at = now()
  WHERE id = 1
  RETURNING prefijo || CASE
    WHEN relleno > 0 THEN lpad(ultimo::text, relleno, '0')
    ELSE ultimo::text
  END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Seguridad: sólo service_role, desde los handlers con requirePermission
-- ----------------------------------------------------------------------------
ALTER TABLE public.cotizacion_arriendo_lineas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotizacion_arriendo_contador ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.cotizacion_arriendo_lineas FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.cotizacion_arriendo_contador FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.cotizacion_arriendo_lineas_id_seq FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.next_cot_panel_numero() FROM PUBLIC, anon, authenticated;

GRANT ALL ON public.cotizacion_arriendo_lineas TO service_role;
GRANT ALL ON public.cotizacion_arriendo_contador TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.cotizacion_arriendo_lineas_id_seq TO service_role;
GRANT EXECUTE ON FUNCTION public.next_cot_panel_numero() TO service_role;

-- ----------------------------------------------------------------------------
-- 6. Fotos del panel: bucket público, se sube sólo con service_role
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('rental-fotos', 'rental-fotos', true, 3145728, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Verificación posterior (sólo lectura):
--   SELECT ultimo, prefijo, relleno FROM public.cotizacion_arriendo_contador;
--   SELECT count(*) FROM public.cotizaciones_arriendo WHERE origen = 'web';
-- Por REST con la clave anon, lineas y contador deben dar permission denied.
