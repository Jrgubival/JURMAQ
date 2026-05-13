-- ============================================================================
-- Migration: IVA F29 — Libros de ventas y compras
--
-- Fase 5 del PLAN_MAESTRO. Schema para tracking IVA débito (ventas) e IVA
-- crédito (compras), con export Excel mensual para Formulario 29 SII.
--
-- Idempotente.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- iva_libro_ventas: cada venta con factura genera 1 fila
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.iva_libro_ventas (
  id serial PRIMARY KEY,
  periodo text NOT NULL,                       -- YYYY-MM
  fecha_emision date NOT NULL,
  -- documento
  doc_tipo text NOT NULL CHECK (doc_tipo IN ('factura', 'boleta', 'nota_credito', 'nota_debito')),
  doc_nro text NOT NULL,
  -- contraparte
  contraparte_rut text,
  contraparte_nombre text NOT NULL,
  contraparte_email text,
  -- montos (todo CLP)
  monto_neto numeric(12, 0) NOT NULL,
  iva numeric(12, 0) NOT NULL,                 -- 19% del neto, o 0 si es exento
  monto_total numeric(12, 0) NOT NULL,         -- neto + iva
  exento boolean NOT NULL DEFAULT false,
  -- relación opcional al origen (cotización, contrato, factura combustible, etc.)
  origen_tipo text,                            -- 'cotizacion_arriendo', 'contrato', 'combustible', 'manual'
  origen_id integer,
  notas text,
  -- audit
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- anulación (no se borra, solo se marca)
  anulado boolean NOT NULL DEFAULT false,
  anulado_at timestamptz,
  anulado_motivo text
);

CREATE INDEX IF NOT EXISTS iva_ventas_periodo_idx ON public.iva_libro_ventas (periodo);
CREATE INDEX IF NOT EXISTS iva_ventas_fecha_idx ON public.iva_libro_ventas (fecha_emision DESC);
CREATE INDEX IF NOT EXISTS iva_ventas_origen_idx ON public.iva_libro_ventas (origen_tipo, origen_id);
CREATE UNIQUE INDEX IF NOT EXISTS iva_ventas_doc_unique_idx
  ON public.iva_libro_ventas (doc_tipo, doc_nro) WHERE anulado = false;

-- ---------------------------------------------------------------------------
-- iva_libro_compras: cada factura de compra genera 1 fila
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.iva_libro_compras (
  id serial PRIMARY KEY,
  periodo text NOT NULL,
  fecha_emision date NOT NULL,
  -- documento
  doc_tipo text NOT NULL CHECK (doc_tipo IN ('factura', 'factura_compra', 'nota_credito', 'nota_debito')),
  doc_nro text NOT NULL,
  -- proveedor
  proveedor_rut text NOT NULL,
  proveedor_nombre text NOT NULL,
  -- montos
  monto_neto numeric(12, 0) NOT NULL,
  iva numeric(12, 0) NOT NULL,
  monto_total numeric(12, 0) NOT NULL,
  exento boolean NOT NULL DEFAULT false,
  -- categoría (para mejor análisis P&L)
  categoria text,                              -- 'combustible', 'mantencion', 'repuestos', 'insumos', 'servicios', 'otros'
  -- relación opcional
  origen_tipo text,                            -- 'combustible_factura', 'manual'
  origen_id integer,
  notas text,
  -- archivo escaneado de la factura (PDF en Supabase Storage)
  archivo_url text,
  -- audit
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- anulación
  anulado boolean NOT NULL DEFAULT false,
  anulado_at timestamptz,
  anulado_motivo text
);

CREATE INDEX IF NOT EXISTS iva_compras_periodo_idx ON public.iva_libro_compras (periodo);
CREATE INDEX IF NOT EXISTS iva_compras_fecha_idx ON public.iva_libro_compras (fecha_emision DESC);
CREATE INDEX IF NOT EXISTS iva_compras_proveedor_rut_idx ON public.iva_libro_compras (proveedor_rut);
CREATE INDEX IF NOT EXISTS iva_compras_categoria_idx ON public.iva_libro_compras (categoria);
CREATE UNIQUE INDEX IF NOT EXISTS iva_compras_doc_unique_idx
  ON public.iva_libro_compras (proveedor_rut, doc_tipo, doc_nro) WHERE anulado = false;

-- ---------------------------------------------------------------------------
-- View: resumen IVA mensual
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.iva_resumen_mensual WITH (security_invoker = true) AS
SELECT
  periodo,
  -- Ventas
  (SELECT COUNT(*) FROM iva_libro_ventas v
   WHERE v.periodo = p.periodo AND v.anulado = false) AS ventas_count,
  (SELECT COALESCE(SUM(monto_neto), 0) FROM iva_libro_ventas v
   WHERE v.periodo = p.periodo AND v.anulado = false) AS ventas_neto,
  (SELECT COALESCE(SUM(iva), 0) FROM iva_libro_ventas v
   WHERE v.periodo = p.periodo AND v.anulado = false) AS iva_debito,
  -- Compras
  (SELECT COUNT(*) FROM iva_libro_compras c
   WHERE c.periodo = p.periodo AND c.anulado = false) AS compras_count,
  (SELECT COALESCE(SUM(monto_neto), 0) FROM iva_libro_compras c
   WHERE c.periodo = p.periodo AND c.anulado = false) AS compras_neto,
  (SELECT COALESCE(SUM(iva), 0) FROM iva_libro_compras c
   WHERE c.periodo = p.periodo AND c.anulado = false) AS iva_credito,
  -- F29 a pagar
  (SELECT COALESCE(SUM(iva), 0) FROM iva_libro_ventas v
   WHERE v.periodo = p.periodo AND v.anulado = false)
  -
  (SELECT COALESCE(SUM(iva), 0) FROM iva_libro_compras c
   WHERE c.periodo = p.periodo AND c.anulado = false)
  AS f29_a_pagar
FROM (
  SELECT DISTINCT periodo FROM iva_libro_ventas WHERE anulado = false
  UNION
  SELECT DISTINCT periodo FROM iva_libro_compras WHERE anulado = false
) p
ORDER BY periodo DESC;

-- RLS: solo admin (service_role) ve estos libros
ALTER TABLE public.iva_libro_ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iva_libro_compras ENABLE ROW LEVEL SECURITY;

COMMIT;
