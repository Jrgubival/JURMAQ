-- ============================================================================
-- Migration: Arriendo v2 — tarifas_traslado (singleton config)
--
-- Tabla single-row con los costos sistémicos de traslado:
--   - $/km (ida + vuelta se calcula en código)
--   - $/hora operario
--   - tiempo fijo de carga/descarga
--   - reservas internas (mantención + utilidad)
--
-- Para cambiar tarifa: insertar nueva row con `vigente_desde > now()` y
-- mantener histórico. El backend usa la más reciente con `vigente_desde <= now()`.
-- ============================================================================

BEGIN;

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

-- RLS: solo service_role lee/escribe. Anon nunca debería ver esto (no es info pública).
ALTER TABLE public.tarifas_traslado ENABLE ROW LEVEL SECURITY;

-- Seed: tarifas oficiales según MAQUINARIAS_PRICING.md
INSERT INTO public.tarifas_traslado
  (costo_km, costo_hora_operario, carga_descarga_horas, reserva_mantencion_pct, reserva_utilidad_pct, notas)
SELECT 300, 5000, 0.5, 0.25, 0.25, 'Seed inicial 2026-05-12 (MAQUINARIAS_PRICING.md)'
WHERE NOT EXISTS (SELECT 1 FROM public.tarifas_traslado);

-- Helper view: tarifa vigente actual
CREATE OR REPLACE VIEW public.tarifa_traslado_actual WITH (security_invoker = true) AS
SELECT *
FROM public.tarifas_traslado
WHERE vigente_desde <= now()
ORDER BY vigente_desde DESC
LIMIT 1;

COMMIT;
