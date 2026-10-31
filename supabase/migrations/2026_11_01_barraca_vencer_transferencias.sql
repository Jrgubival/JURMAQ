-- Por qué se canceló un pedido (panel y Excel). Los "no aprobados" usan rechazo_motivo.
alter table public.barraca_pedidos
  add column if not exists cancelacion_motivo text;
alter table public.barraca_pedidos
  drop constraint if exists barraca_pedidos_cancelacion_motivo_chk;
alter table public.barraca_pedidos
  add constraint barraca_pedidos_cancelacion_motivo_chk
  check (cancelacion_motivo is null or cancelacion_motivo in ('cliente', 'transferencia_no_recibida', 'vencido', 'otro'));

-- Términos 8.3: un pedido por transferencia sin pagar a las 48 horas se anula
-- y su stock reservado vuelve a la venta. Todo dentro de la fila bloqueada:
-- si el cliente alcanzó a avisar "Ya transferí", ya no se toca.
create or replace function public.barraca_pedido_vencer(p_numero text, p_horas integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.barraca_pedidos%rowtype;
  it jsonb;
begin
  if p_horas is null or p_horas < 1 then return 'no_corresponde'; end if;
  select * into v from public.barraca_pedidos where numero = p_numero for update;
  if not found then return 'no_encontrado'; end if;
  if v.estado <> 'pendiente_pago'
     or v.metodo_pago <> 'transferencia'
     or v.created_at > now() - make_interval(hours => p_horas) then
    return 'no_corresponde';
  end if;
  if v.stock_descontado then
    for it in select * from jsonb_array_elements(v.items) loop
      update public.barraca_productos
         set stock = coalesce(stock, 0) + (it->>'cantidad')::int
       where id = (it->>'productoId')::bigint;
    end loop;
  end if;
  update public.barraca_pedidos
     set estado = 'cancelado', stock_descontado = false, cancelacion_motivo = 'vencido'
   where id = v.id;
  return 'vencido';
end $$;

revoke all on function public.barraca_pedido_vencer(text, integer) from public, anon, authenticated;
grant execute on function public.barraca_pedido_vencer(text, integer) to service_role;
