-- Deja una base Postgres vacía lista para restaurar un respaldo de Supabase:
-- los roles y extensiones que el dump da por hecho. Sólo para bases temporales.
drop schema if exists public cascade;
do $$
declare r text;
begin
  foreach r in array array[
    'anon', 'authenticated', 'service_role', 'authenticator', 'supabase_admin',
    'supabase_auth_admin', 'supabase_storage_admin', 'dashboard_user',
    'supabase_realtime_admin', 'postgres_fdw_user', 'pgbouncer'
  ] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      execute format('create role %I', r);
    end if;
  end loop;
end $$;
create schema if not exists extensions;
create extension if not exists pgcrypto schema extensions;
create extension if not exists "uuid-ossp" schema extensions;
create extension if not exists pg_trgm schema extensions;
create extension if not exists unaccent schema extensions;
create extension if not exists citext schema extensions;
