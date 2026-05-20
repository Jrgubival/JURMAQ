import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';

/**
 * GET /api/admin/stock-alerts?umbral=N
 *
 * Lista productos activos con stock <= umbral (default 5) o sin stock.
 * Útil para el dashboard admin y como widget de alerta.
 */

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const session = await requirePermission('barraca_productos', 'read');
  if (!session) return forbiddenResponse('No tienes permiso');

  const { searchParams } = new URL(request.url);
  const umbral = Math.max(0, Number(searchParams.get('umbral')) || 5);

  // Producto activo con stock bajo. Asumimos columna `stock` en barraca_productos.
  const { data, error } = await supabaseAdmin
    .from('barraca_productos')
    .select('id, codigo, nombre, stock, precio, categoria_id, activo')
    .eq('activo', true)
    .lte('stock', umbral)
    .order('stock', { ascending: true })
    .limit(100);

  if (error) {
    console.error('[stock-alerts-fail]', error);
    return NextResponse.json({ error: 'Error obteniendo alertas' }, { status: 500 });
  }

  const items = data ?? [];
  const sinStock = items.filter((p) => Number(p.stock) === 0);
  const bajo = items.filter((p) => Number(p.stock) > 0 && Number(p.stock) <= umbral);

  return NextResponse.json({
    umbral,
    total: items.length,
    sin_stock: sinStock.length,
    bajo_stock: bajo.length,
    items,
  });
}
