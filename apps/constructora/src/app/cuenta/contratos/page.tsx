import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getClienteFromRequest } from '@/lib/cuenta-auth';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { formatCLP } from '@jurmaq/shared/format';
import { escapeLikePattern } from '@jurmaq/shared/sanitize';

export const dynamic = 'force-dynamic';

const estadoColor: Record<string, string> = {
  borrador: 'bg-gray-100 text-gray-700',
  pendiente_firma: 'bg-amber-100 text-amber-700',
  firmado: 'bg-blue-100 text-blue-700',
  vigente: 'bg-green-100 text-green-700',
  vencido: 'bg-gray-100 text-gray-500',
  anulado: 'bg-red-100 text-red-700',
};

export default async function ContratosPage() {
  const cliente = await getClienteFromRequest();
  if (!cliente) redirect('/cuenta/login');

  const { data } = await supabaseAdmin
    .from('contratos')
    .select(
      'id, numero, estado, fecha_inicio, fecha_termino, precio_total, precio_unidad, firma_timestamp, created_at',
    )
    .ilike('arrendatario_email', escapeLikePattern(cliente.email))
    .order('created_at', { ascending: false })
    .limit(100);

  const contratos = data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mis contratos</h1>
        <p className="text-sm text-gray-500 mt-1">{contratos.length} contratos</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {contratos.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-500">
            No tienes contratos aún.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Número</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Vigencia</th>
                <th className="text-right px-4 py-2 font-semibold text-gray-600">Monto</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Estado</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contratos.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <Link
                      href={`/cuenta/contratos/${encodeURIComponent(String(c.numero || ''))}`}
                      className="hover:underline"
                    >
                      {c.numero || `#${c.id}`}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-xs">
                    {c.fecha_inicio ? new Date(String(c.fecha_inicio)).toLocaleDateString('es-CL') : '—'} →{' '}
                    {c.fecha_termino ? new Date(String(c.fecha_termino)).toLocaleDateString('es-CL') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCLP(Number(c.precio_total) || 0)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                        estadoColor[c.estado as string] ?? 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {c.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(c.estado === 'firmado' || c.estado === 'vigente') && (
                      <a
                        href={`/api/cuenta/contratos/${c.id}/pdf`}
                        target="_blank"
                        rel="noopener"
                        className="text-orange-600 hover:underline text-xs font-medium"
                      >
                        Ver PDF →
                      </a>
                    )}
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
