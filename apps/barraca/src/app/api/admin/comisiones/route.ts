import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';

/**
 * GET /api/admin/comisiones?estado=devengada — lista comisiones por estado
 *
 * Estados:
 *   - pendiente  → cotización aún no pagada
 *   - devengada  → cotización pagada, comisión generada, pendiente de pago a maestro
 *   - pagada     → ya pagada al maestro
 *   - anulada    → cotización cancelada → comisión revertida
 *
 * Devuelve además el maestro embebido (nombre, código, RUT, datos bancarios).
 */

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const session = await requirePermission('barraca_comisiones', 'read');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { searchParams } = new URL(request.url);
  const estado = searchParams.get('estado');
  const maestroId = searchParams.get('maestro_id');

  let query = supabaseAdmin
    .from('comisiones_maestro')
    .select(`
      id, maestro_id, origen_tipo, origen_id,
      monto_venta_neto, porcentaje, monto_comision,
      estado, devengada_at, pagada_at, pago_referencia, notas, created_at,
      maestros:maestro_id ( codigo, nombre, rut, email, banco, tipo_cuenta, numero_cuenta )
    `)
    .order('created_at', { ascending: false })
    .limit(500);

  if (estado && ['pendiente', 'devengada', 'pagada', 'anulada'].includes(estado)) {
    query = query.eq('estado', estado);
  }
  if (maestroId) {
    query = query.eq('maestro_id', maestroId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[comisiones-list-fail]', error);
    return NextResponse.json({ error: 'Error listando comisiones' }, { status: 500 });
  }

  // Resumen agregado para dashboard.
  const resumen = {
    total: data?.length ?? 0,
    monto_devengado: (data ?? [])
      .filter((c) => c.estado === 'devengada')
      .reduce((sum, c) => sum + Number(c.monto_comision || 0), 0),
    monto_pagado: (data ?? [])
      .filter((c) => c.estado === 'pagada')
      .reduce((sum, c) => sum + Number(c.monto_comision || 0), 0),
  };

  return NextResponse.json({ items: data ?? [], resumen });
}
