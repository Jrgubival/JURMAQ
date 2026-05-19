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
  pendiente_firma: 'bg-amber-100 text-amber-700',
  firmado: 'bg-blue-100 text-blue-700',
  vigente: 'bg-green-100 text-green-700',
  vencido: 'bg-gray-100 text-gray-500',
  anulado: 'bg-red-100 text-red-700',
};

export default async function CuentaDashboard() {
  const cliente = await getClienteFromRequest();
  if (!cliente) redirect('/cuenta/login');

  const [{ data: cotizaciones }, { data: contratos }] = await Promise.all([
    supabaseAdmin
      .from('cotizaciones_arriendo')
      .select('id, numero, fecha_servicio, ubicacion_servicio, total, estado, created_at')
      .ilike('cliente_email', cliente.email)
      .order('created_at', { ascending: false })
      .limit(5),
    supabaseAdmin
      .from('contratos')
      .select('id, numero, estado, fecha_inicio, fecha_termino, precio_total')
      .ilike('arrendatario_email', cliente.email)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const cotActivas = (cotizaciones ?? []).filter((c) => !['finalizada', 'rechazada'].includes(c.estado));
  const contratosActivos = (contratos ?? []).filter((c) => ['firmado', 'vigente'].includes(c.estado));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Hola, {cliente.nombre || cliente.email}</h1>
        <p className="text-sm text-gray-500 mt-1">Tu resumen de cuenta JURMAQ.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Cotizaciones" value={String((cotizaciones ?? []).length)} accent="text-blue-600" />
        <Stat label="Cotiz. activas" value={String(cotActivas.length)} accent="text-orange-600" />
        <Stat label="Contratos" value={String((contratos ?? []).length)} accent="text-purple-600" />
        <Stat label="Vigentes" value={String(contratosActivos.length)} accent="text-green-600" />
      </div>

      {/* Acciones rápidas */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Acciones rápidas</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/cotizar-arriendo"
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-xl"
          >
            + Nueva cotización
          </Link>
          <Link
            href="/cuenta/cotizaciones"
            className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm rounded-xl"
          >
            Ver todas mis cotizaciones
          </Link>
          <Link
            href="/cuenta/contratos"
            className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm rounded-xl"
          >
            Ver todos mis contratos
          </Link>
        </div>
      </div>

      {/* Cotizaciones recientes */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Cotizaciones recientes</h2>
          <Link href="/cuenta/cotizaciones" className="text-xs text-orange-600 hover:underline">
            Ver todas →
          </Link>
        </div>
        {(cotizaciones ?? []).length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">
            Aún no tienes cotizaciones.{' '}
            <Link href="/cotizar-arriendo" className="text-orange-600 hover:underline">
              Crear una
            </Link>
            .
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Número</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Fecha servicio</th>
                <th className="text-right px-4 py-2 font-semibold text-gray-600">Total</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(cotizaciones ?? []).map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <Link
                      href={`/cuenta/cotizaciones/${encodeURIComponent(c.numero ?? '')}`}
                      className="hover:underline"
                    >
                      {c.numero}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {c.fecha_servicio ? new Date(String(c.fecha_servicio)).toLocaleDateString('es-CL') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCLP(Number(c.total) || 0)}</td>
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

      {/* Contratos recientes */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Contratos recientes</h2>
          <Link href="/cuenta/contratos" className="text-xs text-orange-600 hover:underline">
            Ver todos →
          </Link>
        </div>
        {(contratos ?? []).length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">
            Aún no tienes contratos.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Número</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Vigencia</th>
                <th className="text-right px-4 py-2 font-semibold text-gray-600">Monto</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(contratos ?? []).map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <Link
                      href={`/cuenta/contratos/${encodeURIComponent(c.numero ?? '')}`}
                      className="hover:underline"
                    >
                      {c.numero || '—'}
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="text-xs uppercase tracking-wider text-gray-500">{label}</div>
      <div className={`mt-1 text-3xl font-extrabold tabular-nums ${accent}`}>{value}</div>
    </div>
  );
}
