-- ============================================================================
-- Migration: Arriendo v2 — extend maquinarias with pricing fields
--
-- Fase 4.A.1 del PLAN_MAESTRO. Schema base para el sistema de cotización
-- con tarifas reales (ver MAQUINARIAS_PRICING.md).
--
-- Idempotente: usa IF NOT EXISTS.
-- ============================================================================

BEGIN;

-- Tarifa neta (sin IVA), unidad de cobro, mínimo de unidades
ALTER TABLE public.maquinarias
  ADD COLUMN IF NOT EXISTS tarifa_neta numeric(10, 0),
  ADD COLUMN IF NOT EXISTS unidad_tarifa text
    CHECK (unidad_tarifa IS NULL OR unidad_tarifa IN ('hora', 'dia')),
  ADD COLUMN IF NOT EXISTS minimo_unidades numeric(4, 1),
  ADD COLUMN IF NOT EXISTS requiere_traslado boolean DEFAULT true;

-- Seed inicial con tarifas oficiales 2026-05-12 (MAQUINARIAS_PRICING.md)
-- Solo se aplica si la fila ya existe con ese nombre; UPDATE seguro.
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

-- Verificación: mostrar máquinas que quedaron SIN tarifa (admin debe completar)
DO $$
DECLARE
  faltantes integer;
BEGIN
  SELECT COUNT(*) INTO faltantes
  FROM public.maquinarias
  WHERE activo = true AND tarifa_neta IS NULL;

  IF faltantes > 0 THEN
    RAISE NOTICE 'WARNING: % maquinarias activas sin tarifa_neta. Completar manualmente:', faltantes;
    FOR r IN
      SELECT id, nombre FROM public.maquinarias
      WHERE activo = true AND tarifa_neta IS NULL
      ORDER BY id
    LOOP
      RAISE NOTICE '  id=%, nombre=%', r.id, r.nombre;
    END LOOP;
  END IF;
END $$;

COMMIT;
