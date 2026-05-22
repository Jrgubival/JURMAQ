-- migrate-admin-notifications.sql
--
-- Tier 6 F4: Notificaciones in-app para el admin barraca.
--
-- Modelo: cada notificación es global (todos los admins la ven) o
-- dirigida a un user específico (cuando aplique).
-- Persistente con flag read_at por usuario — para "global", la lectura
-- se guarda en admin_notifications_reads (link many-to-many user↔notif).
--
-- Tipos típicos (kind):
--   review_pendiente, comision_devengada, cotizacion_nueva,
--   carrito_abandonado_conv, mantencion_proxima, stock_bajo, otro
--
-- Aplicar: Supabase Dashboard → SQL Editor (proyecto barraca).

BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        text NOT NULL,
  title       text NOT NULL,
  body        text,
  -- Link interno donde dirige el click (e.g. /admin/reviews?estado=pendiente).
  link        text,
  -- Color de la categoría para el frontend (info|success|warning|error).
  severity    text NOT NULL DEFAULT 'info'
              CHECK (severity IN ('info','success','warning','error')),
  -- Si el evento aplica a un objeto concreto, lo referenciamos por tipo+id
  -- libre (e.g. ref_type='review', ref_id=<uuid>) para que el frontend
  -- pueda hacer dedup o renderizar info adicional.
  ref_type    text,
  ref_id      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Lecturas por usuario (many-to-many). Una notif "global" se considera
-- leída por user X cuando hay row aquí con (notification_id, user_id).
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

-- Verificación:
--   SELECT kind, count(*) FROM admin_notifications GROUP BY kind;
--   SELECT n.* FROM admin_notifications n
--     LEFT JOIN admin_notifications_reads r
--       ON r.notification_id = n.id AND r.user_id = '<your-uuid>'
--     WHERE r.read_at IS NULL
--     ORDER BY n.created_at DESC LIMIT 20;
