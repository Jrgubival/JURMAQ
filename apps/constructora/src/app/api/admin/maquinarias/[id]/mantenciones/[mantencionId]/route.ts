import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin, sanitizeString } from '@jurmaq/shared/sanitize';

/**
 * DELETE /api/admin/maquinarias/[id]/mantenciones/[mantencionId]
 * PUT    /api/admin/maquinarias/[id]/mantenciones/[mantencionId]
 *
 * Solo gerente/admin pueden borrar registros (auditoría histórica).
 */

export const runtime = 'nodejs';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; mantencionId: string }> },
) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const session = await requirePermission('maquinarias', 'update');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { id: rawId, mantencionId } = await params;
  const maquinariaId = Number(rawId);
  if (!Number.isInteger(maquinariaId) || maquinariaId <= 0) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = {};

  if (typeof body.descripcion === 'string') {
    const d = sanitizeString(body.descripcion)?.trim();
    if (d) update.descripcion = d;
  }
  if (typeof body.costo === 'number') {
    update.costo = Math.max(0, Math.round(body.costo));
  }
  if (typeof body.proveedor === 'string' || body.proveedor === null) {
    update.proveedor = body.proveedor ? sanitizeString(body.proveedor)?.trim() : null;
  }
  if (typeof body.factura_url === 'string' || body.factura_url === null) {
    update.factura_url = body.factura_url ? sanitizeString(body.factura_url)?.trim() : null;
  }
  if (typeof body.notas === 'string' || body.notas === null) {
    update.notas = body.notas ? sanitizeString(body.notas) : null;
  }
  if (typeof body.proxima_mantencion_at === 'string' || body.proxima_mantencion_at === null) {
    update.proxima_mantencion_at = body.proxima_mantencion_at || null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Sin cambios' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('maquinaria_mantenciones')
    .update(update)
    .eq('id', mantencionId)
    .eq('maquinaria_id', maquinariaId);

  if (error) {
    console.error('[mantencion-update-fail]', error);
    return NextResponse.json({ error: 'Error actualizando' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; mantencionId: string }> },
) {
  const session = await requirePermission('maquinarias', 'delete');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { id: rawId, mantencionId } = await params;
  const maquinariaId = Number(rawId);
  if (!Number.isInteger(maquinariaId) || maquinariaId <= 0) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('maquinaria_mantenciones')
    .delete()
    .eq('id', mantencionId)
    .eq('maquinaria_id', maquinariaId);

  if (error) return NextResponse.json({ error: 'Error eliminando' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
