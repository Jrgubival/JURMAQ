import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission('clientes', 'read');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    let query = supabaseAdmin.from('clientes').select('*');

    if (search) {
      query = query.or(
        `nombre.ilike.%${search}%,empresa.ilike.%${search}%,rut.ilike.%${search}%,email.ilike.%${search}%,telefono.ilike.%${search}%`
      );
    }

    const { data: results, error } = await query;

    if (error) throw error;

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error fetching clientes:', error);
    return NextResponse.json(
      { error: 'Error al obtener clientes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }

  try {
    const session = await requirePermission('clientes', 'create');
    if (!session) return forbiddenResponse('No tienes permiso');

    const body = await request.json();

    // Input validation
    if (!body.nombre || typeof body.nombre !== 'string' || body.nombre.trim().length === 0) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }

    const { data: result, error } = await supabaseAdmin
      .from('clientes')
      .insert({
        nombre: body.nombre,
        empresa: body.empresa || null,
        rut: body.rut || null,
        email: body.email || null,
        telefono: body.telefono || null,
        direccion: body.direccion || null,
        notas: body.notas || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating cliente:', error);
    return NextResponse.json(
      { error: 'Error al crear cliente' },
      { status: 500 }
    );
  }
}
