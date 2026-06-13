import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { createAdminNotificationIfNew } from '@jurmaq/shared/notifications/admin';
import { env } from '@jurmaq/shared/env';
import { safeSecretEquals } from '@jurmaq/shared/crypto/secret';

/**
 * POST /api/cron/mantenciones-alerta
 *
 * Tier 6 F4: alerta admin de mantenciones programadas en próximos 7 días.
 * Idempotente vía dedup 24h por (ref_type='mantencion', ref_id=<id>).
 *
 * Auth: header x-cron-secret. Schedule sugerido: 1 vez al día (8 AM).
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return false;
  const provided =
    request.headers.get('x-cron-secret') ||
    request.headers.get('authorization')?.replace('Bearer ', '');
  return safeSecretEquals(provided, secret);
}

interface ProximaRow {
  id: string;
  maquinaria_id: number;
  tipo: string;
  proxima_mantencion_at: string;
  maquinarias?: { nombre: string } | null;
}

// Vercel Cron invoca con GET; aceptamos ambos métodos. La autenticación real
// es vía CRON_SECRET en isAuthorized(), no por el método HTTP.
export const GET = (request: NextRequest) => POST(request);

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const now = new Date();
  const en7Dias = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const hoy = now.toISOString().slice(0, 10);

  // Trae mantenciones próximas en ventana [hoy, hoy+7d] con embed de la
  // máquina para el título de la notif.
  const { data: proximasRaw } = await supabaseAdmin
    .from('maquinaria_mantenciones')
    .select('id, maquinaria_id, tipo, proxima_mantencion_at, maquinarias:maquinaria_id(nombre)')
    .gte('proxima_mantencion_at', hoy)
    .lte('proxima_mantencion_at', en7Dias)
    .limit(100);

  const proximas = (proximasRaw ?? []) as unknown as ProximaRow[];

  const stats = { checked: proximas.length, created: 0, deduplicated: 0 };

  for (const p of proximas) {
    const fecha = new Date(p.proxima_mantencion_at);
    const dias = Math.ceil((fecha.getTime() - now.getTime()) / (24 * 3600 * 1000));
    const maqNombre = p.maquinarias?.nombre || `Máquina #${p.maquinaria_id}`;

    const result = await createAdminNotificationIfNew({
      kind: 'mantencion_proxima',
      title: dias <= 0
        ? `🚨 Mantención HOY: ${maqNombre}`
        : `Mantención en ${dias}d: ${maqNombre}`,
      body: `Pauta programada (${p.tipo.replace('_', ' ')}) para el ${fecha.toLocaleDateString('es-CL')}`,
      link: `/admin/maquinarias/${p.maquinaria_id}`,
      severity: dias <= 3 ? 'warning' : 'info',
      ref_type: 'mantencion',
      ref_id: String(p.id),
      dedupHours: 24 * 3, // No re-notifico la misma mantención en 3 días
    });

    if (result.deduplicated) stats.deduplicated++;
    else if (result.ok) stats.created++;
  }

  return NextResponse.json({ ok: true, ...stats });
}
