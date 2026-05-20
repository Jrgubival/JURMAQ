import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin, sanitizeString } from '@jurmaq/shared/sanitize';

/**
 * PATCH /api/admin/reviews/[id]
 *   body: { estado: 'aprobada'|'rechazada', notas_moderacion? }
 *
 * DELETE /api/admin/reviews/[id] — borrado físico (solo casos extremos: spam,
 *   contenido ilegal). El default debe ser estado='rechazada' (soft).
 */

export const runtime = 'nodejs';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const session = await requirePermission('barraca_reviews', 'update');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const update: Record<string, unknown> = {};
  if (typeof body.estado === 'string' && ['aprobada', 'rechazada', 'pendiente'].includes(body.estado)) {
    update.estado = body.estado;
    update.moderado_at = new Date().toISOString();
    update.moderado_by = (session.user as { id?: string })?.id || null;
  }
  if (typeof body.notas_moderacion === 'string' || body.notas_moderacion === null) {
    update.notas_moderacion = body.notas_moderacion
      ? sanitizeString(body.notas_moderacion)
      : null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Sin cambios' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('barraca_reviews')
    .update(update)
    .eq('id', id);

  if (error) {
    console.error('[review-moderar-fail]', error);
    return NextResponse.json({ error: 'Error moderando' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requirePermission('barraca_reviews', 'delete');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { id } = await params;
  const { error } = await supabaseAdmin.from('barraca_reviews').delete().eq('id', id);
  if (error) {
    console.error('[review-delete-fail]', error);
    return NextResponse.json({ error: 'Error eliminando' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
