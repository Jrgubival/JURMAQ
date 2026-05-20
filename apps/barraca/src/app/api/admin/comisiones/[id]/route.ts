import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin, sanitizeString } from '@jurmaq/shared/sanitize';

/**
 * PATCH /api/admin/comisiones/[id]
 *   - Solo permite editar `notas` y `pago_referencia` (no monto ni estado —
 *     el estado se gestiona vía /pagar y el trigger automático).
 */

export const runtime = 'nodejs';

export async function PATCH(
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
  const update: Record<string, unknown> = {};

  if (typeof body.notas === 'string' || body.notas === null) {
    update.notas = body.notas ? sanitizeString(body.notas) : null;
  }
  if (typeof body.pago_referencia === 'string' || body.pago_referencia === null) {
    update.pago_referencia = body.pago_referencia
      ? sanitizeString(body.pago_referencia)?.trim()
      : null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Sin cambios' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('comisiones_maestro').update(update).eq('id', id);
  if (error) {
    console.error('[comision-patch-fail]', error);
    return NextResponse.json({ error: 'Error actualizando' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
