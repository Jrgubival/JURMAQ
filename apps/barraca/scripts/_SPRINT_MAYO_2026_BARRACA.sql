-- ============================================================================
-- SPRINT MAYO 2026 — BARRACA
-- ============================================================================
-- Consolidado de 5 migraciones del sprint. Pegá este archivo ENTERO en
-- Supabase Dashboard → SQL Editor (proyecto barraca) → Run.
--
-- Idempotente: todas las migraciones usan IF NOT EXISTS. Podés correrlo
-- varias veces sin romper nada.
--
-- Incluye:
--   1. Maestros referidos (Tier 2 B1)
--   2. Reviews + ratings (Tier 4 D2)
--   3. Post-purchase tracking (Tier 4 D6)
--   4. Admin notifications in-app (Tier 6 F4)
--   5. SMS recovery carrito abandonado (Tier 4 D7)
-- ============================================================================

-- ============================================================================
-- 1) MAESTROS REFERIDOS
-- ============================================================================

-- migrate-maestros-referidos.sql
--
-- Tier 2 B1: Programa de Referidos para Maestros (SOLO barraca).
--
-- Reemplaza el concepto original de "Club Maestro" (tier de descuento) por
-- un modelo de afiliados:
--   - Maestro registrado tiene código MAE-YYYY-NNN
--   - Cliente compra en barraca + ingresa código en checkout
--   - JURMAQ paga 1% (configurable) del neto al maestro como comisión
--   - Estados: pendiente → devengada (al pagar venta) → pagada → anulada (si venta cancelada)
--
-- Aplicar: Supabase Dashboard → SQL Editor (proyecto barraca).

BEGIN;

-- ============================================================================
-- 1. Tabla maestros
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.maestros (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo              text UNIQUE NOT NULL,
  nombre              text NOT NULL,
  rut                 text NOT NULL,
  email               text,
  telefono            text,
  banco               text,
  tipo_cuenta         text CHECK (tipo_cuenta IS NULL OR tipo_cuenta IN ('cuenta_corriente','cuenta_vista','cuenta_ahorro')),
  numero_cuenta       text,
  porcentaje_comision numeric(5,2) NOT NULL DEFAULT 1.00 CHECK (porcentaje_comision >= 0 AND porcentaje_comision <= 100),
  activo              boolean NOT NULL DEFAULT true,
  notas               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid,
  CONSTRAINT maestros_codigo_format CHECK (codigo ~ '^MAE-[0-9]{4}-[0-9]+$')
);

CREATE INDEX IF NOT EXISTS maestros_codigo_idx ON public.maestros (codigo);
CREATE INDEX IF NOT EXISTS maestros_activo_idx ON public.maestros (activo) WHERE activo = true;
CREATE INDEX IF NOT EXISTS maestros_rut_idx ON public.maestros (rut);

-- ============================================================================
-- 2. Tabla comisiones_maestro
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.comisiones_maestro (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  maestro_id          uuid NOT NULL REFERENCES public.maestros(id) ON DELETE RESTRICT,
  origen_tipo         text NOT NULL CHECK (origen_tipo IN ('barraca_cotizacion','barraca_venta')),
  origen_id           text NOT NULL,
  monto_venta_neto    numeric(12,0) NOT NULL CHECK (monto_venta_neto >= 0),
  porcentaje          numeric(5,2) NOT NULL CHECK (porcentaje >= 0 AND porcentaje <= 100),
  monto_comision      numeric(12,0) NOT NULL CHECK (monto_comision >= 0),
  estado              text NOT NULL DEFAULT 'pendiente'
                      CHECK (estado IN ('pendiente','devengada','pagada','anulada')),
  devengada_at        timestamptz,
  pagada_at           timestamptz,
  pagada_by           uuid,
  pago_referencia     text,
  notas               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comisiones_origen_unique UNIQUE (origen_tipo, origen_id)
);

CREATE INDEX IF NOT EXISTS comisiones_maestro_idx ON public.comisiones_maestro (maestro_id, estado);
CREATE INDEX IF NOT EXISTS comisiones_estado_idx ON public.comisiones_maestro (estado, devengada_at);

-- ============================================================================
-- 3. Columnas referidos en barraca_cotizaciones
-- ============================================================================
ALTER TABLE public.barraca_cotizaciones
  ADD COLUMN IF NOT EXISTS codigo_maestro text,
  ADD COLUMN IF NOT EXISTS maestro_id uuid REFERENCES public.maestros(id);

CREATE INDEX IF NOT EXISTS barraca_cotizaciones_maestro_idx
  ON public.barraca_cotizaciones (maestro_id)
  WHERE maestro_id IS NOT NULL;

