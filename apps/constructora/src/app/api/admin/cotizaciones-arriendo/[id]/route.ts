import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';

const ESTADOS_VALIDOS = [
  'borrador',
  'enviada',
  'aceptada',
  'rechazada',
  'contrato_creado',
  'finalizada',
  'cancelada',
] as const;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requirePermission('cotizaciones', 'read');
  if (!session) return forbiddenResponse('No autorizado');

  const { id } = await params;
  const cotId = parseInt(id, 10);
  if (!cotId) return NextResponse.json({ error: 'id invalido' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('cotizaciones_arriendo')
    .select('*, maquinarias!inner(id, nombre)')
    .eq('id', cotId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const session = await requirePermission('cotizaciones', 'update');
  if (!session) return forbiddenResponse('No autorizado');

  const { id } = await params;
  const cotId = parseInt(id, 10);
  if (!cotId) return NextResponse.json({ error: 'id invalido' }, { status: 400 });

  const body = await request.json();
  const updateData: Record<string, unknown> = {};

  if (body.estado !== undefined) {
    if (!ESTADOS_VALIDOS.includes(body.estado)) {
      return NextResponse.json({ error: 'estado invalido' }, { status: 400 });
    }
    updateData.estado = body.estado;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('cotizaciones_arriendo')
    .update(updateData)
    .eq('id', cotId)
    .select()
    .single();

  if (error) {
    console.error('[admin-cot-arriendo-update]', error);
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
  }
  return NextResponse.json(data);
}
