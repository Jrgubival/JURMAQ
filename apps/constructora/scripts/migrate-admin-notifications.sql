-- migrate-admin-notifications.sql
--
-- Tier 6 F4: Notificaciones in-app para admin constructora (espejo de barraca).
--
-- Modelo idéntico a barraca: notif globales + lecturas per-user M2M.
-- Mismos kinds disponibles + algunos específicos arriendo:
--   cotizacion_arriendo_nueva, contrato_firmado, klap_renovacion_fallo,
--   mantencion_proxima, cedula_proxima_a_purgar, otp_fail, otro
--
-- Aplicar: Supabase Dashboard → SQL Editor (proyecto constructora).

BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        text NOT NULL,
  title       text NOT NULL,
  body        text,
  link        text,
  severity    text NOT NULL DEFAULT 'info'
              CHECK (severity IN ('info','success','warning','error')),
  ref_type    text,
  ref_id      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_notifications_reads (
  notification_id uuid NOT NULL REFERENCES public.admin_notifications(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL,
  read_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS admin_notifications_created_idx
  ON public.admin_notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_notifications_kind_idx
  ON public.admin_notifications (kind, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_notifications_reads_user_idx
  ON public.admin_notifications_reads (user_id, read_at DESC);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications_reads ENABLE ROW LEVEL SECURITY;

COMMIT;
