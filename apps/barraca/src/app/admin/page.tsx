import Link from 'next/link';
import { requirePermission } from '@jurmaq/shared/auth/guard';
import { logSafeError } from '@jurmaq/shared/logging';
import { pedidos, type Pedido } from '@/lib/pedidos';
import { calcularResumen, GRUPOS_PENDIENTES } from '@/lib/admin/resumen';

/**
 * /admin — Resumen de la tienda en línea: ventas de hoy y del mes (hora de
 * Chile) y pedidos que esperan algo. Se calcula en el servidor y exige el
 * permiso en el servidor (no basta con esconder el menú).
 *
 * El dashboard anterior de cotizaciones sigue en /admin/dashboard.
 */
export const dynamic = 'force-dynamic';

const clp = (n: number) => `$${Math.round(n).toLocaleString('es-CL')}`;

export default async function ResumenPage() {
  const session = await requirePermission('barraca_cotizaciones', 'read');
  if (!session) {
    return <p className="text-sm text-gray-600 bg-white border border-gray-200 rounded-xl p-6">No tienes permiso para ver los pedidos de la tienda.</p>;
  }

  let lista: Pedido[] = [];
  let error = false;
  try {
    lista = await pedidos().listar({ limite: 1000 });
  } catch (e) {
    logSafeError('admin-resumen', { error: String(e) });
    error = true;
  }
  const r = calcularResumen(lista);
  const atender = lista
    .filter((p) => (GRUPOS_PENDIENTES.por_preparar as readonly string[]).includes(p.estado) || p.estado === 'pago_discrepancia')
    .slice(0, 5);

  const pendientes = [
    { label: 'Por pagar', n: r.porPagar, grupo: 'por_pagar', tono: 'bg-amber-50 text-amber-900 border-amber-200' },
    { label: 'Por preparar', n: r.porPreparar, grupo: 'por_preparar', tono: 'bg-blue-50 text-blue-900 border-blue-200' },
    { label: 'Listos', n: r.listos, grupo: 'listo', tono: 'bg-indigo-50 text-indigo-900 border-indigo-200' },
  ];

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          No pudimos leer los pedidos. Recarga la página en un rato.
        </p>
      )}

      <section aria-labelledby="ventas" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <h2 id="ventas" className="sr-only">Ventas</h2>
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-sm text-gray-500">Ventas de hoy</p>
          <p className="mt-1 text-3xl font-bold text-gray-900 tabular-nums">{clp(r.hoy.monto)}</p>
          <p className="text-sm text-gray-500">{r.hoy.pedidos} {r.hoy.pedidos === 1 ? 'pedido' : 'pedidos'}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-sm text-gray-500">Ventas del mes</p>
          <p className="mt-1 text-3xl font-bold text-gray-900 tabular-nums">{clp(r.mes.monto)}</p>
          <p className="text-sm text-gray-500">{r.mes.pedidos} {r.mes.pedidos === 1 ? 'pedido' : 'pedidos'}</p>
        </div>
      </section>
      <p className="-mt-3 text-xs text-gray-500">Cuenta los pedidos pagados, en preparación, listos y entregados, el día en que se pagaron.</p>

      <section aria-labelledby="pendientes">
        <h2 id="pendientes" className="text-base font-bold text-gray-900 mb-2">Pedidos pendientes</h2>
        <div className="grid grid-cols-3 gap-2">
          {pendientes.map((g) => (
            <Link
              key={g.grupo}
              href={`/admin/pedidos?grupo=${g.grupo}`}
              className={`rounded-2xl border p-3 min-h-[88px] flex flex-col justify-between ${g.tono}`}
            >
              <span className="text-3xl font-bold tabular-nums">{g.n}</span>
              <span className="text-sm font-semibold leading-tight">{g.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="atender">
        <div className="flex items-center justify-between mb-2">
          <h2 id="atender" className="text-base font-bold text-gray-900">Para atender</h2>
          <Link href="/admin/pedidos" className="text-sm font-semibold text-orange-700 min-h-[44px] flex items-center">Ver todos</Link>
        </div>
        {atender.length === 0 ? (
          <p className="text-sm text-gray-500 bg-white border border-gray-200 rounded-2xl p-4">No hay pedidos pagados esperando preparación.</p>
        ) : (
          <ul className="space-y-2">
            {atender.map((p) => (
              <li key={p.numero}>
                <Link href={`/admin/pedidos?n=${encodeURIComponent(p.numero)}`} className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-2xl px-4 min-h-[60px]">
                  <span className="min-w-0">
                    <span className="block font-mono text-sm font-semibold text-gray-900">{p.numero}</span>
                    <span className="block text-sm text-gray-600 truncate">{p.nombre} · {p.entrega === 'retiro' ? 'Retiro' : 'Despacho'}</span>
                  </span>
                  <span className="text-sm font-bold text-gray-900 tabular-nums shrink-0">{clp(p.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
