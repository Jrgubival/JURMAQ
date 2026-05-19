-- migrate-disponibilidad-rpc-fix.sql
--
-- Fix B-1 del Sprint 1 (race condition de disponibilidad):
--
-- 1. Crea la función `verificar_disponibilidad_maquinaria` que es la que la
--    app llama hoy (pricing-arriendo.ts:144). Hasta ahora caía silenciosamente
--    al "disponible: true" porque la función no existía con ese nombre — el
--    bug estaba enmascarado por el handler de error en TS que devuelve
--    `disponible: true` en cualquier fallo. Resultado: la app NO chequeaba
--    disponibilidad.
--
-- 2. Extiende el chequeo para considerar también `contratos` cuyo rango
--    fecha_inicio..fecha_termino se solape con la ventana solicitada,
--    cuando estado IN ('firmado','vigente'). Sin esto, 2 cotizaciones
--    simultáneas pueden firmarse ambas para la misma máquina.
--
-- 3. Mantiene la función `verificar_disponibilidad` (sin sufijo) intacta
--    porque puede haber código legacy / consultas SQL ad-hoc que la usan.
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

  -- Conflictos por cotizaciones aceptadas/en proceso (cotizaciones_arriendo)
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
    AND (c.fecha_servicio + (COALESCE(c.unidades_solicitadas, 1) * interval '1 day')) >= p_fecha_inicio;

  -- NUEVO (B-1): conflictos por contratos firmados/vigentes
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

-- Permisos: la app llama vía service_role; igualmente permitimos a anon para
-- que el wizard público pueda consultar disponibilidad. La función es STABLE
-- y solo lee — no expone datos sensibles más allá de números de cotización.
GRANT EXECUTE ON FUNCTION public.verificar_disponibilidad_maquinaria(integer, date, date) TO anon, authenticated, service_role;

COMMIT;

-- Verificación post-aplicación:
--   SELECT * FROM verificar_disponibilidad_maquinaria(1, '2026-06-01', '2026-06-10');
--   Debería devolver una fila con disponible (bool) y conflictos (jsonb array).
