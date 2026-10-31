import { requirePermission } from '@jurmaq/shared/auth/guard';
import { can } from '@jurmaq/shared/roles';
import { logSafeError } from '@jurmaq/shared/logging';
import { consultarVentas, type ResultadoVentas } from '@/lib/admin/ventas-servidor';
import { aFilaLista } from '@/lib/admin/ventas';
import SinPermiso from '@/components/admin/SinPermiso';
import VentasClient from './VentasClient';

/**
 * /admin — Ventas de la tienda en línea (pantalla principal del vendedor y
 * del administrador). Se calcula en el servidor con el permiso validado acá;
 * los filtros viven en la URL, así el botón "atrás" y un enlace compartido
 * muestran lo mismo.
 */
export const dynamic = 'force-dynamic';

type Params = Promise<Record<string, string | string[] | undefined>>;

export default async function VentasPage({ searchParams }: { searchParams: Params }) {
  const session = await requirePermission('barraca_ventas', 'read');
  if (!session) return <SinPermiso seccion="las ventas" />;
  const role = (session.user as { role?: string }).role;

  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) {
    if (typeof v === 'string') sp.set(k, v);
  }

  let r: ResultadoVentas | null = null;
  try {
    r = await consultarVentas(sp);
  } catch (error) {
    logSafeError('admin-ventas-pagina', { error: String(error) });
  }
  if (!r) {
    return (
      <p role="alert" className="mt-6 text-[15px] text-marca-800 bg-marca-50 border border-marca-200 rounded-lg px-4 py-3">
        No pudimos leer las ventas. Recarga la página en un rato.
      </p>
    );
  }

  return (
    <VentasClient
      periodo={r.periodo}
      filtros={r.filtros}
      filas={r.pedidos.map(aFilaLista)}
      totales={r.totales}
      conteos={r.conteos}
      atender={r.atender}
      truncado={r.truncado}
      puedeExportar={can(role, 'barraca_ventas', 'export')}
    />
  );
}
