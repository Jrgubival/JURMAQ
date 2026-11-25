import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { logSafeError } from '@jurmaq/shared/logging';
import { archivadosDeServidor, filtrarArchivadosInformando, modoArchivadosDe, textoArchivados } from '@/lib/pedidos/archivados';
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
    const modo = modoArchivadosDe(request.nextUrl.searchParams.get('archivados'));
    const [todos, archivados] = await Promise.all([pedidos().listar({ estado, limite: 300 }), archivadosDeServidor()]);
    const f = filtrarArchivadosInformando(todos, archivados, modo);
    // El hash de acceso no sale del servidor. `archivados` dice cuántos quedaron fuera (y si el filtro no pudo aplicarse).
    return NextResponse.json({
      pedidos: f.lista.map(({ acceso_hash: _h, ...p }) => p),
      archivados: { excluidos: f.excluidos, filtroAplicado: f.filtroAplicado, truncado: f.truncado, avisos: textoArchivados(f) },
    });
  } catch (error) {
    logSafeError('admin-pedidos-listar', { error: String(error) });
    return NextResponse.json({ error: 'No se pudieron cargar los pedidos' }, { status: 500 });
  }
}
