-- Pago en línea con Webpay Plus (Transbank) en la tienda barraca.
-- Aplicar DESPUÉS de 2026_10_26_barraca_pedidos.sql y 2026_10_29_barraca_pedidos_despacho.sql
-- (SQL Editor de Supabase).

-- Nuevo método de pago 'webpay'. 'mercadopago' queda para pedidos antiguos.
alter table public.barraca_pedidos
  drop constraint if exists barraca_pedidos_metodo_pago_check,
  add constraint barraca_pedidos_metodo_pago_check
    check (metodo_pago in ('webpay', 'mercadopago', 'transferencia'));

-- Comprobante del pago (orden de compra, código de autorización, últimos 4
-- dígitos, tipo de pago y cuotas): lo que Transbank pide mostrar al comprador.
alter table public.barraca_pedidos
  add column if not exists pago_detalle jsonb;

-- Versión de los Términos que aceptó el comprador (art. 12 A): con la fecha
-- de terminos_aceptados_at permite saber qué texto rigió esa compra.
alter table public.barraca_pedidos
  add column if not exists terminos_version text;

-- -----------------------------------------------------------------------------
-- Pedido no aprobado por la barraca (Términos 8.4): estado 'rechazado' con un
-- motivo de una lista cerrada, y la devolución (reembolso) que se hizo.
-- -----------------------------------------------------------------------------
alter table public.barraca_pedidos
  drop constraint if exists barraca_pedidos_estado_check,
  add constraint barraca_pedidos_estado_check
    check (estado in (
      'pendiente_pago', 'pagado', 'pago_rechazado', 'pago_discrepancia',
      'en_preparacion', 'listo_retiro', 'despachado', 'entregado', 'cancelado', 'rechazado'
    ));

alter table public.barraca_pedidos
  add column if not exists rechazo_motivo text check (rechazo_motivo is null or rechazo_motivo in (
    'sin_stock', 'error_precio', 'sin_despacho', 'pago_fraude', 'datos_falsos', 'cantidad_maxima'
  )),
  add column if not exists rechazo_nota  text,
  add column if not exists rechazado_at  timestamptz,
  -- { estado: 'hecho' | 'pendiente' | 'error', medio: 'webpay' | 'transferencia', monto, tipo, fecha, autorizacion }
  add column if not exists reembolso     jsonb;

-- -----------------------------------------------------------------------------
-- Reserva de stock al confirmar un pedido por transferencia: se descuenta al
-- crearlo (no al pagarlo), así otro comprador no se lleva el mismo stock
-- mientras se espera la transferencia. Idempotente por stock_descontado; el
-- pago posterior no vuelve a descontar (barraca_pedido_marcar_pagado lo revisa).
-- -----------------------------------------------------------------------------
create or replace function public.barraca_pedido_reservar_stock(p_numero text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.barraca_pedidos%rowtype;
  it jsonb;
begin
  select * into v from public.barraca_pedidos where numero = p_numero for update;
  if not found then return 'no_encontrado'; end if;
  if v.stock_descontado then return 'ya_reservado'; end if;
  for it in select * from jsonb_array_elements(v.items) loop
    update public.barraca_productos
       set stock = greatest(0, coalesce(stock, 0) - (it->>'cantidad')::int)
     where id = (it->>'productoId')::bigint;
  end loop;
  update public.barraca_pedidos set stock_descontado = true where id = v.id;
  return 'reservado';
end $$;

-- -----------------------------------------------------------------------------
-- Cancelar o rechazar un pedido que todavía no sale de la barraca, y devolver
-- al stock lo que se había descontado o reservado. Atómico e idempotente.
-- Devuelve: 'ok' | 'no_encontrado' | 'estado_invalido'.
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
  if v.estado not in ('pendiente_pago', 'pago_rechazado', 'pago_discrepancia', 'pagado', 'en_preparacion', 'listo_retiro') then
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

revoke all on function public.barraca_pedido_reservar_stock(text) from public, anon, authenticated;
grant execute on function public.barraca_pedido_reservar_stock(text) to service_role;
revoke all on function public.barraca_pedido_cerrar(text, text, text, text) from public, anon, authenticated;
grant execute on function public.barraca_pedido_cerrar(text, text, text, text) to service_role;