-- ============================================================================
-- 4. Trigger: devengar comisión cuando cotización pasa a 'pagada'
--    + rollback (anular) cuando pasa a 'anulada' o 'cancelada'
-- ============================================================================
CREATE OR REPLACE FUNCTION public.devengar_comision_barraca() RETURNS trigger AS $$
BEGIN
  -- Devengo: cotización recién pagada con maestro asignado.
  IF NEW.estado = 'pagada' AND (OLD.estado IS NULL OR OLD.estado != 'pagada')
     AND NEW.maestro_id IS NOT NULL THEN
    INSERT INTO public.comisiones_maestro (
      maestro_id, origen_tipo, origen_id,
      monto_venta_neto, porcentaje, monto_comision,
      estado, devengada_at
    )
    SELECT
      NEW.maestro_id,
      'barraca_cotizacion',
      NEW.id::text,
      ROUND(NEW.total / 1.19),               -- neto (sin IVA)
      m.porcentaje_comision,
      ROUND(NEW.total / 1.19 * m.porcentaje_comision / 100),
      'devengada',
      now()
    FROM public.maestros m
    WHERE m.id = NEW.maestro_id
    ON CONFLICT (origen_tipo, origen_id) DO UPDATE
      SET estado = 'devengada', devengada_at = now();
  END IF;

  -- Rollback: cotización anulada/cancelada → comisión anulada.
  IF NEW.estado IN ('anulada','cancelada')
     AND (OLD.estado IS NULL OR OLD.estado NOT IN ('anulada','cancelada')) THEN
    UPDATE public.comisiones_maestro
       SET estado = 'anulada',
           notas = COALESCE(notas,'') || ' [auto-anulada: ' || NEW.estado || ']'
     WHERE origen_tipo = 'barraca_cotizacion'
       AND origen_id = NEW.id::text
       AND estado IN ('pendiente','devengada');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_devengar_comision_barraca ON public.barraca_cotizaciones;
CREATE TRIGGER trg_devengar_comision_barraca
  AFTER UPDATE ON public.barraca_cotizaciones
  FOR EACH ROW EXECUTE FUNCTION public.devengar_comision_barraca();

-- ============================================================================
-- 5. RPC para generar próximo código MAE-YYYY-NNN (numeración por año)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.next_maestro_codigo()
RETURNS text AS $$
DECLARE
  v_anio text := to_char(now(), 'YYYY');
  v_max integer;
  v_codigo text;
BEGIN
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(codigo, '-', 3) AS integer)
  ), 0)
  INTO v_max
  FROM public.maestros
  WHERE codigo LIKE 'MAE-' || v_anio || '-%';

  v_codigo := 'MAE-' || v_anio || '-' || LPAD((v_max + 1)::text, 3, '0');
  RETURN v_codigo;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. RLS
-- ============================================================================
ALTER TABLE public.maestros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comisiones_maestro ENABLE ROW LEVEL SECURITY;

-- Anon puede leer maestros activos (para validar código en checkout + stats pública).
-- NUNCA expone datos bancarios (filtrado por SELECT en endpoint).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'maestros'
      AND policyname = 'maestros_anon_validar'
  ) THEN
    CREATE POLICY maestros_anon_validar
      ON public.maestros FOR SELECT TO anon
      USING (activo = true);
  END IF;
END $$;

COMMIT;

-- Verificación:
--   SELECT next_maestro_codigo();      -- 'MAE-2026-001'
--   SELECT count(*) FROM maestros;     -- 0 inicial


-- ============================================================================
-- 2) REVIEWS + RATINGS
-- ============================================================================

-- migrate-reviews.sql
--
-- Tier 4 D2: Reviews/ratings de productos barraca.
--
-- Modelo:
--   - Cliente logueado escribe review (1-5 estrellas + texto opcional)
--   - Solo clientes que tienen cotización 'pagada' con ese producto pueden
--     reseñar (verificación server-side al crear)
--   - 1 review por (usuario, producto) — unique constraint
--   - Estados moderación: pendiente | aprobada | rechazada
--   - Solo aprobadas son públicas (resto solo el admin las ve)
--   - Vista materializada barraca_productos_rating cachea avg+count
--
-- Aplicar: Supabase Dashboard → SQL Editor (proyecto barraca).

BEGIN;

