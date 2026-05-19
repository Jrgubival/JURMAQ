import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { getClienteFromRequest } from '@/lib/cuenta-auth';

/**
 * GET /api/cuenta/contratos
 *
 * Lista contratos del cliente logueado (match por arrendatario_email).
 * Filtros opcionales: ?estado=vigente,firmado
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

  let query = supabaseAdmin
    .from('contratos')
    .select(
      'id, numero, estado, fecha_inicio, fecha_termino, precio_total, precio_unidad, maquinaria_id, firma_timestamp, created_at, arrendatario_nombre, arrendatario_razon_social',
    )
    .ilike('arrendatario_email', cliente.email)
    .order('created_at', { ascending: false });

  if (estado) {
    const estados = estado.split(',').map((s) => s.trim()).filter(Boolean);
    if (estados.length) query = query.in('estado', estados);
  }

  const { data, error } = await query.limit(100);
  if (error) {
    console.error('[cuenta-contratos-fail]', error);
    return NextResponse.json({ error: 'Error obteniendo contratos' }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}
