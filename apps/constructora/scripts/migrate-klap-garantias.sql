-- migrate-klap-garantias.sql
--
-- Sprint 4 — Sistema de Garantías Digitales con Klap.
--
-- Reemplaza cheques/depósitos físicos por pre-autorización (hold) en
-- tarjeta de crédito vía Klap, con captura parcial al detectar daños y
-- cargos off-session hasta 90 días post-devolución.
--
-- Cinco métodos de garantía soportados (columna garantia_metodo en contratos):
--   klap_hold (default) | cheque | deposito_efectivo | transferencia | pagare
-- Solo klap_hold dispara el flow digital; los otros usan trackeo manual en
-- garantias_tradicionales.
--
-- Aplicar: Supabase Dashboard → SQL Editor.
-- Compatible con: tarjeta de crédito guardada (network_token PCI-compliant).
-- NO almacenamos: PAN completo, CVV, ni cryptogram raw.

BEGIN;

-- ============================================================================
-- 1. Tarjetas guardadas (network tokens)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.klap_cards (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id          integer NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  network_token       text NOT NULL,
  token_requestor_id  text NOT NULL,
  card_brand          text NOT NULL CHECK (card_brand IN ('VISA','MASTERCARD','AMEX')),
  card_last4          text NOT NULL CHECK (card_last4 ~ '^[0-9]{4}$'),
  card_exp_month      smallint NOT NULL CHECK (card_exp_month BETWEEN 1 AND 12),
  card_exp_year       smallint NOT NULL CHECK (card_exp_year BETWEEN 2024 AND 2099),
  is_default          boolean NOT NULL DEFAULT true,
  activa              boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_via         text NOT NULL DEFAULT 'portal'
                      CHECK (created_via IN ('portal','admin','webhook')),
  CONSTRAINT klap_cards_unique_token UNIQUE (cliente_id, network_token)
);

CREATE INDEX IF NOT EXISTS klap_cards_cliente_idx ON public.klap_cards (cliente_id);
CREATE INDEX IF NOT EXISTS klap_cards_activa_idx  ON public.klap_cards (cliente_id) WHERE activa = true;

COMMENT ON TABLE public.klap_cards IS 'Tarjetas guardadas como network token PCI-compliant (NO PAN, NO CVV).';

