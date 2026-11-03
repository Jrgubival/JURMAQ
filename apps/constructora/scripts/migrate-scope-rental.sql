-- Agrega el scope 'rental' a usuarios y sesiones (panel de rental.jurmaq.cl).
-- Amplía los valores permitidos y crea las dos cuentas del panel; no cambia filas existentes.
-- PREPARADA, SIN CORRER: aplicar con OK de Jorge en Supabase → SQL Editor.
-- Revisado el 03-11-2026: el único scope 'both' es contacto@jurmaq.cl, que no va
-- en LOGIN_RENTAL_PERMITIDOS, así que no gana acceso a rental.
-- Antes de aplicar: confirmar en pg_constraint los nombres de los dos CHECK.
-- Si fueran otros, DROP ... IF EXISTS no hace nada y el CHECK viejo sigue activo.

BEGIN;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_scope_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_scope_check
  CHECK (scope IN ('barraca', 'constructora', 'rental', 'both'));

ALTER TABLE public.user_sessions DROP CONSTRAINT IF EXISTS user_sessions_scope_check;
ALTER TABLE public.user_sessions
  ADD CONSTRAINT user_sessions_scope_check
  CHECK (scope IN ('constructora', 'barraca', 'rental', 'app'));

-- Únicas cuentas del panel de rental (también van en LOGIN_RENTAL_PERMITIDOS).
-- Entran con código por correo: `password` es obligatoria en la tabla, pero este
-- valor no es un hash válido, así que con él nunca se puede entrar por contraseña.
INSERT INTO public.users (name, email, password, role, scope) VALUES
  ('Jorge Ubilla', 'jrgubival@gmail.com', 'sin-contrasena-login-por-codigo', 'admin', 'rental'),
  ('Constructora JURMAQ', 'constructora@jurmaq.cl', 'sin-contrasena-login-por-codigo', 'gerente', 'rental');

COMMIT;
