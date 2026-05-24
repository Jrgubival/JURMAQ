import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getClienteFromRequest } from '@/lib/cuenta-auth';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { formatCLP } from '@jurmaq/shared/format';

export const dynamic = 'force-dynamic';

const estadoColor: Record<string, string> = {
  borrador: 'bg-gray-100 text-gray-700',
  enviada: 'bg-blue-100 text-blue-700',
  aceptada: 'bg-green-100 text-green-700',
  rechazada: 'bg-red-100 text-red-700',
  contrato_creado: 'bg-purple-100 text-purple-700',
  finalizada: 'bg-gray-100 text-gray-500',
};

export default async function CotizacionesPage() {
  const cliente = await getClienteFromRequest();
  if (!cliente) redirect('/cuenta/login');

  const { data } = await supabaseAdmin
    .from('cotizaciones_arriendo')
    .select(
      'id, numero, fecha_servicio, ubicacion_servicio, unidades_solicitadas, unidad, total, estado, created_at',
    )
    .ilike('cliente_email', cliente.email)
    .order('created_at', { ascending: false })
    .limit(100);

  const cotizaciones = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis cotizaciones</h1>
          <p className="text-sm text-gray-500 mt-1">{cotizaciones.length} cotizaciones</p>
        </div>
        <Link
          href="/cotizar-arriendo"
          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-xl"
        >
          + Nueva cotización
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {cotizaciones.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-500">
            No tienes cotizaciones aún.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Número</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Fecha servicio</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Ubicación</th>
                <th className="text-right px-4 py-2 font-semibold text-gray-600">Unidades</th>
                <th className="text-right px-4 py-2 font-semibold text-gray-600">Total</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cotizaciones.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <Link
                      href={`/cuenta/cotizaciones/${encodeURIComponent(String(c.numero))}`}
                      className="hover:underline"
                    >
                      {c.numero}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {c.fecha_servicio ? new Date(String(c.fecha_servicio)).toLocaleDateString('es-CL') : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-700 truncate max-w-[200px]" title={String(c.ubicacion_servicio || '')}>
                    {c.ubicacion_servicio || '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                    {c.unidades_solicitadas} {c.unidad}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-900">
                    {formatCLP(Number(c.total) || 0)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                        estadoColor[c.estado as string] ?? 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {c.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
