'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCLP } from '@jurmaq/shared/format';

interface HoldRow {
  id: string;
  contrato_id: number;
  monto: number;
  autorizado_at: string;
  expira_at?: string;
  notas?: string;
  renovaciones_count: number;
}

interface CaptureRow {
  id: string;
  contrato_id: number;
  monto: number;
  motivo: string;
  capturado_at: string;
}

interface ChargeRow {
  id: string;
  contrato_id: number;
  monto: number;
  motivo: string;
  estado: 'approved' | 'declined' | 'refunded';
  cobrado_at: string;
  decline_reason?: string;
}

interface GarantiasResp {
  renovaciones_proximas: HoldRow[];
  renovaciones_fallidas: HoldRow[];
  captures_recientes: CaptureRow[];
  cargos_tardios: ChargeRow[];
  generated_at: string;
}

export default function GarantiasPanelPage() {
  const [data, setData] = useState<GarantiasResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/admin/garantias');
        if (!res.ok) {
          setError(`Error ${res.status}`);
          return;
        }
        const json = (await res.json()) as GarantiasResp;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🔒 Panel de garantías</h1>
          <p className="text-sm text-gray-500 mt-1">
            Estado consolidado de holds Klap, capturas y cargos tardíos.
          </p>
        </div>
        <button
          onClick={() => setTick((t) => t + 1)}
          className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-xl"
        >
          Actualizar
        </button>
      </div>

      {loading && <div className="text-sm text-gray-500">Cargando estado…</div>}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <div className="space-y-6">
          {/* Stats top */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat
              label="Renovaciones próximas (7d)"
              value={String(data.renovaciones_proximas.length)}
              accent="text-blue-600"
            />
            <Stat
              label="Renovaciones fallidas"
              value={String(data.renovaciones_fallidas.length)}
              accent={data.renovaciones_fallidas.length > 0 ? 'text-red-600' : 'text-gray-500'}
            />
            <Stat
              label="Capturas recientes"
              value={String(data.captures_recientes.length)}
              accent="text-purple-600"
            />
            <Stat
              label="Cargos tardíos"
              value={String(data.cargos_tardios.length)}
              accent="text-orange-600"
            />
          </div>

          {/* Renovaciones próximas */}
          <Section title="Renovaciones próximas (vencen ≤ 7 días)">
            {data.renovaciones_proximas.length === 0 ? (
              <Empty msg="Sin renovaciones próximas." />
            ) : (
              <Table headers={['Contrato', 'Monto', 'Autorizado', 'Vence', 'Renov.', '']}>
                {data.renovaciones_proximas.map((h) => (
                  <tr key={h.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <Link
                        href={`/admin/contratos/${h.contrato_id}`}
                        className="text-orange-600 hover:underline font-medium"
                      >
                        #{h.contrato_id}
                      </Link>
                    </td>
                    <td className="px-4 py-2 tabular-nums">{formatCLP(h.monto)}</td>
                    <td className="px-4 py-2 text-xs text-gray-600">
                      {new Date(h.autorizado_at).toLocaleDateString('es-CL')}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600">
                      {h.expira_at ? new Date(h.expira_at).toLocaleDateString('es-CL') : '—'}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-center">{h.renovaciones_count}</td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/admin/contratos/${h.contrato_id}`}
                        className="text-xs text-orange-600 hover:underline"
                      >
                        Ver →
                      </Link>
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </Section>

          {/* Renovaciones fallidas */}
          {data.renovaciones_fallidas.length > 0 && (
            <Section
              title="⚠ Renovaciones fallidas (acción requerida)"
              accentClass="border-red-200"
            >
              <Table headers={['Contrato', 'Monto', 'Motivo', 'Intentos', '']}>
                {data.renovaciones_fallidas.map((h) => (
                  <tr key={h.id} className="bg-red-50/50 hover:bg-red-50">
                    <td className="px-4 py-2">
                      <Link
                        href={`/admin/contratos/${h.contrato_id}`}
                        className="text-red-700 hover:underline font-medium"
                      >
                        #{h.contrato_id}
                      </Link>
                    </td>
                    <td className="px-4 py-2 tabular-nums">{formatCLP(h.monto)}</td>
                    <td className="px-4 py-2 text-xs text-gray-700">
                      {h.notas || 'Sin motivo registrado'}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-center">{h.renovaciones_count}</td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        href={`/admin/contratos/${h.contrato_id}`}
                        className="text-xs text-red-700 hover:underline font-semibold"
                      >
                        Gestionar →
                      </Link>
                    </td>
                  </tr>
                ))}
              </Table>
            </Section>
          )}

          {/* Capturas recientes */}
          <Section title="Capturas recientes (daños cobrados)">
            {data.captures_recientes.length === 0 ? (
              <Empty msg="Sin capturas registradas." />
            ) : (
              <Table headers={['Contrato', 'Monto', 'Motivo', 'Fecha']}>
                {data.captures_recientes.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <Link
                        href={`/admin/contratos/${c.contrato_id}`}
                        className="text-orange-600 hover:underline font-medium"
                      >
                        #{c.contrato_id}
                      </Link>
                    </td>
                    <td className="px-4 py-2 tabular-nums">{formatCLP(c.monto)}</td>
                    <td className="px-4 py-2 text-xs text-gray-700 truncate max-w-[300px]">
                      {c.motivo}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600">
                      {new Date(c.capturado_at).toLocaleString('es-CL')}
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </Section>

          {/* Cargos tardíos */}
          <Section title="Cargos tardíos (off-session, ≤90d post-devolución)">
            {data.cargos_tardios.length === 0 ? (
              <Empty msg="Sin cargos tardíos registrados." />
            ) : (
              <Table headers={['Contrato', 'Monto', 'Estado', 'Motivo', 'Fecha']}>
                {data.cargos_tardios.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <Link
                        href={`/admin/contratos/${c.contrato_id}`}
                        className="text-orange-600 hover:underline font-medium"
                      >
                        #{c.contrato_id}
                      </Link>
                    </td>
                    <td className="px-4 py-2 tabular-nums">{formatCLP(c.monto)}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                          c.estado === 'approved'
                            ? 'bg-green-100 text-green-700'
                            : c.estado === 'declined'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {c.estado}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-700 truncate max-w-[260px]">
                      {c.motivo}
                      {c.decline_reason && (
                        <div className="text-red-600 text-[10px] mt-0.5">{c.decline_reason}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600">
                      {new Date(c.cobrado_at).toLocaleString('es-CL')}
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </Section>

          <p className="text-xs text-gray-500 text-right">
            Generado: {new Date(data.generated_at).toLocaleString('es-CL')}
          </p>
        </div>
      )}
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

function Section({
  title,
  accentClass,
  children,
}: {
  title: string;
  accentClass?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`bg-white border ${accentClass || 'border-gray-200'} rounded-xl overflow-hidden`}
    >
      <div className="px-6 py-3 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50">
        <tr>
          {headers.map((h) => (
            <th key={h} className="text-left px-4 py-2 font-semibold text-gray-600">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">{children}</tbody>
    </table>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="px-6 py-8 text-center text-sm text-gray-500">{msg}</div>;
}
