-- ============================================================================
-- SPRINT MAYO 2026 — CONSTRUCTORA
-- ============================================================================
-- Consolidado de 3 migraciones del sprint. Pegá este archivo ENTERO en
-- Supabase Dashboard → SQL Editor (proyecto constructora) → Run.
--
-- Idempotente: todas las migraciones usan IF NOT EXISTS. Podés correrlo
-- varias veces sin romper nada.
--
-- Incluye:
--   1. Admin emails log (templates email manual arriendo)
--   2. Historial mantenciones máquinas (Tier 5 E2 + E4)
--   3. Admin notifications in-app (Tier 6 F4)
-- ============================================================================

-- ============================================================================
-- 1) ADMIN EMAILS LOG
-- ============================================================================

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


-- ============================================================================
-- 2) HISTORIAL MANTENCIONES (insumo del reporte de rentabilidad E4)
-- ============================================================================

-- migrate-maquinarias-mantenciones.sql
--
-- Tier 5 E2: Historial de mantenciones por máquina.
--
-- Cada vez que una máquina entra a taller (preventiva programada, falla,
-- inspección), registramos:
--   - tipo + descripción del trabajo
--   - costo (insumo para Tier 5 E4 reporte de rentabilidad)
--   - fecha + horómetro/kilómetros al momento
--   - proveedor (taller que la hizo)
--   - URL factura (opcional, ya tenemos bucket en Storage)
--   - próxima mantención programada (alerta cuando se acerca)
--
-- Aplicar: Supabase Dashboard → SQL Editor (proyecto constructora).

BEGIN;

CREATE TABLE IF NOT EXISTS public.maquinaria_mantenciones (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maquinaria_id       integer NOT NULL REFERENCES public.maquinarias(id) ON DELETE CASCADE,
  -- Tipo de mantención (estándar industria arriendo maquinaria).
  tipo                text NOT NULL CHECK (tipo IN (
    'preventiva',         -- Pauta horómetro/km
    'correctiva',         -- Reparación de falla
    'inspeccion',         -- Revisión técnica / DT
    'cambio_aceite',      -- Aceite motor/hidráulico
    'cambio_filtro',      -- Filtros varios
    'neumaticos',         -- Cambio/reparación rueda
    'pintura_reparacion', -- Cosmético
    'otro'
  )),
  descripcion         text NOT NULL,
  fecha               date NOT NULL DEFAULT CURRENT_DATE,
  /** Costo en CLP (sin IVA). Si la factura tiene IVA, registrar el neto. */
  costo               numeric(10,0) NOT NULL DEFAULT 0 CHECK (costo >= 0),
  /** Lectura del horómetro o km al momento (para pauta). */
  horometro_km        numeric(10,2),
  /** Taller / proveedor que ejecutó. */
  proveedor           text,
  /** URL de la factura subida a Supabase Storage. */
  factura_url         text,
  /** Si esta mantención agendó la próxima, registrar la fecha objetivo. */
  proxima_mantencion_at date,
  notas               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid
);

CREATE INDEX IF NOT EXISTS maquinaria_mantenciones_maq_fecha_idx
  ON public.maquinaria_mantenciones (maquinaria_id, fecha DESC);
CREATE INDEX IF NOT EXISTS maquinaria_mantenciones_proxima_idx
  ON public.maquinaria_mantenciones (proxima_mantencion_at)
  WHERE proxima_mantencion_at IS NOT NULL;

-- ============================================================================
-- Vista: próxima mantención por máquina (la fecha más cercana en futuro)
-- ============================================================================
-- Útil para mostrar alertas en /admin/maquinarias listando "alerta: revisión
-- programada para X" sin tener que escanear toda la tabla en cada render.
DROP VIEW IF EXISTS public.maquinarias_proxima_mantencion;
CREATE VIEW public.maquinarias_proxima_mantencion
  WITH (security_invoker = true) AS
SELECT
  maquinaria_id,
  MIN(proxima_mantencion_at) FILTER (
    WHERE proxima_mantencion_at >= CURRENT_DATE
  ) AS proxima_at,
  (MIN(proxima_mantencion_at) FILTER (
    WHERE proxima_mantencion_at >= CURRENT_DATE
  ) - CURRENT_DATE) AS dias_restantes
FROM public.maquinaria_mantenciones
WHERE proxima_mantencion_at IS NOT NULL
GROUP BY maquinaria_id;

-- ============================================================================
-- RLS — solo lectura/escritura desde admin con service_role (sin políticas anon).
-- ============================================================================
ALTER TABLE public.maquinaria_mantenciones ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Verificación:
--   SELECT m.nombre, mp.proxima_at, mp.dias_restantes
--   FROM maquinarias m
--   LEFT JOIN maquinarias_proxima_mantencion mp ON mp.maquinaria_id = m.id
--   ORDER BY mp.dias_restantes NULLS LAST;


-- ============================================================================
-- 3) ADMIN NOTIFICATIONS IN-APP
-- ============================================================================

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
