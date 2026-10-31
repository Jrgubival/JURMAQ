-- Login del panel de la barraca con código por correo (nov-2026).
-- SIN APLICAR. Aplicar en el SQL Editor de Supabase ANTES de desplegar el
-- login nuevo de barraca.jurmaq.cl (sin esta tabla nadie puede entrar al panel).
-- No toca public.users ni el login de jurmaq.cl (constructora).
--
-- Guarda sólo hashes: email_hash y code_hash son HMAC-SHA256 con AUTH_SECRET
-- calculados en el servidor. Nunca el código en claro ni el correo.
-- Sólo el service_role (servidor) la usa: RLS activo sin políticas y sin
-- permisos para anon/authenticated.

begin;

create table if not exists public.barraca_login_codigos (
  id          bigint generated always as identity primary key,
  email_hash  text        not null,
  code_hash   text        not null,
  expires_at  timestamptz not null,
  attempts    integer     not null default 0,
  used_at     timestamptz,
  created_at  timestamptz not null default now(),
  ip_hash     text
);

create index if not exists barraca_login_codigos_email_idx
  on public.barraca_login_codigos (email_hash, created_at desc);

alter table public.barraca_login_codigos enable row level security;
revoke all on table public.barraca_login_codigos from anon, authenticated;

-- Crea un código nuevo: invalida los anteriores sin usar del mismo correo
-- (sólo vale el último) y borra filas viejas (> 1 día).
create or replace function public.barraca_login_codigo_crear(
  p_email_hash  text,
  p_code_hash   text,
  p_ip_hash     text,
  p_ttl_seconds integer
) returns void
language plpgsql
set search_path = public
as $$
begin
  delete from public.barraca_login_codigos
   where created_at < now() - interval '1 day';

  update public.barraca_login_codigos
     set used_at = now()
   where email_hash = p_email_hash
     and used_at is null;

  insert into public.barraca_login_codigos (email_hash, code_hash, expires_at, ip_hash)
  values (p_email_hash, p_code_hash, now() + make_interval(secs => p_ttl_seconds), p_ip_hash);
end;
$$;

-- Verifica y consume de forma atómica (FOR UPDATE): si el código calza se
-- marca usado (un solo uso); si no, suma un intento y con p_max_intentos
-- intentos fallidos el código queda invalidado.
create or replace function public.barraca_login_codigo_consumir(
  p_email_hash   text,
  p_code_hash    text,
  p_max_intentos integer
) returns boolean
language plpgsql
set search_path = public
as $$
declare
  fila public.barraca_login_codigos%rowtype;
begin
  select * into fila
    from public.barraca_login_codigos
   where email_hash = p_email_hash
     and used_at is null
     and expires_at > now()
     and attempts < p_max_intentos
   order by created_at desc
   limit 1
   for update;

  if not found then
    return false;
  end if;

  if fila.code_hash = p_code_hash then
    update public.barraca_login_codigos set used_at = now() where id = fila.id;
    return true;
  end if;

  update public.barraca_login_codigos
     set attempts = attempts + 1,
         used_at  = case when attempts + 1 >= p_max_intentos then now() else used_at end
   where id = fila.id;
  return false;
end;
$$;

revoke all on function public.barraca_login_codigo_crear(text, text, text, integer) from public, anon, authenticated;
revoke all on function public.barraca_login_codigo_consumir(text, text, integer) from public, anon, authenticated;
grant execute on function public.barraca_login_codigo_crear(text, text, text, integer) to service_role;
grant execute on function public.barraca_login_codigo_consumir(text, text, integer) to service_role;

commit;
