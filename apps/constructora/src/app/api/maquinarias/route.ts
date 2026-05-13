import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse, requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin, escapeOrFilter } from '@jurmaq/shared/sanitize';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo');
    const search = searchParams.get('search');
    const estado = searchParams.get('estado');

    // Public endpoint — expose only fields needed by the catalog UI.
    // Internal fields (garantia_monto, tipo_combustible, especificaciones, etc.)
    // are available via the admin API instead.
    let query = supabaseAdmin
      .from('maquinarias')
      .select('id, nombre, tipo, descripcion, precio_dia, precio_semana, precio_mes, estado, imagen');

    if (tipo) {
      query = query.eq('tipo', tipo);
    }

    if (estado) {
      query = query.eq('estado', estado);
    }

    if (search) {
      const safe = escapeOrFilter(search);
      query = query.or(`nombre.ilike.%${safe}%,tipo.ilike.%${safe}%,descripcion.ilike.%${safe}%`);
    }

    const { data: results, error } = await query;

    if (error) throw error;

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error fetching maquinarias:', error);
    return NextResponse.json(
      { error: 'Error al obtener maquinarias' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }

  try {
    // Solo admin/gerente pueden crear máquinas (precios y datos).
    const session = await requirePermission('maquinarias', 'create');
    if (!session) return forbiddenResponse('Solo administradores pueden crear máquinas');
    void session; // silence unused warning

    const body = await request.json();

    // Input validation
    if (!body.nombre || typeof body.nombre !== 'string' || body.nombre.trim().length === 0) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }
    if (!body.tipo || typeof body.tipo !== 'string' || body.tipo.trim().length === 0) {
      return NextResponse.json({ error: 'El tipo es requerido' }, { status: 400 });
    }

    const tipoCombustible = body.tipoCombustible || body.tipo_combustible;
    const ALLOWED_COMBUSTIBLE = new Set(['diesel', 'gasolina_93', 'gasolina_95', 'gasolina_97', 'kerosene', 'otro']);
    const tipoCombustibleValidado =
      typeof tipoCombustible === 'string' && tipoCombustible && ALLOWED_COMBUSTIBLE.has(tipoCombustible)
        ? tipoCombustible
        : null;

    const { data: inserted, error } = await supabaseAdmin
      .from('maquinarias')
      .insert({
        nombre: body.nombre,
        tipo: body.tipo,
        descripcion: body.descripcion || null,
        especificaciones: body.especificaciones ? JSON.stringify(body.especificaciones) : null,
        precio_dia: body.precioDia || body.precio_dia || null,
        precio_semana: body.precioSemana || body.precio_semana || null,
        precio_mes: body.precioMes || body.precio_mes || null,
        garantia_monto: body.garantiaMonto ?? body.garantia_monto ?? null,
        tipo_combustible: tipoCombustibleValidado,
        estado: body.estado || 'disponible',
        imagen: body.imagen || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(inserted, { status: 201 });
  } catch (error) {
    console.error('Error creating maquinaria:', error);
    return NextResponse.json(
      { error: 'Error al crear maquinaria' },
      { status: 500 }
    );
  }
}
