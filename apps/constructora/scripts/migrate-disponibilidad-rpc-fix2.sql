-- migrate-disponibilidad-rpc-fix2.sql
-- SUPERSEDE a migrate-disponibilidad-rpc-fix.sql (aplicada 2026-06-10).
--
-- Fixes sobre la v1 (hallazgos de revisión):
--
-- 1. BUG: la ventana de conflicto de cotizaciones ignoraba la columna `unidad`
--    y trataba las HORAS como DÍAS: una cotización aceptada de 8 horas
--    bloqueaba 8 días; y para unidad='dia' había off-by-one (N días
--    bloqueaban N+1). Ahora replica la aritmética del endpoint público
--    /api/public/maquinarias/[id]/disponibilidad (route.ts):
--      unidad='hora'  -> bloquea solo fecha_servicio (mismo día)
--      unidad='dia'   -> bloquea fecha_servicio .. fecha_servicio + ceil(unidades) - 1
--
-- 2. Hardening: SET search_path = '' (linter Supabase 0011); las tablas ya
--    estaban calificadas con public.
--
-- 3. REVOKE de anon/authenticated: la app llama SOLO vía service_role
--    (pricing-arriendo.ts). El GRANT amplio de la v1 no se usaba y dejaba
--    expuesto el RPC en PostgREST si algún día las tablas dieran SELECT a
--    esos roles (números de cotización/contrato y motivos de bloqueo).
--
-- Aplicar: ejecutar el contenido en Supabase Dashboard → SQL Editor.

BEGIN;

CREATE OR REPLACE FUNCTION public.verificar_disponibilidad_maquinaria(
  p_maquinaria_id integer,
  p_fecha_inicio date,
  p_fecha_fin date
)
RETURNS TABLE (
  disponible boolean,
  conflictos jsonb
)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_bloqueo_conflictos    jsonb;
  v_cotizacion_conflictos jsonb;
  v_contrato_conflictos   jsonb;
  v_hay_conflicto         boolean;
BEGIN
  -- Conflictos de mantención (bloqueos_maquinaria)
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object(
      'tipo',          'bloqueo',
      'fecha_inicio',  b.fecha_inicio,
      'fecha_fin',     b.fecha_fin,
      'motivo',        b.motivo
    )),
    '[]'::jsonb
  )
  INTO v_bloqueo_conflictos
  FROM public.bloqueos_maquinaria b
  WHERE b.maquinaria_id = p_maquinaria_id
    AND b.fecha_inicio <= p_fecha_fin
    AND b.fecha_fin   >= p_fecha_inicio;

  -- Conflictos por cotizaciones aceptadas/en proceso (cotizaciones_arriendo).
  -- Ventana ocupada: misma aritmética que el calendario público (route.ts):
  --   hora -> solo el día de fecha_servicio; dia -> ceil(unidades) días inclusive.
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object(
      'tipo',            'cotizacion',
      'numero',          c.numero,
      'fecha_servicio',  c.fecha_servicio,
      'estado',          c.estado
    )),
    '[]'::jsonb
  )
  INTO v_cotizacion_conflictos
  FROM public.cotizaciones_arriendo c
  WHERE c.maquinaria_id = p_maquinaria_id
    AND c.estado IN ('aceptada', 'contrato_creado', 'finalizada')
    AND c.fecha_servicio <= p_fecha_fin
    AND (
      c.fecha_servicio
      + (CASE
           WHEN c.unidad = 'dia'
             THEN GREATEST(CEIL(COALESCE(c.unidades_solicitadas, 1))::int, 1) - 1
           ELSE 0
         END) * interval '1 day'
    ) >= p_fecha_inicio;

  -- Conflictos por contratos firmados/vigentes
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object(
      'tipo',           'contrato',
      'numero',         k.numero,
      'fecha_inicio',   k.fecha_inicio,
      'fecha_termino',  k.fecha_termino,
      'estado',         k.estado
    )),
    '[]'::jsonb
  )
  INTO v_contrato_conflictos
  FROM public.contratos k
  WHERE k.maquinaria_id = p_maquinaria_id
    AND k.estado IN ('firmado', 'vigente', 'en_entrega', 'en_devolucion')
    AND k.fecha_inicio  <= p_fecha_fin
    AND k.fecha_termino >= p_fecha_inicio;

  v_hay_conflicto :=
    jsonb_array_length(v_bloqueo_conflictos)    > 0
    OR jsonb_array_length(v_cotizacion_conflictos) > 0
    OR jsonb_array_length(v_contrato_conflictos)   > 0;

  RETURN QUERY SELECT
    NOT v_hay_conflicto,
    (v_bloqueo_conflictos || v_cotizacion_conflictos || v_contrato_conflictos);
END;
$$;

-- La app llama SOLO con service_role; anon/authenticated no la necesitan y
-- exponerla en PostgREST es riesgo latente (fuga de números/motivos internos).
REVOKE EXECUTE ON FUNCTION public.verificar_disponibilidad_maquinaria(integer, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verificar_disponibilidad_maquinaria(integer, date, date) TO service_role;

COMMIT;

-- Verificación post-aplicación (con una cotización ACEPTADA de N horas el día D):
--   SELECT * FROM verificar_disponibilidad_maquinaria(<maq>, D, D);          -- disponible = false
--   SELECT * FROM verificar_disponibilidad_maquinaria(<maq>, D+1, D+5);      -- disponible = true (la v1 daba false)
