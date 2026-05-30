-- migrate-contrato-numero.sql
-- Fix auditoría 2.4: el número de contrato se generaba con COUNT(*)+1 en el
-- código (api/admin/contratos/route.ts), lo que produce COLISIONES bajo
-- concurrencia (dos creaciones simultáneas → mismo CON-YYYYMMDD-NNN) y, sin
-- constraint UNIQUE, duplicados silenciosos.
--
-- Esta migración:
--   1) Crea la función atómica next_contrato_numero() con advisory lock
--      transaccional para serializar la generación (race-free, a diferencia del
--      MAX+1 simple de las cotizaciones).
--   2) Agrega un índice UNIQUE en contratos.numero como red de seguridad.
--
-- Idempotente: se puede correr varias veces.
-- Ejecutar en el proyecto Supabase (constructora) ANTES de desplegar el cambio
-- de código; el route tiene fallback si la función aún no existe.

-- 1) Función atómica de numeración (formato CON-YYYYMMDD-NNN, contador diario).
CREATE OR REPLACE FUNCTION public.next_contrato_numero()
RETURNS text AS $$
DECLARE
  date_str text;
  next_n integer;
  formatted text;
BEGIN
  -- Serializa la generación entre transacciones concurrentes. El lock se libera
  -- automáticamente al COMMIT/ROLLBACK de la transacción que llama.
  PERFORM pg_advisory_xact_lock(hashtext('contrato_numero'));

  date_str := to_char(now() AT TIME ZONE 'America/Santiago', 'YYYYMMDD');

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(numero FROM 'CON-' || date_str || '-(\d+)') AS integer)
  ), 0) + 1 INTO next_n
  FROM public.contratos
  WHERE numero LIKE 'CON-' || date_str || '-%';

  formatted := 'CON-' || date_str || '-' || LPAD(next_n::text, 3, '0');
  RETURN formatted;
END;
$$ LANGUAGE plpgsql;

-- 2) Constraint UNIQUE en numero (red de seguridad anti-duplicado).
-- Si existen duplicados previos, este índice fallará: limpiarlos primero.
CREATE UNIQUE INDEX IF NOT EXISTS contratos_numero_key ON public.contratos (numero);
