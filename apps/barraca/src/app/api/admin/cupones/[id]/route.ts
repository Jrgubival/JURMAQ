import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';

export const runtime = 'nodejs';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const session = await requirePermission('barraca_promociones', 'update');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  if (typeof body.activo === 'boolean') update.activo = body.activo;
  if (typeof body.descripcion === 'string') update.descripcion = body.descripcion;
  if (typeof body.valido_hasta === 'string' || body.valido_hasta === null) {
    update.valido_hasta = body.valido_hasta;
  }
  if (typeof body.max_usos_total === 'number' || body.max_usos_total === null) {
    update.max_usos_total = body.max_usos_total;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Sin cambios' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('barraca_cupones')
    .update(update)
    .eq('id', id);

  if (error) return NextResponse.json({ error: 'Error actualizando' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requirePermission('barraca_promociones', 'delete');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { id } = await params;
  // Soft-delete: marca activo=false en vez de borrar (preserva histórico de usos).
  const { error } = await supabaseAdmin
    .from('barraca_cupones')
    .update({ activo: false })
    .eq('id', id);

  if (error) return NextResponse.json({ error: 'Error desactivando' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
