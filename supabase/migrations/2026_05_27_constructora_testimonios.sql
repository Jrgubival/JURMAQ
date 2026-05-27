-- =============================================================================
-- Migration: constructora_testimonios
-- Date:      2026-05-27
-- Author:    Jorge Ubilla
-- Purpose:   Tabla pública de testimonios B2B de clientes de JURMAQ Constructora.
--            Distinta de `barraca_reviews` (esa es de productos, scope retail).
--            Esta tabla cubre testimonios narrativos de empresas (Nestlé,
--            Miguel Torres, Iansagro, Surfrut, CBB) sobre obras civiles.
-- Status:    PENDING — NO APLICADA en Supabase aún. Aplicar manualmente desde el
--            dashboard cuando se confirme el modelo de datos. La data inicial de
--            INSERTS abajo coincide con el contenido estático en:
--               apps/constructora/src/lib/testimonios-data.ts
--            Una vez aplicada, refactorizar `TestimoniosGrid` para leer desde DB
--            en lugar del fallback estático.
-- =============================================================================

create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------------
-- Tabla
-- -----------------------------------------------------------------------------
create table if not exists public.constructora_testimonios (
  id            uuid primary key default uuid_generate_v4(),
  autor_nombre  text not null,
  autor_cargo   text not null,
  autor_empresa text not null,
  -- Logo en /images/clientes/. Validación de path en aplicación, no en DB.
  empresa_logo  text,
  texto         text not null check (char_length(texto) between 40 and 800),
  rating        smallint not null check (rating between 1 and 5),
  -- Slug de un case study en apps/constructora/src/lib/proyectos-data.ts.
  -- No es FK porque proyectos viven en código, no en DB.
  proyecto_slug text,
  destacado     boolean not null default false,
  activo        boolean not null default true,
  fecha         date not null default current_date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Índice para el listing público (ordena por destacado primero, luego fecha desc).
create index if not exists idx_constructora_testimonios_publico
  on public.constructora_testimonios (activo, destacado desc, fecha desc)
  where activo = true;

-- Trigger para mantener updated_at fresco.
create or replace function public.set_updated_at_constructora_testimonios()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_constructora_testimonios_updated_at
  on public.constructora_testimonios;

create trigger trg_constructora_testimonios_updated_at
  before update on public.constructora_testimonios
  for each row execute function public.set_updated_at_constructora_testimonios();

-- -----------------------------------------------------------------------------
-- RLS — anon puede SELECT solo testimonios activos; INSERT/UPDATE/DELETE solo
-- desde service role (admin panel server-side).
-- -----------------------------------------------------------------------------
alter table public.constructora_testimonios enable row level security;

drop policy if exists "anon_select_activos"
  on public.constructora_testimonios;

create policy "anon_select_activos"
  on public.constructora_testimonios
  for select
  to anon, authenticated
  using (activo = true);

-- Mutaciones únicamente vía service_role (server admin). No se crean policies
-- para anon/authenticated en INSERT/UPDATE/DELETE — eso lo controla el admin
-- panel server-side con SUPABASE_SERVICE_ROLE_KEY.

-- -----------------------------------------------------------------------------
-- Seed inicial — coincide con apps/constructora/src/lib/testimonios-data.ts.
-- IMPORTANTE: estos textos son placeholders REALISTAS pero NO firmados por
-- personas reales. Antes de marcar `activo = true` en producción, Jorge debe:
--   1. Obtener autorización escrita de cada autor para usar nombre + cargo.
--   2. O reemplazar el texto/autor con uno real ya firmado.
-- -----------------------------------------------------------------------------
insert into public.constructora_testimonios
  (autor_nombre, autor_cargo, autor_empresa, empresa_logo, texto, rating, proyecto_slug, destacado, activo, fecha)
values
  (
    'Equipo de Proyectos · Planta Teno',
    'Inspección Técnica de Obra',
    'Nestlé Chile',
    '/images/clientes/nestle.png',
    'Coordinaron las fundaciones de silos y la expansión de batcheo sin detener un solo día la producción. Cumplieron plazo y entregaron la obra sin observaciones técnicas. Esa combinación de capacidad operativa y disciplina de plazos es lo que buscamos en un partner industrial.',
    5,
    'nestle-teno-fundaciones-silos',
    true,
    false, -- inactivo hasta confirmar autorización del autor
    '2024-12-15'
  ),
  (
    'Gerencia de Operaciones',
    'Vinícola Miguel Torres',
    'Vinícola Miguel Torres',
    '/images/clientes/miguel-torres.png',
    'El traslado de las cubas de 50.000 litros fue impecable. Lograron coordinar la maniobra en la ventana de 72 horas que necesitábamos fuera de vendimia, sin un solo daño. La bodega quedó habilitada antes del inicio de la temporada siguiente.',
    5,
    'miguel-torres-bodega-cubas',
    false,
    false,
    '2024-10-02'
  ),
  (
    'Jefatura de Mantención',
    'Planta Iansagro Maule',
    'Iansagro S.A.',
    '/images/clientes/iansa.webp',
    'Llevamos varios años con JURMAQ como contratista de mantención permanente. Lo que más valoramos es la respuesta rápida ante emergencias — tienen cuadrilla y maquinaria disponible siempre, sin depender de terceros. Ese tipo de confiabilidad es difícil de encontrar.',
    5,
    'iansagro-mantencion-industrial',
    true,
    false,
    '2024-08-20'
  ),
  (
    'Gerencia Técnica',
    'Surfrut Romeral',
    'Surfrut',
    '/images/clientes/surfrut.svg',
    'La bodega refrigerada de 1.800 m² se entregó antes del inicio de la cosecha. Coordinaron impecablemente con nuestros instaladores de equipos de refrigeración — cero retrabajos. Las cámaras certificaron -25°C en la primera medición.',
    5,
    'surfrut-romeral-obras',
    false,
    false,
    '2024-11-25'
  ),
  (
    'Equipo de Ingeniería',
    'Cementos Biobío Curicó',
    'Cementos Biobío (CBB)',
    '/images/clientes/cbb-cementos.png',
    'Modernizamos los silos y la nueva tolva sin detener el despacho de camiones. JURMAQ supo coordinar sus intervenciones con nuestras paradas técnicas programadas. Plazo de 4 meses cumplido exactamente.',
    5,
    'cementos-biobio-mantencion',
    false,
    false,
    '2025-03-10'
  ),
  (
    'Gerencia',
    'Empresa Agroindustrial · Curicó',
    'Cliente histórico',
    null,
    'Trabajamos con JURMAQ desde hace más de 8 años. Lo que los diferencia es que cubren todas las áreas: obra civil, arriendo de máquinas, maestranza y materiales desde su barraca. Un solo proveedor responde por el ciclo completo de cada obra. Reduce coordinación a la mitad.',
    5,
    null,
    false,
    false,
    '2023-11-05'
  )
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- ROLLBACK (manual, no automático):
-- drop trigger if exists trg_constructora_testimonios_updated_at on public.constructora_testimonios;
-- drop function if exists public.set_updated_at_constructora_testimonios();
-- drop index  if exists public.idx_constructora_testimonios_publico;
-- drop table  if exists public.constructora_testimonios;
-- -----------------------------------------------------------------------------
