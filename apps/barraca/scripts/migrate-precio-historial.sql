-- Migration: precio historial for SERNAC Ley 19.496 art. 28 compliance.
-- Justification: art. 28 exige que el "precio anterior" tachado corresponda al
-- precio efectivamente vigente durante los 30 dias previos al inicio de la oferta.
-- Sin tabla historica no hay defensa documental ante auditoria SERNAC.
--
-- Run en Supabase Dashboard > SQL Editor (idempotente).

-- 1. Tabla de historial: cada cambio de precio queda registrado con rango de vigencia.
CREATE TABLE IF NOT EXISTS barraca_precio_historial (
  id BIGSERIAL PRIMARY KEY,
  producto_id INTEGER NOT NULL REFERENCES barraca_productos(id) ON DELETE CASCADE,
  precio INTEGER NOT NULL CHECK (precio > 0),
  vigente_desde TIMESTAMPTZ NOT NULL DEFAULT now(),
  vigente_hasta TIMESTAMPTZ, -- NULL = vigente actualmente
  motivo TEXT,                -- "import", "manual", "promo_set", "promo_remove", etc.
  changed_by TEXT             -- email/id del usuario admin (opcional)
);

-- Solo un precio "vigente" (sin fecha de cierre) por producto a la vez.
-- Index parcial UNIQUE evita registros activos duplicados.
CREATE UNIQUE INDEX IF NOT EXISTS uq_precio_historial_vigente
  ON barraca_precio_historial(producto_id)
  WHERE vigente_hasta IS NULL;

-- Index para queries "que precio tenia el producto X durante los 30 dias previos".
CREATE INDEX IF NOT EXISTS idx_precio_historial_producto_desde
  ON barraca_precio_historial(producto_id, vigente_desde DESC);

-- 2. Trigger: cada UPDATE OF precio en barraca_productos cierra el rango anterior
--    e inserta el nuevo. Esto garantiza historial sin tener que tocar el codigo
--    del backend en cada lugar que actualice precios.
CREATE OR REPLACE FUNCTION barraca_precio_historial_track() RETURNS TRIGGER AS $$
BEGIN
  -- Solo registramos si efectivamente cambio el precio.
  IF NEW.precio IS DISTINCT FROM OLD.precio THEN
    -- Cierra el rango vigente anterior (si existe).
    UPDATE barraca_precio_historial
       SET vigente_hasta = now()
     WHERE producto_id = NEW.id
       AND vigente_hasta IS NULL;
    -- Abre el nuevo rango.
    INSERT INTO barraca_precio_historial (producto_id, precio, vigente_desde, motivo)
    VALUES (NEW.id, NEW.precio, now(),
            CASE WHEN NEW.en_oferta AND NOT OLD.en_oferta THEN 'promo_set'
                 WHEN NOT NEW.en_oferta AND OLD.en_oferta THEN 'promo_remove'
                 ELSE 'price_update' END);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_barraca_precio_historial ON barraca_productos;
CREATE TRIGGER trg_barraca_precio_historial
  AFTER UPDATE OF precio ON barraca_productos
  FOR EACH ROW
  EXECUTE FUNCTION barraca_precio_historial_track();

-- 3. Backfill: registra el precio actual de cada producto como punto de partida
--    (vigente_desde = now(), sin motivo de promo). Solo si el producto no tiene
--    historial aun.
INSERT INTO barraca_precio_historial (producto_id, precio, vigente_desde, motivo)
SELECT p.id, p.precio, now(), 'backfill_initial'
  FROM barraca_productos p
 WHERE p.precio IS NOT NULL
   AND p.precio > 0  -- productos con precio=0 (descontinuados/solo cotizar) no entran al historial
   AND NOT EXISTS (
     SELECT 1 FROM barraca_precio_historial h
      WHERE h.producto_id = p.id
   );

-- 4. RLS: tabla solo accesible por service_role (igual que el resto).
ALTER TABLE barraca_precio_historial ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON barraca_precio_historial FROM anon, authenticated;

-- 5. Helper: funcion que retorna true si el producto tuvo precio_X vigente durante
--    al menos N dias dentro de los ultimos M dias. Util para validar que un
--    "precio_original" corresponde a un precio que efectivamente estuvo vigente.
CREATE OR REPLACE FUNCTION precio_vigente_acumulado_dias(
  p_producto_id INTEGER,
  p_precio INTEGER,
  p_ventana_dias INTEGER DEFAULT 30
) RETURNS INTEGER AS $$
DECLARE
  total_segundos BIGINT := 0;
  ventana_inicio TIMESTAMPTZ := now() - (p_ventana_dias || ' days')::interval;
BEGIN
  SELECT COALESCE(SUM(
    EXTRACT(EPOCH FROM (
      LEAST(COALESCE(vigente_hasta, now()), now())
      - GREATEST(vigente_desde, ventana_inicio)
    ))
  ), 0)::BIGINT INTO total_segundos
  FROM barraca_precio_historial
  WHERE producto_id = p_producto_id
    AND precio = p_precio
    AND COALESCE(vigente_hasta, now()) > ventana_inicio
    AND vigente_desde < now();
  RETURN GREATEST((total_segundos / 86400)::INTEGER, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Verify
SELECT
  (SELECT count(*) FROM barraca_precio_historial) AS total_historial,
  (SELECT count(*) FROM barraca_productos) AS total_productos;
