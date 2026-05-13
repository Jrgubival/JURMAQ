import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { NextRequest, NextResponse } from 'next/server';
import { isValidOrigin } from '@jurmaq/shared/sanitize';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('barraca_promociones')
      .select('*, barraca_categorias(nombre, slug)')
      .order('id', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ promociones: data || [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error al obtener promociones:', message);
    return NextResponse.json(
      { error: 'Error al obtener promociones', detail: message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }

  try {
    const session = await requirePermission('barraca_promociones', 'create');
    if (!session) return forbiddenResponse('No tienes permiso');

    const body = await request.json();
    const { titulo, descripcion, descuento_porcentaje, categoria_id, activa, imagen } = body;

    if (!titulo || !descuento_porcentaje || !categoria_id) {
      return NextResponse.json(
        { error: 'titulo, descuento_porcentaje y categoria_id son requeridos' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('barraca_promociones')
      .insert({
        titulo,
        descripcion: descripcion || null,
        descuento_porcentaje: parseInt(descuento_porcentaje),
        categoria_id: parseInt(categoria_id),
        activa: activa !== false,
        imagen: imagen || null,
      })
      .select('*, barraca_categorias(nombre, slug)')
      .single();

    if (error) throw error;

    return NextResponse.json({ promocion: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error al crear promocion:', message);
    return NextResponse.json(
      { error: 'Error al crear promocion', detail: message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  try {
    const session = await requirePermission('barraca_promociones', 'update');
    if (!session) return forbiddenResponse('No tienes permiso');

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
    }

    const updateData: Record<string, string | number | boolean | null> = {};
    if (updates.titulo !== undefined) updateData.titulo = updates.titulo;
    if (updates.descripcion !== undefined) updateData.descripcion = updates.descripcion;
    if (updates.descuento_porcentaje !== undefined) updateData.descuento_porcentaje = parseInt(updates.descuento_porcentaje);
    if (updates.categoria_id !== undefined) updateData.categoria_id = parseInt(updates.categoria_id);
    if (updates.activa !== undefined) updateData.activa = updates.activa;
    if (updates.imagen !== undefined) updateData.imagen = updates.imagen;

    const { data, error } = await supabaseAdmin
      .from('barraca_promociones')
      .update(updateData)
      .eq('id', id)
      .select('*, barraca_categorias(nombre, slug)')
      .single();

    if (error) throw error;

    return NextResponse.json({ promocion: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error al actualizar promocion:', message);
    return NextResponse.json(
      { error: 'Error al actualizar promocion', detail: message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  try {
    const session = await requirePermission('barraca_promociones', 'delete');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id es requerido' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('barraca_promociones')
      .delete()
      .eq('id', parseInt(id));

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error al eliminar promocion:', message);
    return NextResponse.json(
      { error: 'Error al eliminar promocion', detail: message },
      { status: 500 }
    );
  }
}
