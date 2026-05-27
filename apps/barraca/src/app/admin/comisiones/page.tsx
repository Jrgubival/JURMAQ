"use client"

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface MaestroEmbed {
  codigo: string;
  nombre: string;
  rut: string;
  email: string | null;
  banco: string | null;
  tipo_cuenta: string | null;
  numero_cuenta: string | null;
}

interface Comision {
  id: string;
  maestro_id: string;
  origen_tipo: string;
  origen_id: string;
  monto_venta_neto: number;
  porcentaje: number;
  monto_comision: number;
  estado: 'pendiente' | 'devengada' | 'pagada' | 'anulada';
  devengada_at: string | null;
  pagada_at: string | null;
  pago_referencia: string | null;
  notas: string | null;
  created_at: string;
  maestros: MaestroEmbed | null;
}

const ESTADO_COLOR: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-700',
  devengada: 'bg-blue-100 text-blue-700',
  pagada: 'bg-green-100 text-green-700',
  anulada: 'bg-gray-100 text-gray-500',
};

const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'Pendientes (cotiz. no pagada)',
  devengada: 'Devengadas (por pagar al maestro)',
  pagada: 'Pagadas',
  anulada: 'Anuladas',
};

function ComisionesContent() {
  const searchParams = useSearchParams();
  const maestroIdFilter = searchParams.get('maestro_id');

  const [items, setItems] = useState<Comision[]>([]);
  const [resumen, setResumen] = useState<{ total: number; monto_devengado: number; monto_pagado: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [estado, setEstado] = useState<'devengada' | 'pagada' | 'pendiente' | 'anulada'>('devengada');
  const [pagando, setPagando] = useState<string | null>(null);
  const [pagoRef, setPagoRef] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    void load();
  }, [estado, maestroIdFilter]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ estado });
    if (maestroIdFilter) params.set('maestro_id', maestroIdFilter);

    const res = await fetch(`/api/admin/comisiones?${params}`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items || []);
      setResumen(data.resumen || null);
    }
    setLoading(false);
  }

  async function pagar(c: Comision) {
    const ref = pagoRef[c.id]?.trim();
    if (!ref) {
      setMsg({ kind: 'err', text: 'Ingresa la referencia bancaria del pago' });
      setTimeout(() => setMsg(null), 3000);
      return;
    }
    setPagando(c.id);
    try {
      const res = await fetch(`/api/admin/comisiones/${c.id}/pagar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pago_referencia: ref }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: 'err', text: data.error || 'Error marcando pago' });
        return;
      }
      setMsg({ kind: 'ok', text: `Comisión pagada (${ref})` });
      setPagoRef((prev) => {
        const next = { ...prev };
        delete next[c.id];
        return next;
      });
      await load();
    } finally {
      setPagando(null);
      setTimeout(() => setMsg(null), 4000);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Comisiones a Maestros</h1>
        <p className="text-sm text-gray-500">
          Gestión de pagos del programa de referidos. Las comisiones se devengan automáticamente
          cuando una cotización con código de maestro pasa a estado <strong>pagada</strong>.
        </p>
      </div>

      {msg && (
        <div
          className={`mb-4 px-4 py-3 rounded-xl text-sm ${
            msg.kind === 'ok'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Resumen */}
      {resumen && estado === 'devengada' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs text-blue-700">Por pagar (devengado)</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">
              ${resumen.monto_devengado.toLocaleString('es-CL')}
            </p>
            <p className="text-xs text-blue-600 mt-1">{resumen.total} comisiones</p>
          </div>
        </div>
      )}

      {maestroIdFilter && (
        <div className="mb-4 bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm">
          Filtrando por maestro específico.{' '}
          <Link href="/admin/comisiones" className="text-orange-600 hover:underline">
            Ver todas
          </Link>
        </div>
      )}

      {/* Tabs estado */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {(['devengada', 'pagada', 'pendiente', 'anulada'] as const).map((e) => (
          <button
            key={e}
            onClick={() => setEstado(e)}
            className={`px-4 py-2 text-sm rounded-xl whitespace-nowrap ${
              estado === e
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            {ESTADO_LABEL[e]}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Cargando…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            Sin comisiones en estado &ldquo;{estado}&rdquo;.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Maestro</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Origen</th>
                <th className="text-right px-4 py-2 font-semibold text-gray-600">Venta neta</th>
                <th className="text-right px-4 py-2 font-semibold text-gray-600">Comisión</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Datos bancarios</th>
                {estado === 'devengada' && (
                  <th className="text-center px-4 py-2 font-semibold text-gray-600">Acción</th>
                )}
                {estado === 'pagada' && (
                  <th className="text-left px-4 py-2 font-semibold text-gray-600">Pagada</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/maestros/${c.maestro_id}`}
                      className="font-mono text-orange-600 hover:underline"
                    >
                      {c.maestros?.codigo}
                    </Link>
                    <div className="text-xs text-gray-700">{c.maestros?.nombre}</div>
                    <div className="text-xs text-gray-500 font-mono">{c.maestros?.rut}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700 font-mono">
                    {c.origen_tipo === 'barraca_cotizacion' ? '🧾 Cotiz' : c.origen_tipo}{' '}
                    #{c.origen_id.slice(0, 8)}
                    <div className="text-gray-500">
                      {new Date(c.created_at).toLocaleDateString('es-CL')}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    ${Number(c.monto_venta_neto).toLocaleString('es-CL')}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">
                    ${Number(c.monto_comision).toLocaleString('es-CL')}
                    <div className="text-xs text-gray-500 font-normal">
                      ({Number(c.porcentaje).toFixed(2)}%)
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {c.maestros?.banco ? (
                      <>
                        <div>{c.maestros.banco}</div>
                        <div className="text-gray-500">
                          {c.maestros.tipo_cuenta?.replace('cuenta_', '') ?? ''}
                        </div>
                        <div className="font-mono">{c.maestros.numero_cuenta || '—'}</div>
                      </>
                    ) : (
                      <span className="text-amber-600">⚠ Sin datos bancarios</span>
                    )}
                  </td>
                  {estado === 'devengada' && (
                    <td className="px-4 py-3 text-center">
                      <div className="flex gap-2 items-center justify-center">
                        <input
                          type="text"
                          placeholder="Ref. pago"
                          value={pagoRef[c.id] || ''}
                          onChange={(e) =>
                            setPagoRef((prev) => ({ ...prev, [c.id]: e.target.value }))
                          }
                          className="w-28 px-2 py-1 border border-gray-300 rounded text-xs"
                        />
                        <button
                          onClick={() => pagar(c)}
                          disabled={pagando === c.id || !pagoRef[c.id]?.trim()}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded disabled:opacity-50"
                        >
                          {pagando === c.id ? '…' : 'Marcar pagada'}
                        </button>
                      </div>
                    </td>
                  )}
                  {estado === 'pagada' && (
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {c.pagada_at ? new Date(c.pagada_at).toLocaleDateString('es-CL') : '—'}
                      <div className="text-gray-500 font-mono">
                        {c.pago_referencia || ''}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function ComisionesAdminPage() {
  return (
    <Suspense fallback={<div className="p-6">Cargando…</div>}>
      <ComisionesContent />
    </Suspense>
  );
}
