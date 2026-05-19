-- migrate-contrato-html-snapshot.sql
--
-- Fix B-2 del Sprint 1 (versionado de templates de contrato).
--
-- Sin esto: si admin edita un contrato_template después que un contrato fue
-- firmado, la próxima vez que se genere el PDF (admin descarga, o cliente
-- pide copia), el HTML renderizado va a usar el TEMPLATE NUEVO con los datos
-- del contrato VIEJO. Eso rompe la integridad visual del contrato firmado
-- aunque `firma_hash` siga apuntando al render original. Riesgo legal en
-- disputa: cliente alega "yo nunca firmé esto" mostrando el PDF re-generado
-- que es visualmente distinto al que firmó.
--
-- Fix: snapshot del HTML interpolado AL MOMENTO DE FIRMAR. La generación de
-- PDF posterior usa este snapshot directamente, no re-renderiza desde el
-- template.
--
-- Aplicar: ejecutar en Supabase Dashboard → SQL Editor.

BEGIN;

ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS contrato_html_snapshot text;

-- Comentario para futuros DBA.
COMMENT ON COLUMN public.contratos.contrato_html_snapshot IS
  'Snapshot del HTML del contrato AL MOMENTO DE FIRMAR (sin las imágenes de firma — éstas se inyectan al renderizar). Sólo se llena cuando el contrato pasa a estado=firmado. Si es NULL en un contrato firmado, significa que el contrato es anterior al fix B-2 y la regeneración del PDF aún usa el template vivo.';

-- Nota: NO hacemos backfill del snapshot para contratos ya firmados con
-- NULL — esos PDFs siguen regenerándose desde template, que es el
-- comportamiento legacy. Esto es deliberado: no podemos reconstruir
-- exactamente qué HTML se firmó en su momento si el template cambió desde.

COMMIT;

-- Verificación:
--   SELECT count(*) FROM contratos WHERE contrato_html_snapshot IS NOT NULL;
--   (debe ser 0 inicialmente, sube a medida que se firman contratos nuevos)
