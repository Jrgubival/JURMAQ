import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin, escapeOrFilter } from '@jurmaq/shared/sanitize';

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission('proyectos', 'read');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { searchParams } = new URL(request.url);
    const estado = searchParams.get('estado');
    const tipo = searchParams.get('tipo');
    const search = searchParams.get('search');

    let query = supabaseAdmin.from('proyectos').select('*');

    if (estado) {
      query = query.eq('estado', estado);
    } else if (tipo) {
      query = query.eq('tipo', tipo);
    } else if (search) {
      // Sin escapar, una coma o un paréntesis en `search` rompe la sintaxis del
      // filtro de PostgREST y deja inyectar condiciones extra (inyección
      // PostgREST). `api/clientes/route.ts` ya lo hacía bien; este quedó atrás.
      const safe = escapeOrFilter(search.trim());
      query = query.or(
        `nombre.ilike.%${safe}%,cliente.ilike.%${safe}%,descripcion.ilike.%${safe}%`
      );
    }

    const { data: results, error } = await query;

    if (error) throw error;

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error fetching proyectos:', error);
    return NextResponse.json(
      { error: 'Error al obtener proyectos' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }

  try {
    const session = await requirePermission('proyectos', 'create');
    if (!session) return forbiddenResponse('No tienes permiso');

    const body = await request.json();

    // Input validation
    if (!body.nombre || typeof body.nombre !== 'string' || body.nombre.trim().length === 0) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }
    if (!body.tipo || typeof body.tipo !== 'string' || body.tipo.trim().length === 0) {
      return NextResponse.json({ error: 'El tipo es requerido' }, { status: 400 });
    }

    const ALLOWED_ESTADO = new Set(['pendiente', 'en_progreso', 'completado', 'cancelado']);
    if (body.estado !== undefined && !ALLOWED_ESTADO.has(body.estado)) {
      return NextResponse.json({ error: 'Estado invalido' }, { status: 400 });
    }

    const { data: result, error } = await supabaseAdmin
      .from('proyectos')
      .insert({
        nombre: body.nombre,
        cliente: body.cliente || null,
        cliente_id: body.clienteId || body.cliente_id || null,
        tipo: body.tipo,
        descripcion: body.descripcion || null,
        monto: body.monto || null,
        estado: body.estado || 'pendiente',
        fecha_inicio: body.fechaInicio || body.fecha_inicio || null,
        fecha_fin: body.fechaFin || body.fecha_fin || null,
        notas: body.notas || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating proyecto:', error);
    return NextResponse.json(
      { error: 'Error al crear proyecto' },
      { status: 500 }
    );
  }
}
