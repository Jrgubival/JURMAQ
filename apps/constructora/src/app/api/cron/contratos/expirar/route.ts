import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { logContratoEvent } from '@/lib/contratos-audit';

/**
 * POST /api/cron/contratos/expirar
 *
 * Cron job que transiciona contratos `vigente` o `firmado` cuya
 * `fecha_termino` ya pasó a estado `vencido`. Sin esto, los contratos
 * quedan "vigentes" indefinidamente y los reportes se distorsionan.
 *
 * Auth: header `x-cron-secret` contra env `CRON_SECRET`.
 *
 * Configurar en `vercel.json`:
 *   { "path": "/api/cron/contratos/expirar", "schedule": "0 3 * * *" }
 *   (3 AM CL diariamente).
 *
 * Bordes:
 * - `firmado` se incluye porque un contrato firmado pero nunca activado
 *   manualmente NO debería quedar vigente para siempre si la fecha_termino
 *   ya pasó. Es un escape para errores operativos.
 * - `anulado` se ignora siempre — no se "expira" lo cancelado.
 * - `vencido` se ignora — ya está en su estado terminal.
 * - Si querés re-correr el cron sin efectos, está bien (idempotente: filtra
 *   por estado, así que sólo afecta filas que aún no están en vencido).
 */

export const runtime = 'nodejs';
export const maxDuration = 30;

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
    // Fecha local Chile (America/Santiago) en formato YYYY-MM-DD. Comparamos
    // como string ISO porque fecha_termino es date (sin hora).
    const hoyCL = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });

    const { data, error } = await supabaseAdmin
      .from('contratos')
      .update({ estado: 'vencido', updated_at: new Date().toISOString() })
      .in('estado', ['vigente', 'firmado'])
      .lt('fecha_termino', hoyCL)
      .select('id, numero, estado, fecha_termino');

    if (error) {
      console.error('[cron-contratos-expirar] db error:', error);
      return NextResponse.json({ error: 'Error actualizando contratos' }, { status: 500 });
    }

    const expirados = data ?? [];

    // Audit log por cada contrato auto-expirado. Best-effort; no rompe la
    // respuesta si falla.
    await Promise.all(
      expirados.map((c) =>
        logContratoEvent(null, c.id as number, 'auto_expired', {
          fecha_termino: c.fecha_termino ? String(c.fecha_termino) : null,
          hoy_cl: hoyCL,
        })
      )
    );

    return NextResponse.json({
      processed: expirados.length,
      expirados: expirados.map((c) => ({ id: c.id, numero: c.numero, fecha_termino: c.fecha_termino })),
      ran_at: new Date().toISOString(),
      hoy_cl: hoyCL,
    });
  } catch (err) {
    console.error('[cron-contratos-expirar] error:', err);
    return NextResponse.json({ error: 'Error procesando expiración' }, { status: 500 });
  }
}
