import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { logSafeError } from '@jurmaq/shared/logging';
import { consultarVentas, aFila } from '@/lib/admin/ventas-servidor';
import { vencerTransferencias } from '@/lib/pedidos/vencimiento';

/**
 * GET /api/admin/ventas?periodo=&desde=&hasta=&estado=&medio=&zona=&q=
 * Lista de ventas del período con filtros y totales (panel de Ventas).
 * Admin, gerente, vendedor y contador (sólo lectura).
 */
export async function GET(request: NextRequest) {
  const session = await requirePermission('barraca_ventas', 'read');
  if (!session) return forbiddenResponse();
  // Al abrir el panel se anulan los pedidos por transferencia vencidos (48 h),
  // así la lista y el stock quedan al día aunque el cron diario no haya pasado.
  try {
    await vencerTransferencias();
  } catch (error) {
    logSafeError('admin-ventas-vencer', { error: String(error) });
  }
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
