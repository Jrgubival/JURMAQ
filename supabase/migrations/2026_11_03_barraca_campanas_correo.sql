-- Campañas de correo propias (sin Broadcasts de Resend) y origen de las bajas.

-- De dónde vino la baja ('pie-correo', 'campana:<nombre>', 'gmail-un-clic', ...).
alter table public.barraca_correos_baja
  add column if not exists origen text;
alter table public.barraca_correos_baja
  drop constraint if exists barraca_correos_baja_origen_chk;
alter table public.barraca_correos_baja
  add constraint barraca_correos_baja_origen_chk
  check (origen is null or origen ~ '^[a-z0-9:_-]{1,60}$');

-- Registro de envíos de campaña: una fila por (campaña, destinatario). La
-- unicidad es la que impide mandar dos veces el mismo correo a la misma persona:
-- la fila se "reserva" ANTES de enviar. El destinatario va como huella HMAC
-- (la misma de las bajas), nunca el correo en claro.
create table if not exists public.barraca_campana_envios (
  id bigserial primary key,
  campana text not null check (campana ~ '^[a-z0-9_-]{3,60}$'),
  huella text not null check (huella ~ '^[a-f0-9]{64}$'),
  estado text not null default 'reservado' check (estado in ('reservado', 'enviado', 'error')),
  resend_id text,
  error text check (error is null or length(error) <= 300),
  created_at timestamptz not null default now(),
  enviado_at timestamptz,
  unique (campana, huella)
);
create index if not exists barraca_campana_envios_enviado_idx on public.barraca_campana_envios (enviado_at);

alter table public.barraca_campana_envios enable row level security;
revoke all on public.barraca_campana_envios from anon, authenticated;
