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
