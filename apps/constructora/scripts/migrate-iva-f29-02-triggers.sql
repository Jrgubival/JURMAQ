-- ============================================================================
-- Migration: IVA F29 — Triggers automáticos
--
-- Cada vez que una cotización_arriendo pasa a `contrato_creado` o `finalizada`,
-- automáticamente se inserta una fila en iva_libro_ventas (si no existe).
-- ============================================================================

BEGIN;

-- Trigger: cotización aceptada/finalizada → iva_libro_ventas
CREATE OR REPLACE FUNCTION public.cot_arriendo_to_iva_ventas()
RETURNS TRIGGER AS $$
DECLARE
  periodo_actual text;
BEGIN
  -- Solo dispara cuando transiciona a contrato_creado o finalizada
  IF NEW.estado NOT IN ('contrato_creado', 'finalizada') THEN
    RETURN NEW;
  END IF;
  IF OLD.estado = NEW.estado THEN
    RETURN NEW;
  END IF;

  -- Verifica que NO exista ya entry para esta cotización
  IF EXISTS (
    SELECT 1 FROM iva_libro_ventas
    WHERE origen_tipo = 'cotizacion_arriendo'
      AND origen_id = NEW.id
      AND anulado = false
  ) THEN
    RETURN NEW;
  END IF;

  periodo_actual := to_char(now(), 'YYYY-MM');

  INSERT INTO iva_libro_ventas (
    periodo,
    fecha_emision,
    doc_tipo,
    doc_nro,
    contraparte_rut,
    contraparte_nombre,
    contraparte_email,
    monto_neto,
    iva,
    monto_total,
    origen_tipo,
    origen_id,
    notas
  ) VALUES (
    periodo_actual,
    CURRENT_DATE,
    'factura',
    'PENDIENTE-' || NEW.numero,    -- admin debe completar el nro real de factura
    NEW.cliente_rut,
    NEW.cliente_nombre,
    NEW.cliente_email,
    NEW.subtotal_neto,
    NEW.iva,
    NEW.total,
    'cotizacion_arriendo',
    NEW.id,
    'Auto-generado al pasar cotización ' || NEW.numero || ' a estado ' || NEW.estado
  );

  RAISE NOTICE 'Cotización % → iva_libro_ventas creado (periodo %)', NEW.numero, periodo_actual;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- No bloquear el UPDATE de cotización si falla el insert en IVA
    RAISE WARNING 'No se pudo crear entry IVA para cotización %: %', NEW.numero, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS cot_arriendo_iva_ventas_trigger ON public.cotizaciones_arriendo;
CREATE TRIGGER cot_arriendo_iva_ventas_trigger
  AFTER UPDATE OF estado ON public.cotizaciones_arriendo
  FOR EACH ROW
  WHEN (NEW.estado IN ('contrato_creado', 'finalizada'))
  EXECUTE FUNCTION public.cot_arriendo_to_iva_ventas();

-- ----------------------------------------------------------------------------
-- Trigger: combustible_factura → iva_libro_compras (auto-categoría 'combustible')
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.combustible_to_iva_compras()
RETURNS TRIGGER AS $$
DECLARE
  periodo_str text;
BEGIN
  -- Solo si la factura pasa a estado validada
  IF NEW.estado != 'validada' THEN RETURN NEW; END IF;
  IF OLD.estado = 'validada' THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM iva_libro_compras
    WHERE origen_tipo = 'combustible_factura'
      AND origen_id = NEW.id
      AND anulado = false
  ) THEN
    RETURN NEW;
  END IF;

  periodo_str := to_char(NEW.fecha_emision, 'YYYY-MM');

  INSERT INTO iva_libro_compras (
    periodo,
    fecha_emision,
    doc_tipo,
    doc_nro,
    proveedor_rut,
    proveedor_nombre,
    monto_neto,
    iva,
    monto_total,
    categoria,
    origen_tipo,
    origen_id,
    notas
  ) VALUES (
    periodo_str,
    NEW.fecha_emision,
    'factura',
    NEW.folio,
    COALESCE(NEW.proveedor_rut, 'desconocido'),
    COALESCE(NEW.proveedor_nombre, 'Proveedor combustible'),
    NEW.neto,
    NEW.iva,
    NEW.total,
    'combustible',
    'combustible_factura',
    NEW.id,
    'Auto-importado desde combustible_facturas folio ' || NEW.folio
  );

  RAISE NOTICE 'Combustible factura % → iva_libro_compras', NEW.folio;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'No se pudo crear entry IVA para combustible factura %: %', NEW.folio, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Solo crear trigger si combustible_facturas existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'combustible_facturas'
  ) THEN
    DROP TRIGGER IF EXISTS combustible_iva_compras_trigger ON public.combustible_facturas;
    EXECUTE 'CREATE TRIGGER combustible_iva_compras_trigger
      AFTER UPDATE OF estado ON public.combustible_facturas
      FOR EACH ROW
      WHEN (NEW.estado = ''validada'')
      EXECUTE FUNCTION public.combustible_to_iva_compras()';
    RAISE NOTICE 'Trigger combustible_iva_compras_trigger creado';
  ELSE
    RAISE NOTICE 'Tabla combustible_facturas no existe — trigger NO creado (no aplica)';
  END IF;
END $$;

COMMIT;
