"use client"

import { useEffect, useState } from 'react';

interface ProviderStatus {
  name: string;
  canal: 'whatsapp' | 'sms' | 'email';
  healthy: boolean;
}

interface ProviderStat {
  provider: string;
  canal: string;
  sent: number;
  failed: number;
  verified: number;
}

interface HealthResponse {
  providers: ProviderStatus[];
  stats_24h: ProviderStat[];
  generated_at: string;
}

const canalColor: Record<string, string> = {
  whatsapp: 'bg-green-100 text-green-800',
  sms: 'bg-blue-100 text-blue-800',
  email: 'bg-purple-100 text-purple-800',
};

const canalLabel: Record<string, string> = {
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  email: 'Email',
};

export default function OtpDiagnosticoPage() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/admin/otp/health');
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as HealthResponse;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Diagnóstico OTP</h1>
          <p className="text-sm text-gray-500 mt-1">
            Estado de los providers (WhatsApp / SMS / Email) y métricas 24h.
          </p>
        </div>
        <button
          onClick={() => setRefreshKey((k) => k + 1)}
          className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-xl"
        >
          Actualizar
        </button>
      </div>

      {loading && (
        <div className="text-sm text-gray-500">Cargando estado de providers…</div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm">
          Error: {error}
        </div>
      )}

      {!loading && !error && data && (
        <div className="space-y-6">
          {/* Providers */}
          <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-6 py-3 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Estado de providers</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold text-gray-600">Provider</th>
                  <th className="text-left px-4 py-2 font-semibold text-gray-600">Canal</th>
                  <th className="text-left px-4 py-2 font-semibold text-gray-600">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.providers.map((p) => (
                  <tr key={p.name}>
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                          canalColor[p.canal] ?? 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {canalLabel[p.canal] ?? p.canal}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {p.healthy ? (
                        <span className="inline-flex items-center gap-1 text-green-700">
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                          OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-gray-500">
                          <span className="w-2 h-2 rounded-full bg-gray-400" />
                          No configurado / no responde
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Stats */}
          <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-6 py-3 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Envíos en las últimas 24 horas</h2>
            </div>
            {data.stats_24h.length === 0 ? (
              <div className="px-6 py-6 text-sm text-gray-500 text-center">
                Sin actividad reciente.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 font-semibold text-gray-600">Provider</th>
                    <th className="text-left px-4 py-2 font-semibold text-gray-600">Canal</th>
                    <th className="text-right px-4 py-2 font-semibold text-gray-600">Enviados</th>
                    <th className="text-right px-4 py-2 font-semibold text-gray-600">Fallos</th>
                    <th className="text-right px-4 py-2 font-semibold text-gray-600">Verificados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.stats_24h.map((s) => (
                    <tr key={`${s.provider}-${s.canal}`}>
                      <td className="px-4 py-3 font-medium text-gray-900">{s.provider}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                            canalColor[s.canal] ?? 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {canalLabel[s.canal] ?? s.canal}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{s.sent}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-red-700">{s.failed}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-green-700">{s.verified}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <p className="text-xs text-gray-500 text-right">
            Generado: {new Date(data.generated_at).toLocaleString('es-CL')}
          </p>
        </div>
      )}
    </div>
  );
}
