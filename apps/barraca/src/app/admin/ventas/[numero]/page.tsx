import Link from 'next/link';
import { requirePermission } from '@jurmaq/shared/auth/guard';
import { can } from '@jurmaq/shared/roles';
import { logSafeError } from '@jurmaq/shared/logging';
import { pedidos, PATRON_NUMERO, type EventoPedido, type Pedido } from '@/lib/pedidos';
import { aFila } from '@/lib/admin/ventas-servidor';
import { rutaDocumentoValida } from '@/lib/pedidos/documentos';
import { rutaValida } from '@/lib/pedidos/comprobantes';
import SinPermiso from '@/components/admin/SinPermiso';
import DetalleVenta from './DetalleVenta';

/**
 * /admin/ventas/[numero] — detalle de una venta. Datos y permisos se
 * resuelven en el servidor; las acciones van a /api/admin/pedidos/[numero]/*,
 * que vuelven a validar todo.
 */
export const dynamic = 'force-dynamic';

function NoEncontrado() {
  return (
    <div className="max-w-md mx-auto mt-10 text-center">
      <p className="cifra text-[26px] font-semibold uppercase tracking-[0.04em] text-navy-950">Pedido no encontrado</p>
      <p className="mt-2 text-[15px] text-[#4A4945]">Revisa el número. Tiene la forma BJ-261030-K9ZE.</p>
      <Link href="/admin" className="mt-6 inline-flex items-center justify-center min-h-[48px] px-6 rounded-lg bg-navy-950 text-white text-[15px] font-semibold">Volver a Ventas</Link>
    </div>
  );
}

export default async function DetalleVentaPage({ params }: { params: Promise<{ numero: string }> }) {
  const session = await requirePermission('barraca_ventas', 'read');
  if (!session) return <SinPermiso seccion="las ventas" />;
  const role = (session.user as { role?: string }).role;

  const { numero } = await params;
  if (!PATRON_NUMERO.test(numero)) return <NoEncontrado />;

  const store = pedidos();
  let pedido: Pedido | null = null;
  try {
    pedido = await store.porNumero(numero);
  } catch (error) {
    logSafeError('admin-venta-detalle', { numero, error: String(error) });
    return <p role="alert" className="mt-6 text-[15px] text-marca-800 bg-marca-50 border border-marca-200 rounded-lg px-4 py-3">No pudimos leer el pedido. Recarga en un rato.</p>;
  }
  if (!pedido) return <NoEncontrado />;

  // Si la tabla del historial aún no existe (migración sin aplicar), el detalle igual se muestra.
  let eventos: EventoPedido[] = [];
  try {
    eventos = await store.eventos(numero);
  } catch (error) {
    logSafeError('admin-venta-eventos', { numero, error: String(error) });
  }

  return (
    <DetalleVenta
      pedido={aFila(pedido)}
      eventos={eventos}
      tieneComprobante={rutaValida(pedido.comprobante_path) && pedido.comprobante_path.startsWith(`${pedido.numero}/`)}
      tieneDocumento={rutaDocumentoValida(pedido.documento_path, pedido.numero)}
      puedeEditar={can(role, 'barraca_ventas', 'update')}
      puedeReembolsar={can(role, 'barraca_ventas', 'reembolsar')}
    />
  );
}
