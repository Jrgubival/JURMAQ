-- migrate-otp.sql
--
-- Sprint 2: OTP unificado multi-canal (WhatsApp / SMS / Email).
--
-- Hoy el OTP del flujo de firma usa contratos_otp (acoplado a contratos).
-- Esto no escala: vamos a necesitar OTP también para
--   - SCA del flujo de garantía Klap (PARTE 1)
--   - reset de contraseña en portal /cuenta (PARTE 3)
--   - cambio de tarjeta guardada (PARTE 1)
--   - 2FA opcional en login (futuro)
--
-- Nuevo modelo:
--   otp_codigos  — código activo con TTL 5 min, hash bcrypt del código
--   otp_eventos  — audit log (sent / verified / failed / rate_limited)
--
-- contratos_otp se mantiene por compatibilidad pero la nueva firma del
-- contrato va a guardar el OTP en otp_codigos con contexto='firma_contrato'
-- y contexto_id=token o contrato_id.
--
-- Aplicar: Supabase Dashboard → SQL Editor.

BEGIN;

CREATE TABLE IF NOT EXISTS public.otp_codigos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destino       text NOT NULL,                              -- email o telefono normalizado +56...
  codigo_hash   text NOT NULL,                              -- bcrypt del código (NUNCA el código en plano)
  contexto      text NOT NULL CHECK (contexto IN (
                  'firma_contrato',
                  'garantia_klap',
                  'tarjeta_cambio',
                  'reset_password',
                  'login_2fa',
                  'verificacion_email'
                )),
  contexto_id   text,                                       -- id del recurso relacionado (contrato_id, cliente_id, etc.)
  canal_usado   text NOT NULL CHECK (canal_usado IN ('whatsapp','sms','email')),
  provider      text NOT NULL CHECK (provider IN ('openwa','cloud_api','twilio','wati','sms_twilio','email_resend','manual')),
  intentos      integer NOT NULL DEFAULT 0,
  max_intentos  integer NOT NULL DEFAULT 3,
  expira_at     timestamptz NOT NULL,
  verificado_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT otp_codigos_intentos_no_negativos CHECK (intentos >= 0)
);

-- Lookup rápido al verificar: por destino + contexto + sólo no expirados.
CREATE INDEX IF NOT EXISTS otp_codigos_destino_contexto_idx
  ON public.otp_codigos (destino, contexto, expira_at DESC)
  WHERE verificado_at IS NULL;

-- Limpieza periódica: códigos > 24h pueden ser purgados (cron futuro).
CREATE INDEX IF NOT EXISTS otp_codigos_expira_idx
  ON public.otp_codigos (expira_at);

-- Audit log
CREATE TABLE IF NOT EXISTS public.otp_eventos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  otp_id      uuid REFERENCES public.otp_codigos(id) ON DELETE SET NULL,
  evento      text NOT NULL CHECK (evento IN (
                'sent','verified','failed','expired','rate_limited','fallback_invoked'
              )),
  canal       text NOT NULL CHECK (canal IN ('whatsapp','sms','email')),
  provider    text NOT NULL,
  destino     text NOT NULL,                                -- duplicado (a propósito) para que el evento sobreviva si otp_id se borra
  contexto    text,
  ip          text,
  user_agent  text,
  raw_response jsonb,                                       -- respuesta del provider (debug)
  error_msg   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS otp_eventos_created_idx ON public.otp_eventos (created_at DESC);
CREATE INDEX IF NOT EXISTS otp_eventos_destino_idx ON public.otp_eventos (destino, created_at DESC);
CREATE INDEX IF NOT EXISTS otp_eventos_provider_idx ON public.otp_eventos (provider, evento);

-- RLS: service_role only. Los endpoints validan con custom token / session.
ALTER TABLE public.otp_codigos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_eventos ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Verificación post-aplicación:
--   SELECT count(*) FROM otp_codigos;   -- 0
--   SELECT count(*) FROM otp_eventos;   -- 0
--   \d otp_codigos                       -- debe mostrar las columnas + indices
