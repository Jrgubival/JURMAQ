-- Agrega el scope 'rental' a usuarios y sesiones (panel de rental.jurmaq.cl).
-- Sólo amplía los valores permitidos: no cambia ninguna fila.
-- PREPARADA, SIN CORRER: aplicar con OK de Jorge en Supabase → SQL Editor.
-- Antes de aplicar: revisar quién tiene scope 'both', porque esos usuarios
-- pasarían a poder entrar a rental si además están en LOGIN_RENTAL_PERMITIDOS.

BEGIN;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_scope_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_scope_check
  CHECK (scope IN ('barraca', 'constructora', 'rental', 'both'));

ALTER TABLE public.user_sessions DROP CONSTRAINT IF EXISTS user_sessions_scope_check;
ALTER TABLE public.user_sessions
  ADD CONSTRAINT user_sessions_scope_check
  CHECK (scope IN ('constructora', 'barraca', 'rental', 'app'));

COMMIT;
