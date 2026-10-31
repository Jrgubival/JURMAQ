import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { logSafeError } from '@jurmaq/shared/logging';
import { consultarVentas, aFila } from '@/lib/admin/ventas-servidor';

/**
 * GET /api/admin/ventas?periodo=&desde=&hasta=&estado=&medio=&zona=&q=
 * Lista de ventas del período con filtros y totales (panel de Ventas).
 * Admin, gerente, vendedor y contador (sólo lectura).
 */
export async function GET(request: NextRequest) {
  const session = await requirePermission('barraca_ventas', 'read');
  if (!session) return forbiddenResponse();
  try {
    const r = await consultarVentas(request.nextUrl.searchParams);
    return NextResponse.json(
      { ...r, pedidos: r.pedidos.map(aFila) },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    logSafeError('admin-ventas-listar', { error: String(error) });
    return NextResponse.json({ error: 'No se pudieron cargar las ventas' }, { status: 500 });
  }
}
