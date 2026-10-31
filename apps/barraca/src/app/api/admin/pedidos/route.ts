import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { logSafeError } from '@jurmaq/shared/logging';
import { pedidos, ESTADOS_PEDIDO, type EstadoPedido } from '@/lib/pedidos';

/**
 * GET /api/admin/pedidos?estado= — pedidos de la tienda en línea.
 * Usa el permiso de cotizaciones barraca (mismo equipo de ventas).
 */
export async function GET(request: NextRequest) {
  const session = await requirePermission('barraca_ventas', 'read');
  if (!session) return forbiddenResponse();

  const estadoParam = request.nextUrl.searchParams.get('estado') || '';
  const estado = (ESTADOS_PEDIDO as string[]).includes(estadoParam) ? (estadoParam as EstadoPedido) : undefined;
  try {
    const lista = await pedidos().listar({ estado, limite: 300 });
    // El hash de acceso no sale del servidor.
    return NextResponse.json({ pedidos: lista.map(({ acceso_hash: _h, ...p }) => p) });
  } catch (error) {
    logSafeError('admin-pedidos-listar', { error: String(error) });
    return NextResponse.json({ error: 'No se pudieron cargar los pedidos' }, { status: 500 });
  }
}
