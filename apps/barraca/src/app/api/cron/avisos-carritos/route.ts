import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { env } from '@jurmaq/shared/env';
import { safeSecretEquals } from '@jurmaq/shared/crypto/secret';
import { createAdminNotification } from '@jurmaq/shared/notifications/admin';
import { sendCarritoAvisoAdminEmail } from '@jurmaq/shared/mail/templates/carrito-aviso-admin';

/**
 * POST /api/cron/avisos-carritos (cada 30 min, desde custom-worker.ts)
 *
 * Aviso INTERNO (no al cliente) cuando queda un carrito sin pagar de $50.000 o
 * más y hay un dato de contacto (correo o teléfono). Una sola vez por carrito:
 * se anota con una notificación del panel (kind carrito_sin_pagar, ref_id = id
 * del carrito) y antes de avisar se revisa que no exista. Sólo mira carritos
 * con actividad entre 1 hora y 24 horas atrás, para no avisar de los viejos.
 * No toca los recordatorios al cliente (/api/cron/carrito-recovery).
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

const TOTAL_MINIMO = 50000;
const KIND = 'carrito_sin_pagar';

function isAuthorized(request: NextRequest): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return false;
  const provided =
    request.headers.get('x-cron-secret') ||
    request.headers.get('authorization')?.replace('Bearer ', '');
  return safeSecretEquals(provided, secret);
}

interface Carrito {
  id: string;
  email: string | null;
  telefono: string | null;
  items: Array<{ nombre?: string; cantidad?: number; precio?: number }> | null;
  total: number;
}

export const GET = (request: NextRequest) => POST(request);

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const ahora = Date.now();
  const desde = new Date(ahora - 24 * 3600 * 1000).toISOString();
  const hasta = new Date(ahora - 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('barraca_carrito_abandonado')
    .select('id, email, telefono, items, total')
    .is('converted_at', null)
    .gte('total', TOTAL_MINIMO)
    .gte('last_activity', desde)
    .lte('last_activity', hasta)
    .limit(25);
  if (error) {
    console.error('[avisos-carritos-query-fail]', String(error));
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const carritos = ((data as Carrito[]) ?? []).filter(
    (c) => (c.email && c.email.trim()) || (c.telefono && c.telefono.trim()),
  );
  if (carritos.length === 0) return NextResponse.json({ ok: true, avisados: 0 });

  const { data: ya } = await supabaseAdmin
    .from('admin_notifications')
    .select('ref_id')
    .eq('kind', KIND)
    .in('ref_id', carritos.map((c) => c.id));
  const avisados = new Set(((ya as Array<{ ref_id: string }>) ?? []).map((r) => r.ref_id));

  let enviados = 0;
  for (const c of carritos) {
    if (avisados.has(c.id)) continue;
    try {
      // Se anota primero: si el correo falla se pierde un aviso, pero nunca se repite.
      const nota = await createAdminNotification({
        kind: KIND,
        title: `Carrito sin pagar de $${Number(c.total).toLocaleString('es-CL')}`,
        body: c.telefono ? 'Dejó teléfono' : 'Dejó solo correo',
        link: '/admin',
        severity: 'info',
        ref_type: 'carrito',
        ref_id: c.id,
      });
      if (!nota.ok) continue;
      await sendCarritoAvisoAdminEmail({
        email: c.email?.trim() || undefined,
        telefono: c.telefono?.trim() || undefined,
        total: Number(c.total),
        items: c.items ?? [],
      });
      enviados++;
    } catch (err) {
      console.error('[avisos-carritos-send-fail]', c.id, err instanceof Error ? err.message : String(err));
    }
  }
  return NextResponse.json({ ok: true, avisados: enviados });
}
