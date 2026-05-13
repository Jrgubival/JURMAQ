import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { auth } from '@jurmaq/shared/auth';
import { NextRequest, NextResponse } from 'next/server';
import { isValidOrigin } from '@jurmaq/shared/sanitize';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }

  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const subId = parseInt(id, 10);
  if (!Number.isFinite(subId) || subId <= 0) {
    return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Cuerpo invalido' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (typeof body.activo === 'boolean') update.activo = body.activo;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('barraca_suscriptores')
    .update(update)
    .eq('id', subId)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Suscriptor no encontrado' }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }

  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const subId = parseInt(id, 10);
  if (!Number.isFinite(subId) || subId <= 0) {
    return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('barraca_suscriptores')
    .delete()
    .eq('id', subId);

  if (error) {
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
