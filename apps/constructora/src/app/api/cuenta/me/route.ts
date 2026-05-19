import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { getClienteFromRequest } from '@/lib/cuenta-auth';

/**
 * GET /api/cuenta/me
 *
 * Devuelve perfil + resumen del cliente logueado:
 *   - Datos personales (nombre, email, rut, empresa, telefono, direccion)
 *   - Cotizaciones recientes (últimas 10)
 *   - Contratos activos + recientes
 *   - Conteo total de cada uno
 *
 * Sin sesión → 401.
 */

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function GET(request: NextRequest) {
  const cliente = await getClienteFromRequest(request);
  if (!cliente) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // Perfil completo desde DB (los datos en la sesión son un subset).
  const { data: perfilFull } = await supabaseAdmin
    .from('clientes')
    .select('id, email, nombre, rut, empresa, telefono, direccion, notas, email_verificado_at, ultimo_login_at, created_at')
    .eq('id', cliente.id)
    .single();

  // Cotizaciones por email del cliente (en arriendo todavía no hay cliente_id FK,
  // así que cruzamos por cliente_email — patrón legacy).
  const { data: cotizaciones } = await supabaseAdmin
    .from('cotizaciones_arriendo')
    .select('id, numero, fecha_servicio, ubicacion_servicio, total, estado, created_at, maquinaria_id')
    .ilike('cliente_email', cliente.email)
    .order('created_at', { ascending: false })
    .limit(10);

  // Contratos por arrendatario_email.
  const { data: contratos } = await supabaseAdmin
    .from('contratos')
    .select('id, numero, estado, fecha_inicio, fecha_termino, precio_total, maquinaria_id, created_at')
    .ilike('arrendatario_email', cliente.email)
    .order('created_at', { ascending: false })
    .limit(10);

  return NextResponse.json({
    perfil: perfilFull,
    cotizaciones: cotizaciones ?? [],
    contratos: contratos ?? [],
    counts: {
      cotizaciones: (cotizaciones ?? []).length,
      contratos: (contratos ?? []).length,
    },
  });
}
