import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import type { Database } from '@jurmaq/shared/db-types';
import { validateMes } from '../_helpers';

type CombustibleItemWithMaquinaria = Database['public']['Tables']['combustible_items']['Row'] & {
  maquinarias: Pick<Database['public']['Tables']['maquinarias']['Row'], 'id' | 'nombre'> | null;
};

/**
 * GET /api/admin/combustible/resumen?mes=YYYY-MM
 * Returns aggregated stats for the dashboard.
 */
export async function GET(request: NextRequest) {
  const session = await requirePermission('combustible', 'read');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { searchParams } = new URL(request.url);
  const mes = validateMes(searchParams.get('mes'));

  // Get facturas (filtered by mes if provided, or all) — not anulada
  let fQuery = supabaseAdmin
    .from('combustible_facturas')
    .select('id, monto_total, monto_iec, recuperable, estado, mes_tributario, fecha')
    .neq('estado', 'anulada');
  if (mes) fQuery = fQuery.eq('mes_tributario', mes);
  const { data: facturas, error: fErr } = await fQuery;
  if (fErr) return NextResponse.json({ error: 'Error al procesar la solicitud' }, { status: 500 });

  const facturaIds = (facturas || []).map((f) => f.id);
  let items: CombustibleItemWithMaquinaria[] = [];
  if (facturaIds.length > 0) {
    const { data: iData } = await supabaseAdmin
      .from('combustible_items')
      .select('*, maquinarias(id, nombre)')
      .in('factura_id', facturaIds);
    items = (iData || []) as CombustibleItemWithMaquinaria[];
  }

  // Aggregate
  const totalFacturas = (facturas || []).length;
  const totalMonto = (facturas || []).reduce((s, f) => s + (f.monto_total || 0), 0);
  const totalIecRecuperable = (facturas || [])
    .filter((f) => f.recuperable)
    .reduce((s, f) => s + (f.monto_iec || 0), 0);

  const totalLitros = items.reduce((s, i) => s + (Number(i.litros) || 0), 0);

  // Group by maquinaria
  const byMaquinaria: Record<string, { nombre: string; litros: number; monto: number }> = {};
  for (const it of items) {
    const key = it.maquinaria_id || 'sin_maquinaria';
    const nombre = it.maquinarias?.nombre || 'Sin asignar';
    if (!byMaquinaria[key]) byMaquinaria[key] = { nombre, litros: 0, monto: 0 };
    byMaquinaria[key].litros += Number(it.litros) || 0;
    byMaquinaria[key].monto += Number(it.monto) || 0;
  }

  // Group by tipo_combustible
  const byTipo: Record<string, { litros: number; monto: number }> = {};
  for (const it of items) {
    const tipo = it.tipo_combustible || 'otro';
    if (!byTipo[tipo]) byTipo[tipo] = { litros: 0, monto: 0 };
    byTipo[tipo].litros += Number(it.litros) || 0;
    byTipo[tipo].monto += Number(it.monto) || 0;
  }

  return NextResponse.json({
    mes,
    totalFacturas,
    totalMonto,
    totalIecRecuperable,
    totalLitros,
    byMaquinaria: Object.entries(byMaquinaria).map(([id, v]) => ({ id, ...v })),
    byTipo: Object.entries(byTipo).map(([tipo, v]) => ({ tipo, ...v })),
  });
}
