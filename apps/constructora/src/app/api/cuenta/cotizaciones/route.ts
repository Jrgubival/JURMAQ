import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { getClienteFromRequest } from '@/lib/cuenta-auth';

/**
 * GET /api/cuenta/cotizaciones
 *
 * Lista TODAS las cotizaciones de arriendo del cliente logueado.
 * Filtros opcionales:
 *   ?estado=enviada,aceptada
 *   ?desde=YYYY-MM-DD
 *   ?hasta=YYYY-MM-DD
 *   ?q=búsqueda en numero / ubicacion
 *
 * Match por arrendatario.cliente_email (compatibilidad con cotizaciones
 * históricas creadas antes del portal).
 */

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function GET(request: NextRequest) {
  const cliente = await getClienteFromRequest(request);
  if (!cliente) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const estado = searchParams.get('estado');
  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');
  const q = searchParams.get('q');

  let query = supabaseAdmin
    .from('cotizaciones_arriendo')
    .select(
      'id, numero, fecha_servicio, ubicacion_servicio, unidades_solicitadas, unidad, total, estado, created_at, maquinaria_id, distancia_km, peajes, operarios',
    )
    .ilike('cliente_email', cliente.email)
    .order('created_at', { ascending: false });

  if (estado) {
    const estados = estado.split(',').map((s) => s.trim()).filter(Boolean);
    if (estados.length) query = query.in('estado', estados);
  }
  if (desde) query = query.gte('fecha_servicio', desde);
  if (hasta) query = query.lte('fecha_servicio', hasta);
  if (q) {
    query = query.or(`numero.ilike.%${q}%,ubicacion_servicio.ilike.%${q}%`);
  }

  const { data, error } = await query.limit(100);
  if (error) {
    console.error('[cuenta-cotizaciones-fail]', error);
    return NextResponse.json({ error: 'Error obteniendo cotizaciones' }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}
