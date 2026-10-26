-- =============================================================================
-- Migration: barraca_pedidos
-- Date:      2026-10-26
-- Purpose:   Pedidos de la tienda en línea de barraca.jurmaq.cl (carrito →
--            checkout → pago). Reemplaza al flujo de cotización por WhatsApp.
-- Status:    PENDING — NO APLICADA. Aplicar desde Supabase Dashboard → SQL
--            Editor cuando se apruebe la salida de la tienda. Es idempotente
--            (se puede correr dos veces). Copia en apps/barraca/scripts/.
-- =============================================================================

create table if not exists public.barraca_pedidos (
  id                  bigint generated always as identity primary key,
  numero              text not null unique,
  -- sha256 del token de acceso que queda en una cookie httpOnly del comprador.
  -- Con él (y sólo con él) se ve la página de confirmación del pedido.
  acceso_hash         text not null,
  estado              text not null default 'pendiente_pago'
                      check (estado in (
                        'pendiente_pago', 'pagado', 'pago_rechazado', 'pago_discrepancia',
                        'en_preparacion', 'listo_retiro', 'despachado', 'entregado', 'cancelado'
                      )),
  metodo_pago         text not null check (metodo_pago in ('mercadopago', 'transferencia')),
  pasarela            text,            -- 'mercadopago' | 'webpay' | ...
  pasarela_referencia text,            -- id de preferencia / token de la transacción
  pago_id             text,            -- id del pago aprobado en la pasarela
  pagado_at           timestamptz,
  entrega             text not null check (entrega in ('retiro', 'despacho')),
  direccion           text,
  comuna              text,
  nombre              text not null,
  rut                 text,
  telefono            text not null,
  email               text not null,
  notas               text,
  -- [{productoId, codigo, nombre, medida, unidad, cantidad, precio, subtotal}]
  items               jsonb not null,
  subtotal            integer not null check (subtotal >= 0),
  costo_despacho      integer,         -- null = a coordinar
  total               integer not null check (total > 0),
  stock_descontado    boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists barraca_pedidos_estado_idx on public.barraca_pedidos (estado, created_at desc);
create index if not exists barraca_pedidos_created_idx on public.barraca_pedidos (created_at desc);

-- Sólo el servidor (service_role) lee y escribe. Sin policies = anon y
-- authenticated no ven nada.
alter table public.barraca_pedidos enable row level security;

create or replace function public.barraca_pedidos_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists barraca_pedidos_touch on public.barraca_pedidos;
create trigger barraca_pedidos_touch before update on public.barraca_pedidos
  for each row execute function public.barraca_pedidos_touch();

-- -----------------------------------------------------------------------------
-- Marcar pagado + descontar stock, en una sola transacción.
--
-- Idempotente: si el pedido ya no está pendiente devuelve 'ya_procesado' y no
-- vuelve a descontar. Si el monto no cuadra con el total (tolerancia $1) lo
-- deja en 'pago_discrepancia' para revisión manual y NO lo marca pagado.
-- Devuelve: 'pagado' | 'ya_procesado' | 'monto_distinto' | 'no_encontrado'.
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
  if v.estado not in ('pendiente_pago', 'pago_rechazado') then
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