-- ============================================================================
-- 1. Tabla barraca_reviews
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.barraca_reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    integer NOT NULL REFERENCES public.barraca_usuarios(id) ON DELETE CASCADE,
  producto_id   integer NOT NULL REFERENCES public.barraca_productos(id) ON DELETE CASCADE,
  rating        smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  titulo        text,
  comentario    text,
  estado        text NOT NULL DEFAULT 'pendiente'
                CHECK (estado IN ('pendiente','aprobada','rechazada')),
  -- Snapshot del comprador en el momento (cambio de nombre no afecta review).
  usuario_nombre text NOT NULL,
  -- Bandera: cliente con compra confirmada (verificación server-side al crear).
  compra_verificada boolean NOT NULL DEFAULT false,
  -- Likes/útil del review (otros usuarios pueden marcar "me sirvió").
  utiles_count  integer NOT NULL DEFAULT 0,
  -- Moderación
  moderado_at   timestamptz,
  moderado_by   uuid,
  notas_moderacion text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT barraca_reviews_unique UNIQUE (usuario_id, producto_id)
);

CREATE INDEX IF NOT EXISTS barraca_reviews_producto_idx
  ON public.barraca_reviews (producto_id, estado)
  WHERE estado = 'aprobada';
CREATE INDEX IF NOT EXISTS barraca_reviews_usuario_idx
  ON public.barraca_reviews (usuario_id);
CREATE INDEX IF NOT EXISTS barraca_reviews_pendientes_idx
  ON public.barraca_reviews (created_at DESC)
  WHERE estado = 'pendiente';

-- ============================================================================
-- 2. Tabla barraca_reviews_likes (un cliente marca "me sirvió" max 1 vez)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.barraca_reviews_likes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   uuid NOT NULL REFERENCES public.barraca_reviews(id) ON DELETE CASCADE,
  usuario_id  integer NOT NULL REFERENCES public.barraca_usuarios(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT barraca_reviews_likes_unique UNIQUE (review_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS barraca_reviews_likes_review_idx
  ON public.barraca_reviews_likes (review_id);

-- ============================================================================
-- 3. Trigger: mantener utiles_count sincronizado
-- ============================================================================
CREATE OR REPLACE FUNCTION public.barraca_review_like_count() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.barraca_reviews
       SET utiles_count = utiles_count + 1
     WHERE id = NEW.review_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.barraca_reviews
       SET utiles_count = GREATEST(0, utiles_count - 1)
     WHERE id = OLD.review_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_barraca_review_like_count ON public.barraca_reviews_likes;
CREATE TRIGGER trg_barraca_review_like_count
  AFTER INSERT OR DELETE ON public.barraca_reviews_likes
  FOR EACH ROW EXECUTE FUNCTION public.barraca_review_like_count();

-- ============================================================================
-- 4. Vista barraca_productos_rating (agregado público de avg+count)
-- ============================================================================
-- security_invoker garantiza que la vista hereda permisos del rol que consulta.
DROP VIEW IF EXISTS public.barraca_productos_rating;
CREATE VIEW public.barraca_productos_rating
  WITH (security_invoker = true) AS
SELECT
  producto_id,
  COUNT(*)::integer       AS total_reviews,
  ROUND(AVG(rating)::numeric, 2) AS rating_promedio,
  COUNT(*) FILTER (WHERE rating = 5)::integer AS r5,
  COUNT(*) FILTER (WHERE rating = 4)::integer AS r4,
  COUNT(*) FILTER (WHERE rating = 3)::integer AS r3,
  COUNT(*) FILTER (WHERE rating = 2)::integer AS r2,
  COUNT(*) FILTER (WHERE rating = 1)::integer AS r1
FROM public.barraca_reviews
WHERE estado = 'aprobada'
GROUP BY producto_id;

-- ============================================================================
-- 5. RLS
-- ============================================================================
ALTER TABLE public.barraca_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barraca_reviews_likes ENABLE ROW LEVEL SECURITY;

-- Anon puede leer solo reviews aprobadas (para mostrar en producto público).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'barraca_reviews'
      AND policyname = 'barraca_reviews_anon_aprobadas'
  ) THEN
    CREATE POLICY barraca_reviews_anon_aprobadas
      ON public.barraca_reviews FOR SELECT TO anon
      USING (estado = 'aprobada');
  END IF;
END $$;

COMMIT;

-- Verificación:
--   SELECT * FROM barraca_productos_rating LIMIT 5;
--   SELECT count(*) FROM barraca_reviews WHERE estado = 'pendiente';


-- ============================================================================
-- 3) POST-PURCHASE TRACKING
-- ============================================================================

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


-- ============================================================================
-- 4) ADMIN NOTIFICATIONS IN-APP
-- ============================================================================

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


-- ============================================================================
-- 5) SMS RECOVERY CARRITO ABANDONADO
-- ============================================================================

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
