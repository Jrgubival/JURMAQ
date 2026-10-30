-- Bajas de correos automáticos (carrito abandonado, pedir opinión, reposición).
-- Se guarda solo una huella HMAC del correo (ver src/lib/baja-correos.ts), no el correo.
-- Aplicar en Supabase Dashboard → SQL Editor antes de reactivar los crons de correo.
create table if not exists public.barraca_correos_baja (
  huella text primary key check (huella ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
alter table public.barraca_correos_baja enable row level security;
-- Sin policies: solo el service_role (servidor) lee y escribe.
