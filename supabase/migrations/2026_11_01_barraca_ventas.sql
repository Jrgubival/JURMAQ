-- =============================================================================
-- 2026-11-01 · Panel de Ventas de la barraca
--   1. Boleta o factura pedida en el checkout (datos de la empresa).
--   2. Boleta/factura (PDF) que sube la barraca y se manda al cliente.
--   3. Historial de estados de cada pedido (barraca_pedidos_eventos).
--   4. Bucket PRIVADO barraca-documentos (sólo service_role).
-- =============================================================================
-- NO APLICADA. Aplicar en Supabase Dashboard → SQL Editor, DESPUÉS de:
--   2026_10_26_barraca_pedidos.sql, 2026_10_29_barraca_pedidos_despacho.sql,
--   2026_10_30_barraca_webpay.sql, 2026_10_31_barraca_admin.sql,
--   2026_10_31_barraca_sin_cuentas.sql,
--   2026_10_31_barraca_transferencia_informada.sql
--
-- Aditiva e idempotente: sólo agrega columnas, una tabla, un trigger y un
-- bucket. No cambia ni borra nada existente. Se puede correr dos veces.
--
-- IMPORTANTE: aplicarla ANTES de desplegar el código que la usa. El checkout
-- nuevo escribe documento_solicitado/factura_* al crear el pedido; sin estas
-- columnas PostgREST rechaza el insert.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Documento tributario pedido en el checkout
-- -----------------------------------------------------------------------------
alter table public.barraca_pedidos
  add column if not exists documento_solicitado text not null default 'boleta'
    check (documento_solicitado in ('boleta', 'factura')),
  add column if not exists factura_razon_social text
    check (factura_razon_social is null or length(factura_razon_social) between 2 and 150),
  -- RUT de la empresa ya validado (DV) y formateado por el servidor: "76.123.456-7".
  add column if not exists factura_rut text
    check (factura_rut is null or factura_rut ~ '^[0-9]{1,2}(\.[0-9]{3}){2}-[0-9K]$'),
  add column if not exists factura_giro text
    check (factura_giro is null or length(factura_giro) between 2 and 120),
  -- Dirección comercial con la comuna: "Av. Manso de Velasco 1234, Curicó".
  add column if not exists factura_direccion text
    check (factura_direccion is null or length(factura_direccion) between 5 and 220);

-- Una factura sin los datos de la empresa no sirve.
alter table public.barraca_pedidos
  drop constraint if exists barraca_pedidos_factura_datos_check,
  add constraint barraca_pedidos_factura_datos_check
    check (
      documento_solicitado <> 'factura'
      or (factura_razon_social is not null and factura_rut is not null
          and factura_giro is not null and factura_direccion is not null)
    );

-- -----------------------------------------------------------------------------
-- 2. Boleta / factura emitida (PDF subido desde el panel)
-- -----------------------------------------------------------------------------
alter table public.barraca_pedidos
  -- Ruta dentro del bucket privado barraca-documentos: "<numero>/<hex32>.pdf".
  -- Nombre al azar generado por el servidor (nunca el nombre del archivo subido).
  add column if not exists documento_path text
    check (documento_path is null or documento_path ~ '^BJ-[0-9]{6}-[2-9A-HJKMNP-Z]{4}/[a-f0-9]{32}\.pdf$'),
  add column if not exists documento_tipo text
    check (documento_tipo is null or documento_tipo in ('boleta', 'factura')),
  add column if not exists documento_subido_at timestamptz,
  add column if not exists documento_enviado_at timestamptz;

create index if not exists barraca_pedidos_created_idx on public.barraca_pedidos (created_at desc);

-- -----------------------------------------------------------------------------
-- 3. Historial de estados
-- -----------------------------------------------------------------------------
create table if not exists public.barraca_pedidos_eventos (
  id               bigint generated always as identity primary key,
  numero           text not null references public.barraca_pedidos (numero) on delete cascade,
  estado_anterior  text,
  estado_nuevo     text not null,
  motivo           text check (motivo is null or length(motivo) <= 300),
  -- Quién lo hizo desde el panel (correo del usuario). null = sistema
  -- (pago de Webpay, aviso "Ya transferí" del cliente, creación del pedido).
  actor_email      text check (actor_email is null or length(actor_email) <= 254),
  created_at       timestamptz not null default now()
);

create index if not exists barraca_pedidos_eventos_numero_idx
  on public.barraca_pedidos_eventos (numero, created_at);

-- Sin policies: anon y authenticated no leen ni escriben. Sólo el servidor
-- (service_role) lee el historial para el panel.
alter table public.barraca_pedidos_eventos enable row level security;
revoke all on table public.barraca_pedidos_eventos from public, anon, authenticated;
grant select, insert, update on table public.barraca_pedidos_eventos to service_role;

-- Cada cambio de estado queda registrado, venga de donde venga (panel, Webpay,
-- RPCs de pago/cierre, "Ya transferí"). El panel después firma el evento con
-- el correo de quien lo hizo (update de actor_email del último evento).
create or replace function public.barraca_pedidos_evento_estado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.barraca_pedidos_eventos (numero, estado_anterior, estado_nuevo, motivo)
    values (new.numero, null, new.estado, 'Pedido creado en la tienda');
  elsif new.estado is distinct from old.estado then
    insert into public.barraca_pedidos_eventos (numero, estado_anterior, estado_nuevo, motivo)
    values (
      new.numero, old.estado, new.estado,
      case when new.estado = 'rechazado' then new.rechazo_motivo else null end
    );
  end if;
  return null;
end $$;

revoke all on function public.barraca_pedidos_evento_estado() from public, anon, authenticated;

drop trigger if exists barraca_pedidos_evento_estado on public.barraca_pedidos;
create trigger barraca_pedidos_evento_estado
  after insert or update of estado on public.barraca_pedidos
  for each row execute function public.barraca_pedidos_evento_estado();

-- -----------------------------------------------------------------------------
-- 4. Bucket PRIVADO para boletas y facturas
-- -----------------------------------------------------------------------------
-- public = false y SIN policies en storage.objects para este bucket: anon y
-- authenticated no leen, listan ni suben nada. Sólo el servidor (service_role)
-- sube el PDF y lo entrega al panel por
-- /api/admin/pedidos/[numero]/documento. Sólo PDF, máximo 5 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('barraca-documentos', 'barraca-documentos', false, 5242880, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

commit;

-- Verificación (opcional):
--   select column_name from information_schema.columns
--    where table_name = 'barraca_pedidos' and column_name like any (array['documento%', 'factura%']);
--   select id, public, file_size_limit from storage.buckets where id = 'barraca-documentos';
--   select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects'
--     and (qual ilike '%barraca-documentos%' or with_check ilike '%barraca-documentos%');  -- debe venir vacío
