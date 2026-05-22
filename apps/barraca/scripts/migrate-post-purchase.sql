-- migrate-post-purchase.sql
--
-- Tier 4 D6: Post-purchase email automation.
--
-- Agrega columnas de tracking a barraca_cotizaciones para evitar reenvíos
-- duplicados. El cron mira estas columnas + delta de tiempo desde pagada_at.
--
-- Flow:
--   1) Cotización → 'pagada' → envío inmediato thank-you (hook en PUT API)
--      → set purchase_thanks_sent_at = now()
--   2) 7d después + cliente logueado (usuario_id NOT NULL) → review request
--      → set review_request_sent_at = now()
--   3) 60d después + cliente activo → replenishment reminder
--      → set replenishment_sent_at = now()
--
-- Aplicar: Supabase Dashboard → SQL Editor (proyecto barraca).

BEGIN;

ALTER TABLE public.barraca_cotizaciones
  ADD COLUMN IF NOT EXISTS pagada_at                 timestamptz,
  ADD COLUMN IF NOT EXISTS purchase_thanks_sent_at   timestamptz,
  ADD COLUMN IF NOT EXISTS review_request_sent_at    timestamptz,
  ADD COLUMN IF NOT EXISTS replenishment_sent_at     timestamptz;

-- Índice para que el cron pueda filtrar eficientemente las que necesitan
-- envío sin escanear la tabla entera. Solo nos importan cotizaciones
-- pagadas con pagada_at en una ventana relevante.
CREATE INDEX IF NOT EXISTS barraca_cotizaciones_post_purchase_idx
  ON public.barraca_cotizaciones (pagada_at)
  WHERE pagada_at IS NOT NULL;

-- Backfill pagada_at para cotizaciones ya en estado 'pagada' sin timestamp
-- registrado. Usamos created_at como aproximación (no perfecto pero el cron
-- no enviará emails al pasado porque purchase_thanks_sent_at queda NULL y
-- los thresholds son días recientes).
UPDATE public.barraca_cotizaciones
   SET pagada_at = created_at
 WHERE estado = 'pagada'
   AND pagada_at IS NULL;

COMMIT;

-- Verificación:
--   SELECT estado, COUNT(*), COUNT(pagada_at) AS con_timestamp
--   FROM barraca_cotizaciones GROUP BY estado;
