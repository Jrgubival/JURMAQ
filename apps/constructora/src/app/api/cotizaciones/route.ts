import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission('cotizaciones', 'read');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { searchParams } = new URL(request.url);
    const estado = searchParams.get('estado');
    const servicio = searchParams.get('servicio');
    const search = searchParams.get('search');

    let query = supabaseAdmin.from('cotizaciones').select('*');

    if (estado) {
      query = query.eq('estado', estado);
    } else if (servicio) {
      query = query.eq('servicio', servicio);
    } else if (search) {
      query = query.or(
        `cliente_nombre.ilike.%${search}%,cliente_empresa.ilike.%${search}%,cliente_email.ilike.%${search}%,servicio.ilike.%${search}%`
      );
    }

    const { data: results, error } = await query;

    if (error) throw error;

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error fetching cotizaciones:', error);
    return NextResponse.json(
      { error: 'Error al obtener cotizaciones' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }

  // Rate limit: 5 quotes per 15 minutes per IP
  const ip = getClientIp(request);
  const limiter = rateLimit(`cotizacion:${ip}`, { maxAttempts: 5, windowSeconds: 900 });
  if (!limiter.success) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Intente nuevamente en un momento.' },
      { status: 429 }
    );
  }

  try {
    const session = await requirePermission('cotizaciones', 'create');
    if (!session) return forbiddenResponse('No tienes permiso');

    const body = await request.json();

    // Accept both camelCase and snake_case field names for backwards-compat.
    const clienteNombre = body.clienteNombre ?? body.cliente_nombre ?? body.cliente ?? '';
    const clienteEmpresa = body.clienteEmpresa ?? body.cliente_empresa ?? null;
    const clienteEmail = body.clienteEmail ?? body.cliente_email ?? null;
    const clienteTelefono = body.clienteTelefono ?? body.cliente_telefono ?? null;
    const servicio = body.servicio ?? '';
    const montoTotal = body.montoTotal ?? body.monto_total ?? body.monto ?? null;

    // Input validation
    if (typeof clienteNombre !== 'string' || clienteNombre.trim().length === 0) {
      return NextResponse.json({ error: 'El nombre del cliente es requerido' }, { status: 400 });
    }
    if (typeof servicio !== 'string' || servicio.trim().length === 0) {
      return NextResponse.json({ error: 'El servicio es requerido' }, { status: 400 });
    }

    const ALLOWED_ESTADO = new Set(['pendiente', 'enviada', 'aceptada', 'rechazada']);
    if (body.estado !== undefined && !ALLOWED_ESTADO.has(body.estado)) {
      return NextResponse.json({ error: 'Estado invalido' }, { status: 400 });
    }

    const { data: result, error } = await supabaseAdmin
      .from('cotizaciones')
      .insert({
        cliente_nombre: clienteNombre,
        cliente_empresa: clienteEmpresa,
        cliente_email: clienteEmail,
        cliente_telefono: clienteTelefono,
        servicio,
        items: body.items ? JSON.stringify(body.items) : null,
        monto_total: typeof montoTotal === 'number' ? montoTotal : null,
        estado: body.estado || 'pendiente',
        notas: body.notas || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating cotizacion:', error);
    return NextResponse.json(
      { error: 'Error al crear cotizacion' },
      { status: 500 }
    );
  }
}
