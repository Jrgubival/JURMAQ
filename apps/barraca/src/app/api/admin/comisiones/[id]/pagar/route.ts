import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin, sanitizeString } from '@jurmaq/shared/sanitize';

/**
 * POST /api/admin/comisiones/[id]/pagar
 *   body: { pago_referencia: 'TRX-12345' (opcional), notas?: string }
 *
 * Transición: devengada → pagada (solo desde devengada — no desde pendiente
 * ni anulada). Registra quién marcó + cuando + referencia del pago bancario.
 */

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const session = await requirePermission('barraca_comisiones', 'update');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const pagoRef = sanitizeString(body?.pago_referencia)?.trim() || null;
  const notasExtra = sanitizeString(body?.notas)?.trim() || null;

  // Verifica estado actual (solo devengada → pagada).
  const { data: actual, error: getErr } = await supabaseAdmin
    .from('comisiones_maestro')
    .select('id, estado, notas')
    .eq('id', id)
    .maybeSingle();

  if (getErr || !actual) {
    return NextResponse.json({ error: 'Comisión no encontrada' }, { status: 404 });
  }
  if (actual.estado !== 'devengada') {
    return NextResponse.json(
      { error: `No se puede marcar pagada desde estado '${actual.estado}' (debe ser 'devengada')` },
      { status: 409 },
    );
  }

  const userId = (session.user as { id?: string })?.id || null;
  const notasNuevas = [actual.notas, notasExtra].filter(Boolean).join(' | ') || null;

  const { error } = await supabaseAdmin
    .from('comisiones_maestro')
    .update({
      estado: 'pagada',
      pagada_at: new Date().toISOString(),
      pagada_by: userId,
      pago_referencia: pagoRef,
      notas: notasNuevas,
    })
    .eq('id', id)
    .eq('estado', 'devengada'); // doble-check (concurrencia)

  if (error) {
    console.error('[comision-pagar-fail]', error);
    return NextResponse.json({ error: 'Error marcando como pagada' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
