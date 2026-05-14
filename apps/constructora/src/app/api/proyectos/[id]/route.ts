import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission('proyectos', 'read');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { id } = await params;
    const { data: result, error } = await supabaseAdmin
      .from('proyectos')
      .select('*')
      .eq('id', parseInt(id))
      .single();

    if (error || !result) {
      return NextResponse.json(
        { error: 'Proyecto no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching proyecto:', error);
    return NextResponse.json(
      { error: 'Error al obtener proyecto' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }

  try {
    const session = await requirePermission('proyectos', 'update');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { id } = await params;
    const body = await request.json();

    const { data: existing } = await supabaseAdmin
      .from('proyectos')
      .select('id')
      .eq('id', parseInt(id))
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Proyecto no encontrado' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (body.nombre !== undefined) updateData.nombre = body.nombre;
    if (body.cliente !== undefined) updateData.cliente = body.cliente;
    if (body.clienteId !== undefined) updateData.cliente_id = body.clienteId;
    if (body.cliente_id !== undefined) updateData.cliente_id = body.cliente_id;
    if (body.tipo !== undefined) updateData.tipo = body.tipo;
    if (body.descripcion !== undefined) updateData.descripcion = body.descripcion;
    if (body.monto !== undefined) updateData.monto = body.monto;
    if (body.estado !== undefined) {
      const ALLOWED_ESTADO = new Set(['pendiente', 'en_progreso', 'completado', 'cancelado']);
      if (!ALLOWED_ESTADO.has(body.estado)) {
        return NextResponse.json({ error: 'Estado invalido' }, { status: 400 });
      }
      updateData.estado = body.estado;
    }
    if (body.fechaInicio !== undefined) updateData.fecha_inicio = body.fechaInicio;
    if (body.fecha_inicio !== undefined) updateData.fecha_inicio = body.fecha_inicio;
    if (body.fechaFin !== undefined) updateData.fecha_fin = body.fechaFin;
    if (body.fecha_fin !== undefined) updateData.fecha_fin = body.fecha_fin;
    if (body.notas !== undefined) updateData.notas = body.notas;

    const { data: result, error } = await supabaseAdmin
      .from('proyectos')
      .update(updateData)
      .eq('id', parseInt(id))
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating proyecto:', error);
    return NextResponse.json(
      { error: 'Error al actualizar proyecto' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }

  try {
    const session = await requirePermission('proyectos', 'delete');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { id } = await params;

    const { data: existing } = await supabaseAdmin
      .from('proyectos')
      .select('id')
      .eq('id', parseInt(id))
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Proyecto no encontrado' },
        { status: 404 }
      );
    }

    const { error } = await supabaseAdmin
      .from('proyectos')
      .delete()
      .eq('id', parseInt(id));

    if (error) throw error;

    return NextResponse.json({ message: 'Proyecto eliminado correctamente' });
  } catch (error) {
    console.error('Error deleting proyecto:', error);
    return NextResponse.json(
      { error: 'Error al eliminar proyecto' },
      { status: 500 }
    );
  }
}
