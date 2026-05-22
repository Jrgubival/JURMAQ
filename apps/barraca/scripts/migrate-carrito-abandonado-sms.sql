-- migrate-carrito-abandonado-sms.sql
--
-- Tier 4 D7: agrega telefono + tracking de SMS recovery a carritos abandonados.
--
-- El flow de email (1h, 24h, 72h) ya existe. SMS @ 15 min es complementario:
-- alcanza al cliente más rápido que email (mucha gente tiene notif WhatsApp/SMS
-- ON pero email apagado/saturado). Conversion uplift documentado ~5-12% extra
-- en e-commerce ChileBrasil para abandono temprano.
--
-- Aplicar: Supabase Dashboard → SQL Editor (proyecto barraca).

BEGIN;

ALTER TABLE public.barraca_carrito_abandonado
  ADD COLUMN IF NOT EXISTS telefono text,
  ADD COLUMN IF NOT EXISTS sms_recovery_sent_at timestamptz;

-- Índice parcial para que el cron pueda filtrar rápido carritos con
-- telefono pero sin SMS enviado todavía.
CREATE INDEX IF NOT EXISTS barraca_carrito_abandonado_sms_pending_idx
  ON public.barraca_carrito_abandonado (last_activity)
  WHERE telefono IS NOT NULL
    AND sms_recovery_sent_at IS NULL
    AND converted_at IS NULL;

COMMIT;

-- Verificación:
--   SELECT count(*) FILTER (WHERE telefono IS NOT NULL) AS con_telefono,
--          count(*) FILTER (WHERE sms_recovery_sent_at IS NOT NULL) AS sms_enviado
--   FROM barraca_carrito_abandonado;
