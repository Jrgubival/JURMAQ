import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { logContratoEvent } from '@/lib/contratos-audit';
import { hid } from '@jurmaq/shared/logging';

/**
 * POST /api/cron/cedulas/purgar
 *
 * Fix L-1: política de retención de cédulas. Ley 19.628 exige no retener
 * datos personales (foto de cédula = dato sensible) más allá del tiempo
 * estrictamente necesario para la finalidad.
 *
 * Plazo: 90 días post-firma. Después, borramos el archivo del bucket
 * `cedulas-firma`, anulamos `cedula_url` y marcamos `cedula_purged_at`.
 *
 * `cedula_hash` se mantiene — es un SHA-256, no permite reconstruir la
 * imagen, y es parte de la cadena de evidencia que valida `firma_hash`.
 *
 * Auth: header `x-cron-secret` contra env `CRON_SECRET`.
 *
 * Configurar en `vercel.json`: cron diario a las 4 AM.
 *   { "path": "/api/cron/cedulas/purgar", "schedule": "0 4 * * *" }
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

const BATCH_SIZE = 25;
const RETENTION_DAYS = 90;
const BUCKET = 'cedulas-firma';

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided =
    request.headers.get('x-cron-secret') ||
    request.headers.get('authorization')?.replace('Bearer ', '');
  return provided === secret;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const corteISO = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Selecciona contratos donde la cédula sigue almacenada y la firma es
    // suficientemente antigua. Limitamos por lote para no exceder
    // maxDuration en bursts de storage delete.
    const { data: pendientes, error: selErr } = await supabaseAdmin
      .from('contratos')
      .select('id, numero, cedula_url, firma_timestamp')
      .not('cedula_url', 'is', null)
      .is('cedula_purged_at', null)
      .lt('firma_timestamp', corteISO)
      .limit(BATCH_SIZE);

    if (selErr) {
      console.error('[cron-cedulas-purgar] select error:', selErr);
      return NextResponse.json({ error: 'Error buscando contratos elegibles' }, { status: 500 });
    }

    if (!pendientes || pendientes.length === 0) {
      return NextResponse.json({ processed: 0, ran_at: new Date().toISOString() });
    }

    let borrados = 0;
    let fallas = 0;
    const detalles: Array<{ id: number; numero: string; status: string; error?: string }> = [];

    for (const c of pendientes) {
      try {
        // Borrar del Storage. Si el archivo no existe (ya borrado fuera del
        // sistema), tratamos como éxito y avanzamos.
        const { error: storageErr } = await supabaseAdmin.storage.from(BUCKET).remove([c.cedula_url as string]);
        if (storageErr && !/not found|object not found/i.test(storageErr.message)) {
          throw new Error(`storage: ${storageErr.message}`);
        }

        // Anular cedula_url y marcar purged_at. Mantener cedula_hash.
        const purgedAt = new Date().toISOString();
        const { error: updErr } = await supabaseAdmin
          .from('contratos')
          .update({
            cedula_url: null,
            cedula_purged_at: purgedAt,
          })
          .eq('id', c.id);
        if (updErr) throw new Error(`db: ${updErr.message}`);

        // Audit log — best effort.
        await logContratoEvent(null, c.id as number, 'cedula_purged', {
          retention_days: RETENTION_DAYS,
          firma_timestamp: c.firma_timestamp ? String(c.firma_timestamp) : null,
        });

        borrados++;
        detalles.push({ id: c.id as number, numero: c.numero as string, status: 'purged' });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[cron-cedulas-purgar-fail]', hid(c.id), msg);
        fallas++;
        detalles.push({ id: c.id as number, numero: c.numero as string, status: 'failed', error: msg });
      }
    }

    return NextResponse.json({
      processed: pendientes.length,
      borrados,
      fallas,
      detalles,
      ran_at: new Date().toISOString(),
      cutoff_iso: corteISO,
    });
  } catch (err) {
    console.error('[cron-cedulas-purgar] fatal:', err);
    return NextResponse.json({ error: 'Error procesando purga' }, { status: 500 });
  }
}
