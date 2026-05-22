-- migrate-maquinarias-mantenciones.sql
--
-- Tier 5 E2: Historial de mantenciones por máquina.
--
-- Cada vez que una máquina entra a taller (preventiva programada, falla,
-- inspección), registramos:
--   - tipo + descripción del trabajo
--   - costo (insumo para Tier 5 E4 reporte de rentabilidad)
--   - fecha + horómetro/kilómetros al momento
--   - proveedor (taller que la hizo)
--   - URL factura (opcional, ya tenemos bucket en Storage)
--   - próxima mantención programada (alerta cuando se acerca)
--
-- Aplicar: Supabase Dashboard → SQL Editor (proyecto constructora).

BEGIN;

CREATE TABLE IF NOT EXISTS public.maquinaria_mantenciones (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maquinaria_id       integer NOT NULL REFERENCES public.maquinarias(id) ON DELETE CASCADE,
  -- Tipo de mantención (estándar industria arriendo maquinaria).
  tipo                text NOT NULL CHECK (tipo IN (
    'preventiva',         -- Pauta horómetro/km
    'correctiva',         -- Reparación de falla
    'inspeccion',         -- Revisión técnica / DT
    'cambio_aceite',      -- Aceite motor/hidráulico
    'cambio_filtro',      -- Filtros varios
    'neumaticos',         -- Cambio/reparación rueda
    'pintura_reparacion', -- Cosmético
    'otro'
  )),
  descripcion         text NOT NULL,
  fecha               date NOT NULL DEFAULT CURRENT_DATE,
  /** Costo en CLP (sin IVA). Si la factura tiene IVA, registrar el neto. */
  costo               numeric(10,0) NOT NULL DEFAULT 0 CHECK (costo >= 0),
  /** Lectura del horómetro o km al momento (para pauta). */
  horometro_km        numeric(10,2),
  /** Taller / proveedor que ejecutó. */
  proveedor           text,
  /** URL de la factura subida a Supabase Storage. */
  factura_url         text,
  /** Si esta mantención agendó la próxima, registrar la fecha objetivo. */
  proxima_mantencion_at date,
  notas               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid
);

CREATE INDEX IF NOT EXISTS maquinaria_mantenciones_maq_fecha_idx
  ON public.maquinaria_mantenciones (maquinaria_id, fecha DESC);
CREATE INDEX IF NOT EXISTS maquinaria_mantenciones_proxima_idx
  ON public.maquinaria_mantenciones (proxima_mantencion_at)
  WHERE proxima_mantencion_at IS NOT NULL;

-- ============================================================================
-- Vista: próxima mantención por máquina (la fecha más cercana en futuro)
-- ============================================================================
-- Útil para mostrar alertas en /admin/maquinarias listando "alerta: revisión
-- programada para X" sin tener que escanear toda la tabla en cada render.
DROP VIEW IF EXISTS public.maquinarias_proxima_mantencion;
CREATE VIEW public.maquinarias_proxima_mantencion
  WITH (security_invoker = true) AS
SELECT
  maquinaria_id,
  MIN(proxima_mantencion_at) FILTER (
    WHERE proxima_mantencion_at >= CURRENT_DATE
  ) AS proxima_at,
  (MIN(proxima_mantencion_at) FILTER (
    WHERE proxima_mantencion_at >= CURRENT_DATE
  ) - CURRENT_DATE) AS dias_restantes
FROM public.maquinaria_mantenciones
WHERE proxima_mantencion_at IS NOT NULL
GROUP BY maquinaria_id;

-- ============================================================================
-- RLS — solo lectura/escritura desde admin con service_role (sin políticas anon).
-- ============================================================================
ALTER TABLE public.maquinaria_mantenciones ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Verificación:
--   SELECT m.nombre, mp.proxima_at, mp.dias_restantes
--   FROM maquinarias m
--   LEFT JOIN maquinarias_proxima_mantencion mp ON mp.maquinaria_id = m.id
--   ORDER BY mp.dias_restantes NULLS LAST;
