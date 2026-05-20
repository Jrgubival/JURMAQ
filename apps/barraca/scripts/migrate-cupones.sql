-- migrate-cupones.sql
--
-- Sprint 6: Cupones / códigos de descuento para barraca.
--
-- Hoy las promociones son solo a nivel categoría con % global. Cupones
-- permiten descuentos por código (BIENVENIDO20, NAVIDAD2026, etc.) con
-- reglas más granulares: monto fijo o %, válido hasta, max usos, max uso
-- por usuario.
--
-- Aplicar: Supabase Dashboard → SQL Editor (proyecto barraca).

BEGIN;

CREATE TABLE IF NOT EXISTS public.barraca_cupones (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo              text UNIQUE NOT NULL,            -- BIENVENIDO20, NAVIDAD2026, etc.
  descripcion         text,
  tipo                text NOT NULL CHECK (tipo IN ('porcentaje', 'monto_fijo')),
  valor               numeric(12,2) NOT NULL CHECK (valor > 0),
  monto_minimo_compra numeric(12,0) NOT NULL DEFAULT 0 CHECK (monto_minimo_compra >= 0),
  max_usos_total      integer,                          -- NULL = ilimitado
  max_usos_por_usuario integer NOT NULL DEFAULT 1,
  usos_actuales       integer NOT NULL DEFAULT 0 CHECK (usos_actuales >= 0),
  valido_desde        timestamptz NOT NULL DEFAULT now(),
  valido_hasta        timestamptz,                      -- NULL = sin vencimiento
  activo              boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid,
  CONSTRAINT cupones_codigo_format CHECK (codigo ~ '^[A-Z0-9_-]{3,30}$')
);

CREATE INDEX IF NOT EXISTS barraca_cupones_codigo_idx ON public.barraca_cupones (codigo);
CREATE INDEX IF NOT EXISTS barraca_cupones_activo_idx ON public.barraca_cupones (activo, valido_hasta) WHERE activo = true;

CREATE TABLE IF NOT EXISTS public.barraca_cupones_usos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cupon_id        uuid NOT NULL REFERENCES public.barraca_cupones(id) ON DELETE CASCADE,
  cotizacion_id   integer REFERENCES public.barraca_cotizaciones(id),
  email           text NOT NULL,                        -- email del cliente (para chequear max_usos_por_usuario)
  descuento_aplicado numeric(12,0) NOT NULL,
  monto_compra    numeric(12,0) NOT NULL,
  usado_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cupones_usos_cupon_idx ON public.barraca_cupones_usos (cupon_id);
CREATE INDEX IF NOT EXISTS cupones_usos_email_idx ON public.barraca_cupones_usos (LOWER(email));

-- Cambio en barraca_cotizaciones: tracking del cupón aplicado.
ALTER TABLE public.barraca_cotizaciones
  ADD COLUMN IF NOT EXISTS cupon_id uuid REFERENCES public.barraca_cupones(id),
  ADD COLUMN IF NOT EXISTS cupon_codigo text,
  ADD COLUMN IF NOT EXISTS cupon_descuento numeric(12,0) NOT NULL DEFAULT 0;

-- Seed con 2 cupones de muestra (admin puede desactivarlos).
INSERT INTO public.barraca_cupones (codigo, descripcion, tipo, valor, monto_minimo_compra, max_usos_total, valido_hasta) VALUES
  ('BIENVENIDO10', 'Descuento 10% para nuevos clientes', 'porcentaje', 10, 50000, 1000, now() + interval '1 year'),
  ('JUR10K', 'Descuento $10.000 en compras > $100.000', 'monto_fijo', 10000, 100000, 500, now() + interval '6 months')
ON CONFLICT (codigo) DO NOTHING;

ALTER TABLE public.barraca_cupones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barraca_cupones_usos ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Verificación:
--   SELECT codigo, tipo, valor, activo FROM barraca_cupones;
