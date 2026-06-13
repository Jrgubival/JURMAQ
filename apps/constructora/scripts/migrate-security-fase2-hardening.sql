-- migrate-security-fase2-hardening.sql
--
-- Hardening de la auditoría de seguridad jun-2026 (Fase 2). Aplicar en
-- Supabase Dashboard → SQL Editor.
--
--  L-4: REVOKE INSERT de anon en cotizaciones_arriendo. La app crea las
--       cotizaciones vía service_role (route handler con rate-limit + origin
--       + validación). El grant a anon permitía insertar directo por PostgREST
--       saltándose esos controles (spam). SELECT ya estaba revocado.
--
--  I-1: SET search_path = '' en las 2 funciones SECURITY DEFINER de IVA F29
--       (linter Supabase 0011). Tablas schema-calificadas con public. para que
--       sigan resolviendo con el search_path vacío. No explotable (RLS bloquea
--       escritura de anon/authenticated en esas tablas), es compliance/hardening.

BEGIN;

-- ----------------------------------------------------------------------------
-- L-4
-- ----------------------------------------------------------------------------
REVOKE INSERT ON public.cotizaciones_arriendo FROM anon;

-- ----------------------------------------------------------------------------
-- I-1: cot_arriendo_to_iva_ventas con search_path bloqueado + tablas calificadas
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cot_arriendo_to_iva_ventas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  periodo_actual text;
BEGIN
  IF NEW.estado NOT IN ('contrato_creado', 'finalizada') THEN
    RETURN NEW;
  END IF;
  IF OLD.estado = NEW.estado THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.iva_libro_ventas
    WHERE origen_tipo = 'cotizacion_arriendo'
      AND origen_id = NEW.id
      AND anulado = false
  ) THEN
    RETURN NEW;
  END IF;

  periodo_actual := to_char(now(), 'YYYY-MM');

  INSERT INTO public.iva_libro_ventas (
    periodo, fecha_emision, doc_tipo, doc_nro,
    contraparte_rut, contraparte_nombre, contraparte_email,
    monto_neto, iva, monto_total, origen_tipo, origen_id, notas
  ) VALUES (
    periodo_actual, CURRENT_DATE, 'factura', 'PENDIENTE-' || NEW.numero,
    NEW.cliente_rut, NEW.cliente_nombre, NEW.cliente_email,
    NEW.subtotal_neto, NEW.iva, NEW.total,
    'cotizacion_arriendo', NEW.id,
    'Auto-generado al pasar cotización ' || NEW.numero || ' a estado ' || NEW.estado
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'No se pudo crear entry IVA para cotización %: %', NEW.numero, SQLERRM;
    RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- I-1: combustible_to_iva_compras con search_path bloqueado + tablas calificadas
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.combustible_to_iva_compras()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  periodo_str text;
BEGIN
  IF NEW.estado != 'validada' THEN RETURN NEW; END IF;
  IF OLD.estado = 'validada' THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM public.iva_libro_compras
    WHERE origen_tipo = 'combustible_factura'
      AND origen_id = NEW.id
      AND anulado = false
  ) THEN
    RETURN NEW;
  END IF;

  periodo_str := to_char(NEW.fecha_emision, 'YYYY-MM');

  INSERT INTO public.iva_libro_compras (
    periodo, fecha_emision, doc_tipo, doc_nro,
    proveedor_rut, proveedor_nombre, monto_neto, iva, monto_total,
    categoria, origen_tipo, origen_id, notas
  ) VALUES (
    periodo_str, NEW.fecha_emision, 'factura', NEW.folio,
    COALESCE(NEW.proveedor_rut, 'desconocido'),
    COALESCE(NEW.proveedor_nombre, 'Proveedor combustible'),
    NEW.neto, NEW.iva, NEW.total,
    'combustible', 'combustible_factura', NEW.id,
    'Auto-importado desde combustible_facturas folio ' || NEW.folio
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'No se pudo crear entry IVA para combustible factura %: %', NEW.folio, SQLERRM;
    RETURN NEW;
END;
$$;

COMMIT;

-- Verificación:
--   anon INSERT en cotizaciones_arriendo → permission denied (probar por REST con anon key).
--   SELECT proname, proconfig FROM pg_proc WHERE proname IN
--     ('cot_arriendo_to_iva_ventas','combustible_to_iva_compras');
--   → proconfig debe incluir 'search_path='.
