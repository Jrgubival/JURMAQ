import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin, sanitizeString } from '@jurmaq/shared/sanitize';

/**
 * GET    /api/admin/maestros/[id]  — detalle + stats agregadas
 * PUT    /api/admin/maestros/[id]  — actualiza datos
 * DELETE /api/admin/maestros/[id]  — soft-delete (activo=false)
 */

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requirePermission('barraca_maestros', 'read');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { id } = await params;

  const [maestroRes, comisionesRes] = await Promise.all([
    supabaseAdmin.from('maestros').select('*').eq('id', id).maybeSingle(),
    supabaseAdmin
      .from('comisiones_maestro')
      .select('id, origen_tipo, origen_id, monto_venta_neto, porcentaje, monto_comision, estado, devengada_at, pagada_at, created_at')
      .eq('maestro_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  if (maestroRes.error || !maestroRes.data) {
    return NextResponse.json({ error: 'Maestro no encontrado' }, { status: 404 });
  }

  const comisiones = comisionesRes.data ?? [];
  const stats = {
    total_referidos: comisiones.length,
    pendiente: comisiones.filter((c) => c.estado === 'pendiente').length,
    devengada: comisiones.filter((c) => c.estado === 'devengada').length,
    pagada: comisiones.filter((c) => c.estado === 'pagada').length,
    anulada: comisiones.filter((c) => c.estado === 'anulada').length,
    monto_devengado: comisiones
      .filter((c) => c.estado === 'devengada')
      .reduce((sum, c) => sum + Number(c.monto_comision || 0), 0),
    monto_pagado: comisiones
      .filter((c) => c.estado === 'pagada')
      .reduce((sum, c) => sum + Number(c.monto_comision || 0), 0),
  };

  return NextResponse.json({
    maestro: maestroRes.data,
    comisiones,
    stats,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const session = await requirePermission('barraca_maestros', 'update');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = {};

  if (typeof body.nombre === 'string') {
    const v = sanitizeString(body.nombre)?.trim() || '';
    if (v.length < 3) return NextResponse.json({ error: 'Nombre muy corto' }, { status: 400 });
    update.nombre = v;
  }
  if (typeof body.email === 'string' || body.email === null) {
    update.email = body.email ? sanitizeString(body.email)?.trim() : null;
  }
  if (typeof body.telefono === 'string' || body.telefono === null) {
    update.telefono = body.telefono ? sanitizeString(body.telefono)?.trim() : null;
  }
  if (typeof body.banco === 'string' || body.banco === null) {
    update.banco = body.banco ? sanitizeString(body.banco)?.trim() : null;
  }
  if (typeof body.tipo_cuenta === 'string' || body.tipo_cuenta === null) {
    if (body.tipo_cuenta === null || ['cuenta_corriente', 'cuenta_vista', 'cuenta_ahorro'].includes(body.tipo_cuenta)) {
      update.tipo_cuenta = body.tipo_cuenta || null;
    }
  }
  if (typeof body.numero_cuenta === 'string' || body.numero_cuenta === null) {
    update.numero_cuenta = body.numero_cuenta ? sanitizeString(body.numero_cuenta)?.trim() : null;
  }
  if (body.porcentaje_comision !== undefined) {
    const p = Number(body.porcentaje_comision);
    if (!Number.isFinite(p) || p < 0 || p > 100) {
      return NextResponse.json({ error: 'porcentaje_comision inválido' }, { status: 400 });
    }
    update.porcentaje_comision = p;
  }
  if (typeof body.activo === 'boolean') update.activo = body.activo;
  if (typeof body.notas === 'string' || body.notas === null) {
    update.notas = body.notas ? sanitizeString(body.notas) : null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Sin cambios' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('maestros').update(update).eq('id', id);
  if (error) {
    console.error('[maestros-update-fail]', error);
    return NextResponse.json({ error: 'Error actualizando' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requirePermission('barraca_maestros', 'delete');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { id } = await params;
  // Soft-delete (preserva historial de comisiones). El FK ON DELETE RESTRICT
  // hace que un hard-delete falle si hay comisiones — por diseño.
  const { error } = await supabaseAdmin
    .from('maestros')
    .update({ activo: false })
    .eq('id', id);

  if (error) {
    console.error('[maestros-delete-fail]', error);
    return NextResponse.json({ error: 'Error desactivando' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