-- ============================================================================
-- 2. Holds (pre-autorizaciones) por contrato
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.klap_holds (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id           integer NOT NULL REFERENCES public.contratos(id) ON DELETE RESTRICT,
  klap_card_id          uuid NOT NULL REFERENCES public.klap_cards(id) ON DELETE RESTRICT,
  hold_actual_id        text NOT NULL,
  hold_inicial_id       text NOT NULL,
  monto                 numeric(12,0) NOT NULL CHECK (monto > 0),
  moneda                text NOT NULL DEFAULT 'CLP',
  estado                text NOT NULL CHECK (estado IN
                          ('active','renewed','captured','partial_captured',
                           'cancelled','renewal_failed','renewal_failed_terminal','expired')),
  autorizado_at         timestamptz NOT NULL,
  expira_at             timestamptz NOT NULL,
  renovaciones_count    integer NOT NULL DEFAULT 0,
  renovacion_proxima_at timestamptz NOT NULL,
  capturado_monto       numeric(12,0),
  capturado_at          timestamptz,
  cancelado_at          timestamptz,
  cancelado_motivo      text,
  notas                 text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Solo un hold ACTIVO por contrato. Otros estados (cancelled, expired, etc.)
-- pueden coexistir en histórico. La constraint la implementamos con un
-- partial unique index (mejor que DEFERRABLE para concurrencia).
CREATE UNIQUE INDEX IF NOT EXISTS klap_holds_one_active_per_contrato
  ON public.klap_holds (contrato_id)
  WHERE estado IN ('active', 'renewed');

CREATE INDEX IF NOT EXISTS klap_holds_renovacion_idx
  ON public.klap_holds (renovacion_proxima_at)
  WHERE estado = 'active';
CREATE INDEX IF NOT EXISTS klap_holds_contrato_idx ON public.klap_holds (contrato_id);
CREATE INDEX IF NOT EXISTS klap_holds_estado_idx   ON public.klap_holds (estado);

-- ============================================================================
-- 3. Captures (cobros parciales por daños)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.klap_captures (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hold_id                 uuid NOT NULL REFERENCES public.klap_holds(id),
  contrato_id             integer NOT NULL REFERENCES public.contratos(id),
  monto                   numeric(12,0) NOT NULL CHECK (monto > 0),
  klap_capture_id         text NOT NULL UNIQUE,
  klap_authorization_code text,
  motivo                  text NOT NULL,
  evidencia_fotos         jsonb,
  capturado_at            timestamptz NOT NULL DEFAULT now(),
  capturado_by            uuid REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS klap_captures_contrato_idx ON public.klap_captures (contrato_id);

-- ============================================================================
-- 4. Off-session charges (cobros tardíos, hasta 90 días post-devolución)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.klap_offsession_charges (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  klap_card_id    uuid NOT NULL REFERENCES public.klap_cards(id),
  contrato_id     integer NOT NULL REFERENCES public.contratos(id),
  monto           numeric(12,0) NOT NULL CHECK (monto > 0),
  klap_charge_id  text NOT NULL UNIQUE,
  estado          text NOT NULL CHECK (estado IN ('approved','declined','refunded')),
  motivo          text NOT NULL,
  evidencia_fotos jsonb,
  cobrado_at      timestamptz NOT NULL DEFAULT now(),
  cobrado_by      uuid REFERENCES public.users(id),
  decline_reason  text
);

CREATE INDEX IF NOT EXISTS klap_offsession_contrato_idx ON public.klap_offsession_charges (contrato_id);

-- ============================================================================
-- 5. Audit log Klap (todas las acciones admin + sistema + webhook)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.klap_eventos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_tipo         text NOT NULL,
  contrato_id         integer REFERENCES public.contratos(id),
  hold_id             uuid REFERENCES public.klap_holds(id),
  klap_transaction_id text,
  request_id          text,
  raw_response        jsonb,
  origen              text NOT NULL CHECK (origen IN ('api','webhook','cron','admin','mock')),
  triggered_by        uuid REFERENCES public.users(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS klap_eventos_contrato_idx ON public.klap_eventos (contrato_id);
CREATE INDEX IF NOT EXISTS klap_eventos_tipo_idx     ON public.klap_eventos (evento_tipo);
CREATE INDEX IF NOT EXISTS klap_eventos_created_idx  ON public.klap_eventos (created_at DESC);

-- ============================================================================
-- 6. Webhook deduplication
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.klap_webhook_log (
  webhook_id      text PRIMARY KEY,
  evento_tipo     text NOT NULL,
  payload         jsonb NOT NULL,
  signature_valid boolean NOT NULL,
  processed_at    timestamptz NOT NULL DEFAULT now(),
  result          text
);

CREATE INDEX IF NOT EXISTS klap_webhook_processed_idx ON public.klap_webhook_log (processed_at DESC);

-- ============================================================================
-- 7. Garantías tradicionales (cheque, depósito, transferencia, pagaré)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.garantias_tradicionales (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id               integer NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  metodo                    text NOT NULL CHECK (metodo IN
                              ('cheque','deposito_efectivo','transferencia','pagare')),
  monto                     numeric(12,0) NOT NULL CHECK (monto > 0),
  cheque_banco              text,
  cheque_numero             text,
  cheque_fecha              date,
  transferencia_referencia  text,
  pagare_url                text,
  deposito_comprobante_url  text,
  recibido_at               timestamptz,
  recibido_by               uuid REFERENCES public.users(id),
  devuelto_at               timestamptz,
  devuelto_by               uuid REFERENCES public.users(id),
  notas                     text,
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS garantias_tradicionales_contrato_idx
  ON public.garantias_tradicionales (contrato_id);

-- ============================================================================
-- 8. Cambios en contratos: nuevos estados + columnas + garantia_metodo
-- ============================================================================
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS garantia_metodo text NOT NULL DEFAULT 'klap_hold'
    CHECK (garantia_metodo IN ('klap_hold','cheque','deposito_efectivo','transferencia','pagare')),
  ADD COLUMN IF NOT EXISTS fecha_entrega_real timestamptz,
  ADD COLUMN IF NOT EXISTS fecha_devolucion_real timestamptz,
  ADD COLUMN IF NOT EXISTS hold_klap_id uuid REFERENCES public.klap_holds(id),
  ADD COLUMN IF NOT EXISTS entrega_token text,                    -- token único para link al cliente del flow de entrega
  ADD COLUMN IF NOT EXISTS entrega_token_expira_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS contratos_entrega_token_idx
  ON public.contratos (entrega_token)
  WHERE entrega_token IS NOT NULL;

-- Extender el estado_check para incluir los estados nuevos del lifecycle.
-- Usamos DO block para que sea idempotente.
DO $$
BEGIN
  ALTER TABLE public.contratos DROP CONSTRAINT IF EXISTS contratos_estado_check;
  ALTER TABLE public.contratos
    ADD CONSTRAINT contratos_estado_check CHECK (estado IN (
      'borrador',
      'pendiente_firma',
      'firmado',
      'en_entrega',
      'vigente',
      'en_devolucion',
      'finalizado',
      'finalizado_con_cargo',
      'vencido',
      'anulado'
    ));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'contratos_estado_check: %', SQLERRM;
END $$;

-- ============================================================================
-- 9. Fotos de entrega / devolución (evidencia de estado de la máquina)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.contratos_fotos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id   integer NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  tipo          text NOT NULL CHECK (tipo IN ('entrega','devolucion','dano')),
  storage_path  text NOT NULL,
  descripcion   text,
  subido_at     timestamptz NOT NULL DEFAULT now(),
  subido_by     uuid REFERENCES public.users(id)
);

CREATE INDEX IF NOT EXISTS contratos_fotos_contrato_tipo_idx
  ON public.contratos_fotos (contrato_id, tipo);

-- ============================================================================
-- 9b. Audit log: agregar event_types nuevos al CHECK
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'contratos_audit_log'
  ) THEN
    ALTER TABLE public.contratos_audit_log
      DROP CONSTRAINT IF EXISTS contratos_audit_log_event_type_check;
    ALTER TABLE public.contratos_audit_log
      ADD CONSTRAINT contratos_audit_log_event_type_check
      CHECK (event_type IN (
        'identity_uploaded','otp_requested','otp_verified','otp_failed',
        'sign_completed','sign_failed','arrendador_signed','arrendador_unsigned',
        'cedula_purged','auto_expired',
        'delivery_registered','delivery_card_authorized',
        'return_registered','return_inspection_completed',
        'deposit_captured','deposit_released',
        'deposit_hold_renewed','deposit_hold_renewal_failed',
        'late_charge_attempted','late_charge_approved','late_charge_declined',
        'tradicional_garantia_recibida','tradicional_garantia_devuelta'
      ));
  END IF;
END $$;

-- ============================================================================
-- 10. RLS — service_role only. La app valida con session/cookie.
-- ============================================================================
ALTER TABLE public.klap_cards               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.klap_holds               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.klap_captures            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.klap_offsession_charges  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.klap_eventos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.klap_webhook_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garantias_tradicionales  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos_fotos          ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Verificación:
--   SELECT count(*) FROM klap_holds;                  -- 0
--   SELECT count(*) FROM klap_cards;                  -- 0
--   SELECT garantia_metodo FROM contratos LIMIT 5;    -- 'klap_hold' (default)
