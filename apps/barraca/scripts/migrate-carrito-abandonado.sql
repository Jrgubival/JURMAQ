-- migrate-carrito-abandonado.sql
--
-- Sprint 6: Tracking de carrito abandonado para recovery emails.
--
-- Cuando un usuario logueado agrega items al carrito y NO completa la
-- compra en 1 hora, encolamos un email de recuperación. Si pasan 24h sin
-- compra, segundo recovery. Si pasan 72h, tercer recovery con descuento
-- (cupón auto-generado).
--
-- Aplicar: Supabase Dashboard (barraca).

BEGIN;

CREATE TABLE IF NOT EXISTS public.barraca_carrito_abandonado (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      integer REFERENCES public.barraca_usuarios(id) ON DELETE CASCADE,
  email           text NOT NULL,
  session_id      text,                                 -- guest carrito (localStorage)
  items           jsonb NOT NULL,                       -- snapshot del carrito
  total           numeric(12,0) NOT NULL,
  last_activity   timestamptz NOT NULL DEFAULT now(),
  recovery_count  integer NOT NULL DEFAULT 0,           -- 0/1/2/3 (cuántos emails recovery enviados)
  recovery_last_at timestamptz,
  converted_at    timestamptz,                          -- usuario completó compra → NULL si abandonado
  cupon_generado  text,                                 -- código de cupón generado para el 3er recovery
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS carrito_abandonado_email_idx
  ON public.barraca_carrito_abandonado (LOWER(email));
CREATE INDEX IF NOT EXISTS carrito_abandonado_pending_idx
  ON public.barraca_carrito_abandonado (last_activity, recovery_count)
  WHERE converted_at IS NULL;
CREATE INDEX IF NOT EXISTS carrito_abandonado_session_idx
  ON public.barraca_carrito_abandonado (session_id)
  WHERE session_id IS NOT NULL;

ALTER TABLE public.barraca_carrito_abandonado ENABLE ROW LEVEL SECURITY;

COMMIT;
