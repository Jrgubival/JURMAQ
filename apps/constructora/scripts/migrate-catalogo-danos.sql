-- migrate-catalogo-danos.sql
--
-- Sprint 5: Catálogo de daños estandarizado.
--
-- Hoy el admin tipea monto + descripción manualmente al inspeccionar.
-- Esto da inconsistencia entre admins ("raya en el techo" = $50K vs $150K) y
-- fricción operacional.
--
-- Solución: tabla `catalogo_danos` con (categoria, descripcion, monto_clp,
-- aplicable_a_tipos[]). El admin elige del catálogo en GarantiaPanel y el
-- monto se pre-llena. Puede ajustar si el caso es atípico.
--
-- Aplicar: Supabase Dashboard → SQL Editor.

BEGIN;

CREATE TABLE IF NOT EXISTS public.catalogo_danos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria       text NOT NULL,                       -- 'Carrocería', 'Hidráulica', 'Eléctrico', 'Operativo', etc.
  descripcion     text NOT NULL,
  monto_clp       numeric(12,0) NOT NULL CHECK (monto_clp >= 0),
  aplicable_a_tipos text[],                            -- array de tipo_maquinaria; NULL = todos
  activo          boolean NOT NULL DEFAULT true,
  notas           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS catalogo_danos_categoria_idx ON public.catalogo_danos (categoria);
CREATE INDEX IF NOT EXISTS catalogo_danos_activo_idx ON public.catalogo_danos (activo) WHERE activo = true;

-- Seed con casos comunes en maquinaria pesada (referencia precios 2026 CL).
INSERT INTO public.catalogo_danos (categoria, descripcion, monto_clp, aplicable_a_tipos) VALUES
  -- Carrocería
  ('Carrocería', 'Raya o rayón superficial (≤ 30 cm)',            50000,  NULL),
  ('Carrocería', 'Abolladura menor sin perforación',              120000, NULL),
  ('Carrocería', 'Abolladura mayor o panel a reemplazar',         350000, NULL),
  ('Carrocería', 'Vidrio quebrado (chofer/copiloto)',             180000, NULL),
  ('Carrocería', 'Parabrisas quebrado',                           250000, NULL),
  ('Carrocería', 'Espejo retrovisor roto',                        85000,  NULL),
  ('Carrocería', 'Foco delantero/trasero roto',                   60000,  NULL),
  -- Operativo / consumibles
  ('Operativo', 'Tanque devuelto vacío (combustible)',            45000,  NULL),
  ('Operativo', 'Llave perdida',                                   90000,  NULL),
  ('Operativo', 'Manual / documentos perdidos',                    25000,  NULL),
  ('Operativo', 'Limpieza profunda (interior/exterior)',           35000,  NULL),
  -- Hidráulica
  ('Hidráulica', 'Pérdida de aceite hidráulico',                  220000, ARRAY['retroexcavadora','miniexcavadora','minicargador']),
  ('Hidráulica', 'Manguera hidráulica rota',                       180000, ARRAY['retroexcavadora','miniexcavadora','minicargador']),
  ('Hidráulica', 'Pistón hidráulico dañado',                       550000, ARRAY['retroexcavadora','miniexcavadora','minicargador']),
  -- Mecánica
  ('Mecánica', 'Neumático pinchado/cortado (recambio)',            120000, NULL),
  ('Mecánica', 'Daño en sistema de frenos',                        320000, NULL),
  ('Mecánica', 'Daño en transmisión',                              800000, NULL),
  -- Eléctrico
  ('Eléctrico', 'Batería dañada',                                   95000,  NULL),
  ('Eléctrico', 'Alternador',                                       180000, NULL),
  ('Eléctrico', 'Cableado quemado por mal uso',                    140000, NULL),
  -- Accesorios
  ('Accesorios', 'Cucharón / accesorio reposición',                450000, ARRAY['retroexcavadora','miniexcavadora']),
  ('Accesorios', 'Llanta + neumático completo',                    250000, NULL),
  ('Accesorios', 'Tapa de combustible perdida',                    15000,  NULL),
  ('Accesorios', 'Triángulo / chaleco / extintor faltante',         18000,  NULL)
ON CONFLICT DO NOTHING;

ALTER TABLE public.catalogo_danos ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Verificación:
--   SELECT count(*) FROM catalogo_danos;          -- ≥ 24
--   SELECT DISTINCT categoria FROM catalogo_danos; -- 6 categorías
