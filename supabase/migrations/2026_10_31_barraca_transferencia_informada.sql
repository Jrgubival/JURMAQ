-- =============================================================================
-- 2026-10-31 · "Ya transferí": el comprador avisa que transfirió y sube el
-- comprobante (opcional). Estado nuevo 'transferencia_informada'.
-- =============================================================================
-- NO APLICADA. Aplicar en Supabase Dashboard → SQL Editor, DESPUÉS de:
--   2026_10_26_barraca_pedidos.sql, 2026_10_29_barraca_pedidos_despacho.sql,
--   2026_10_30_barraca_webpay.sql, 2026_10_31_barraca_admin.sql,
--   2026_10_31_barraca_sin_cuentas.sql
--
-- Idempotente: se puede correr dos veces.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Columnas del aviso de transferencia
-- -----------------------------------------------------------------------------
alter table public.barraca_pedidos
  add column if not exists transferencia_informada_at timestamptz,
  -- Ruta dentro del bucket privado barraca-comprobantes: "<numero>/<hex32>.<ext>".
  -- Nombre al azar generado por el servidor (nunca el nombre del cliente).
  add column if not exists comprobante_path text
    check (comprobante_path is null or comprobante_path ~ '^BJ-[0-9]{6}-[2-9A-HJKMNP-Z]{4}/[a-f0-9]{32}\.(jpg|png|webp|heic|pdf)$'),
  add column if not exists comprobante_nota text
    check (comprobante_nota is null or length(comprobante_nota) <= 300);

-- -----------------------------------------------------------------------------
-- 2. Estado nuevo (lista completa de 2026_10_30 + 'transferencia_informada')
-- -----------------------------------------------------------------------------
alter table public.barraca_pedidos
  drop constraint if exists barraca_pedidos_estado_check,
  add constraint barraca_pedidos_estado_check
    check (estado in (
      'pendiente_pago', 'transferencia_informada', 'pagado', 'pago_rechazado', 'pago_discrepancia',
      'en_preparacion', 'listo_retiro', 'despachado', 'entregado', 'cancelado', 'rechazado'
    ));

-- -----------------------------------------------------------------------------
-- 3. Marcar pagado: igual que en 2026_10_26, pero también acepta
--    'transferencia_informada' (único cambio).
-- -----------------------------------------------------------------------------
create or replace function public.barraca_pedido_marcar_pagado(
  p_numero text,
  p_monto integer,
  p_pago_id text,
  p_pasarela text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.barraca_pedidos%rowtype;
  it jsonb;
begin
  select * into v from public.barraca_pedidos where numero = p_numero for update;
  if not found then
    return 'no_encontrado';
  end if;
  if v.estado not in ('pendiente_pago', 'pago_rechazado', 'transferencia_informada') then
    return 'ya_procesado';
  end if;
  if abs(v.total - p_monto) > 1 then
    update public.barraca_pedidos
       set estado = 'pago_discrepancia', pago_id = p_pago_id, pasarela = coalesce(p_pasarela, pasarela)
     where id = v.id;
    return 'monto_distinto';
  end if;

  update public.barraca_pedidos
     set estado = 'pagado',
         pago_id = p_pago_id,
         pasarela = coalesce(p_pasarela, pasarela),
         pagado_at = now(),
         stock_descontado = true
   where id = v.id;

  if not v.stock_descontado then
    for it in select * from jsonb_array_elements(v.items) loop
      update public.barraca_productos
         set stock = greatest(0, coalesce(stock, 0) - (it->>'cantidad')::int)
       where id = (it->>'productoId')::bigint;
    end loop;
  end if;

  return 'pagado';
end $$;

revoke all on function public.barraca_pedido_marcar_pagado(text, integer, text, text) from public, anon, authenticated;
grant execute on function public.barraca_pedido_marcar_pagado(text, integer, text, text) to service_role;

-- -----------------------------------------------------------------------------
-- 4. Cerrar (cancelar/rechazar): igual que en 2026_10_30, pero también acepta
--    'transferencia_informada' (único cambio).
-- -----------------------------------------------------------------------------
create or replace function public.barraca_pedido_cerrar(p_numero text, p_estado text, p_motivo text, p_nota text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.barraca_pedidos%rowtype;
  it jsonb;
begin
  if p_estado not in ('cancelado', 'rechazado') then return 'estado_invalido'; end if;
  select * into v from public.barraca_pedidos where numero = p_numero for update;
  if not found then return 'no_encontrado'; end if;
  if v.estado not in ('pendiente_pago', 'transferencia_informada', 'pago_rechazado', 'pago_discrepancia', 'pagado', 'en_preparacion', 'listo_retiro') then
    return 'estado_invalido';
  end if;
  if v.stock_descontado then
    for it in select * from jsonb_array_elements(v.items) loop
      update public.barraca_productos
         set stock = coalesce(stock, 0) + (it->>'cantidad')::int
       where id = (it->>'productoId')::bigint;
    end loop;
  end if;
  update public.barraca_pedidos
     set estado = p_estado,
         stock_descontado = false,
         rechazo_motivo = case when p_estado = 'rechazado' then p_motivo else rechazo_motivo end,
         rechazo_nota = case when p_estado = 'rechazado' then p_nota else rechazo_nota end,
         rechazado_at = case when p_estado = 'rechazado' then now() else rechazado_at end
   where id = v.id;
  return 'ok';
end $$;

revoke all on function public.barraca_pedido_cerrar(text, text, text, text) from public, anon, authenticated;
grant execute on function public.barraca_pedido_cerrar(text, text, text, text) to service_role;

-- -----------------------------------------------------------------------------
-- 5. Bucket PRIVADO para los comprobantes
-- -----------------------------------------------------------------------------
-- public = false y SIN policies en storage.objects para este bucket: anon y
-- authenticated no leen, listan ni suben nada. Sólo el servidor (service_role,
-- que se salta RLS) sube el archivo y lo entrega al panel por
-- /api/admin/pedidos/[numero]/comprobante. Límite 5 MB y tipos permitidos
-- también en el bucket (el servidor ya los valida por magic bytes).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'barraca-comprobantes', 'barraca-comprobantes', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

commit;

-- Verificación (opcional):
--   select id, public, file_size_limit from storage.buckets where id = 'barraca-comprobantes';
--   select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects'
--     and (qual ilike '%barraca-comprobantes%' or with_check ilike '%barraca-comprobantes%');  -- debe venir vacío
