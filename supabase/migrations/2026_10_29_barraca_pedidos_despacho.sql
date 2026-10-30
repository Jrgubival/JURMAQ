-- Despacho con costo en la tienda barraca: cómo viaja el pedido (camión propio
-- o courier), la comuna por código y el seguimiento del courier.
-- Aplicar DESPUÉS de 2026_10_26_barraca_pedidos.sql (SQL Editor de Supabase).

alter table public.barraca_pedidos
  add column if not exists despacho_tipo       text check (despacho_tipo in ('propio', 'courier')),
  add column if not exists comuna_codigo       text,
  add column if not exists courier             text,            -- 'enviame' | 'simulado'
  add column if not exists courier_seguimiento text;

-- El total siempre es productos + despacho (despacho null = a coordinar, no suma).
alter table public.barraca_pedidos
  drop constraint if exists barraca_pedidos_total_cuadra,
  add constraint barraca_pedidos_total_cuadra
    check (total = subtotal + coalesce(costo_despacho, 0));

-- Aceptación de Términos y Privacidad (obligatoria, art. 12 A Ley 19.496) y
-- consentimiento aparte para recordatorios y ofertas por correo.
alter table public.barraca_pedidos
  add column if not exists terminos_aceptados_at timestamptz,
  add column if not exists acepta_ofertas        boolean not null default false;

-- Envío por courier (Envíame): servicio cotizado, caja cotizada, etiqueta e id del envío.
alter table public.barraca_pedidos
  add column if not exists courier_servicio     text,            -- ej. 'BLX:priority' (transportista:servicio)
  add column if not exists courier_paquete      jsonb,           -- { pesoKg, largoCm, anchoCm, altoCm, volumenM3, unidades }
  add column if not exists courier_etiqueta_url text check (courier_etiqueta_url is null or courier_etiqueta_url like 'https://%'),
  add column if not exists courier_envio_id     text;

-- Tamaño de envío por producto. Sin tamaño (ni peso y medidas reales) el
-- producto no sale por courier: sólo retiro o camión propio. `peso` (kg) ya existe.
alter table public.barraca_productos
  add column if not exists tamano_envio text check (tamano_envio in ('chico', 'mediano', 'grande')),
  add column if not exists largo_cm     numeric check (largo_cm is null or largo_cm > 0),
  add column if not exists ancho_cm     numeric check (ancho_cm is null or ancho_cm > 0),
  add column if not exists alto_cm      numeric check (alto_cm is null or alto_cm > 0);
