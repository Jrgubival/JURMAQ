-- migrate-admin-emails-log.sql
--
-- Tier 5 ad-hoc: Templates de email manual desde admin arriendo.
--
-- Permite enviar emails predefinidos a clientes desde /admin/cotizaciones-arriendo/[id]
-- u otros detail pages, con tracking de quién mandó qué a quién y cuándo.
--
-- Templates incluidos (kind):
--   follow_up           — "Intentamos contactarnos, dinos más detalles"
--   need_info           — "Necesitamos info adicional para cotizar"
--   quote_reminder      — "¿Tu cotización? Estamos para resolver dudas"
--   reservation_pending — "Falta confirmar reserva (30% inicial)"
--   delivery_schedule   — "Coordinar entrega"
--   return_schedule     — "Coordinar retiro/devolución"
--   thank_you           — "Gracias por elegirnos, dejá tu opinión"
--   custom              — mensaje personalizado dentro del wrapper visual
--
-- Aplicar: Supabase Dashboard → SQL Editor (proyecto constructora).

BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_emails_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind            text NOT NULL CHECK (kind IN (
    'follow_up','need_info','quote_reminder','reservation_pending',
    'delivery_schedule','return_schedule','thank_you','custom'
  )),
  to_email        text NOT NULL,
  to_nombre       text,
  asunto          text NOT NULL,
  custom_message  text,
  -- Vinculación opcional con la cotización/solicitud/contrato origen.
  cotizacion_arriendo_id  integer REFERENCES public.cotizaciones_arriendo(id) ON DELETE SET NULL,
  solicitud_id            integer,
  contrato_id             integer,
  -- Auditoría.
  sent_by_user_id uuid NOT NULL,
  sent_by_email   text,
  sent_at         timestamptz NOT NULL DEFAULT now(),
  -- Resultado del envío (Resend ID + status).
  email_provider_id text,
  email_status      text NOT NULL DEFAULT 'sent'
                    CHECK (email_status IN ('sent','failed','bounced','complained'))
);

CREATE INDEX IF NOT EXISTS admin_emails_log_to_idx
  ON public.admin_emails_log (to_email, sent_at DESC);
CREATE INDEX IF NOT EXISTS admin_emails_log_cotizacion_idx
  ON public.admin_emails_log (cotizacion_arriendo_id)
  WHERE cotizacion_arriendo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS admin_emails_log_sent_by_idx
  ON public.admin_emails_log (sent_by_user_id, sent_at DESC);

COMMIT;

-- Verificación:
--   SELECT kind, COUNT(*) FROM admin_emails_log GROUP BY kind;
