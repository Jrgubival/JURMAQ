import { redirect } from 'next/navigation';
import { PATRON_NUMERO } from '@/lib/pedidos';

/**
 * /admin/pedidos quedó dentro de Ventas. Se mantiene por los enlaces viejos
 * (correos "Transferencia informada", el panel de jurmaq.cl): ?n=<numero>
 * abre el detalle y ?grupo= el filtro equivalente.
 */
export const dynamic = 'force-dynamic';

const GRUPO: Record<string, string> = {
  informada: 'informada', por_pagar: 'por_pagar', por_preparar: 'por_preparar', pagado: 'por_preparar',
  preparando: 'por_preparar', listo: 'listos', entregado: 'entregados', rechazado: 'cerrados', cancelado: 'cerrados',
};

export default async function PedidosViejos({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const n = typeof sp.n === 'string' ? sp.n : '';
  if (PATRON_NUMERO.test(n)) redirect(`/admin/ventas/${n}`);
  const g = typeof sp.grupo === 'string' ? GRUPO[sp.grupo] : undefined;
  redirect(g ? `/admin?estado=${g}` : '/admin');
}
