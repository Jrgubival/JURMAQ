import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission('clientes', 'read');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { id } = await params;
    const { data: result, error } = await supabaseAdmin
      .from('clientes')
      .select('*')
      .eq('id', parseInt(id))
      .single();

    if (error || !result) {
      return NextResponse.json(
        { error: 'Cliente no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching cliente:', error);
    return NextResponse.json(
      { error: 'Error al obtener cliente' },
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
    const session = await requirePermission('clientes', 'update');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { id } = await params;
    const body = await request.json();

    const { data: existing } = await supabaseAdmin
      .from('clientes')
      .select('id')
      .eq('id', parseInt(id))
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Cliente no encontrado' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (body.nombre !== undefined) updateData.nombre = body.nombre;
    if (body.empresa !== undefined) updateData.empresa = body.empresa;
    if (body.rut !== undefined) updateData.rut = body.rut;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.telefono !== undefined) updateData.telefono = body.telefono;
    if (body.direccion !== undefined) updateData.direccion = body.direccion;
    if (body.notas !== undefined) updateData.notas = body.notas;

    const { data: result, error } = await supabaseAdmin
      .from('clientes')
      .update(updateData)
      .eq('id', parseInt(id))
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating cliente:', error);
    return NextResponse.json(
      { error: 'Error al actualizar cliente' },
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
    const session = await requirePermission('clientes', 'delete');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { id } = await params;

    const { data: existing } = await supabaseAdmin
      .from('clientes')
      .select('id')
      .eq('id', parseInt(id))
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: 'Cliente no encontrado' },
        { status: 404 }
      );
    }

    const { error } = await supabaseAdmin
      .from('clientes')
      .delete()
      .eq('id', parseInt(id));

    if (error) throw error;

    return NextResponse.json({ message: 'Cliente eliminado correctamente' });
  } catch (error) {
    console.error('Error deleting cliente:', error);
    return NextResponse.json(
      { error: 'Error al eliminar cliente' },
      { status: 500 }
    );
  }
}
