'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';

interface Maestro {
  id: string;
  codigo: string;
  nombre: string;
  rut: string;
  email: string | null;
  telefono: string | null;
  banco: string | null;
  tipo_cuenta: string | null;
  numero_cuenta: string | null;
  porcentaje_comision: number;
  activo: boolean;
  notas: string | null;
  created_at: string;
}

interface Comision {
  id: string;
  origen_tipo: string;
  origen_id: string;
  monto_venta_neto: number;
  porcentaje: number;
  monto_comision: number;
  estado: 'pendiente' | 'devengada' | 'pagada' | 'anulada';
  devengada_at: string | null;
  pagada_at: string | null;
  created_at: string;
}

interface Stats {
  total_referidos: number;
  pendiente: number;
  devengada: number;
  pagada: number;
  anulada: number;
  monto_devengado: number;
  monto_pagado: number;
}

const ESTADO_COLOR: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-700',
  devengada: 'bg-blue-100 text-blue-700',
  pagada: 'bg-green-100 text-green-700',
  anulada: 'bg-gray-100 text-gray-500',
};

export default function MaestroDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [maestro, setMaestro] = useState<Maestro | null>(null);
  const [comisiones, setComisiones] = useState<Comision[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Maestro>>({});

  useEffect(() => {
    void load();
  }, [id]);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/maestros/${id}`);
    if (res.ok) {
      const data = await res.json();
      setMaestro(data.maestro);
      setComisiones(data.comisiones || []);
      setStats(data.stats || null);
      setForm(data.maestro || {});
    }
    setLoading(false);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/maestros/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setEditing(false);
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6">Cargando…</div>;
  if (!maestro) return <div className="p-6">Maestro no encontrado</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/admin/maestros" className="text-sm text-orange-600 hover:underline">
        ← Volver al listado
      </Link>

      <div className="flex justify-between items-start mt-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{maestro.nombre}</h1>
          <p className="font-mono text-sm text-gray-500 mt-1">{maestro.codigo}</p>
        </div>
        <div className="flex gap-2">
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 bg-gray-900 text-white text-sm rounded-xl hover:bg-gray-800"
            >
              Editar
            </button>
          )}
          {editing && (
            <>
              <button
                onClick={() => { setEditing(false); setForm(maestro); }}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 bg-orange-600 text-white text-sm rounded-xl disabled:opacity-50"
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500">Total referidos</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total_referidos}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs text-blue-700">Devengado (por pagar)</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">
              ${stats.monto_devengado.toLocaleString('es-CL')}
            </p>
            <p className="text-xs text-blue-600 mt-1">{stats.devengada} comisiones</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-xs text-green-700">Ya pagado</p>
            <p className="text-2xl font-bold text-green-900 mt-1">
              ${stats.monto_pagado.toLocaleString('es-CL')}
            </p>
            <p className="text-xs text-green-600 mt-1">{stats.pagada} comisiones</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs text-amber-700">Pendientes</p>
            <p className="text-2xl font-bold text-amber-900 mt-1">{stats.pendiente}</p>
            <p className="text-xs text-amber-600 mt-1">Cotización aún no paga</p>
          </div>
        </div>
      )}

      {/* Datos personales + bancarios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Datos personales</h2>
          <dl className="text-sm space-y-2">
            <div>
              <dt className="text-gray-500 inline">RUT:</dt>{' '}
              <dd className="inline font-mono">{maestro.rut}</dd>
            </div>
            <div>
              <dt className="text-gray-500 inline">Email:</dt>{' '}
              {editing ? (
                <input
                  type="email"
                  value={form.email || ''}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="ml-2 px-2 py-1 border border-gray-300 rounded text-sm"
                />
              ) : (
                <dd className="inline">{maestro.email || '—'}</dd>
              )}
            </div>
            <div>
              <dt className="text-gray-500 inline">Teléfono:</dt>{' '}
              {editing ? (
                <input
                  type="tel"
                  value={form.telefono || ''}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  className="ml-2 px-2 py-1 border border-gray-300 rounded text-sm"
                />
              ) : (
                <dd className="inline">{maestro.telefono || '—'}</dd>
              )}
            </div>
            <div>
              <dt className="text-gray-500 inline">% Comisión:</dt>{' '}
              {editing ? (
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  max={100}
                  value={form.porcentaje_comision ?? 1}
                  onChange={(e) => setForm({ ...form, porcentaje_comision: Number(e.target.value) })}
                  className="ml-2 px-2 py-1 w-24 border border-gray-300 rounded text-sm"
                />
              ) : (
                <dd className="inline font-semibold">{Number(maestro.porcentaje_comision).toFixed(2)}%</dd>
              )}
            </div>
            <div>
              <dt className="text-gray-500 inline">Estado:</dt>{' '}
              {editing ? (
                <select
                  value={form.activo ? 'true' : 'false'}
                  onChange={(e) => setForm({ ...form, activo: e.target.value === 'true' })}
                  className="ml-2 px-2 py-1 border border-gray-300 rounded text-sm"
                >
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              ) : (
                <dd className="inline">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                      maestro.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {maestro.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </dd>
              )}
            </div>
            <div className="pt-2">
              <dt className="text-gray-500 text-xs">Notas internas:</dt>
              {editing ? (
                <textarea
                  value={form.notas || ''}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  rows={2}
                  className="mt-1 w-full px-2 py-1 border border-gray-300 rounded text-sm"
                />
              ) : (
                <dd className="text-gray-700 text-sm">{maestro.notas || '—'}</dd>
              )}
            </div>
          </dl>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Datos bancarios (privado)</h2>
          <dl className="text-sm space-y-2">
            <div>
              <dt className="text-gray-500 inline">Banco:</dt>{' '}
              {editing ? (
                <input
                  type="text"
                  value={form.banco || ''}
                  onChange={(e) => setForm({ ...form, banco: e.target.value })}
                  className="ml-2 px-2 py-1 border border-gray-300 rounded text-sm"
                />
              ) : (
                <dd className="inline">{maestro.banco || '—'}</dd>
              )}
            </div>
            <div>
              <dt className="text-gray-500 inline">Tipo:</dt>{' '}
              {editing ? (
                <select
                  value={form.tipo_cuenta || ''}
                  onChange={(e) => setForm({ ...form, tipo_cuenta: e.target.value || null })}
                  className="ml-2 px-2 py-1 border border-gray-300 rounded text-sm"
                >
                  <option value="">—</option>
                  <option value="cuenta_corriente">Corriente</option>
                  <option value="cuenta_vista">Vista / RUT</option>
                  <option value="cuenta_ahorro">Ahorro</option>
                </select>
              ) : (
                <dd className="inline">{maestro.tipo_cuenta?.replace('cuenta_', '') || '—'}</dd>
              )}
            </div>
            <div>
              <dt className="text-gray-500 inline">Número:</dt>{' '}
              {editing ? (
                <input
                  type="text"
                  value={form.numero_cuenta || ''}
                  onChange={(e) => setForm({ ...form, numero_cuenta: e.target.value })}
                  className="ml-2 px-2 py-1 border border-gray-300 rounded text-sm font-mono"
                />
              ) : (
                <dd className="inline font-mono">{maestro.numero_cuenta || '—'}</dd>
              )}
            </div>
          </dl>
          <p className="text-xs text-amber-700 mt-4 bg-amber-50 p-2 rounded">
            ⚠️ Estos datos NO se exponen en endpoints públicos. Solo admin/contador los ven.
          </p>
        </section>
      </div>

      {/* Comisiones recientes */}
      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-semibold text-gray-900">Comisiones ({comisiones.length})</h2>
          <Link
            href={`/admin/comisiones?maestro_id=${id}`}
            className="text-xs text-orange-600 hover:underline"
          >
            Ver todas en pestaña Comisiones →
          </Link>
        </div>
        {comisiones.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">Sin referidos aún.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Origen</th>
                <th className="text-right px-4 py-2 font-semibold text-gray-600">Venta neta</th>
                <th className="text-right px-4 py-2 font-semibold text-gray-600">%</th>
                <th className="text-right px-4 py-2 font-semibold text-gray-600">Comisión</th>
                <th className="text-center px-4 py-2 font-semibold text-gray-600">Estado</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {comisiones.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 text-xs text-gray-700 font-mono">
                    {c.origen_tipo === 'barraca_cotizacion' ? '🧾 Cotiz' : c.origen_tipo} #{c.origen_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    ${Number(c.monto_venta_neto).toLocaleString('es-CL')}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">{Number(c.porcentaje).toFixed(2)}%</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">
                    ${Number(c.monto_comision).toLocaleString('es-CL')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADO_COLOR[c.estado] ?? ''}`}>
                      {c.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {new Date(c.created_at).toLocaleDateString('es-CL')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Link público para compartir */}
      <section className="bg-orange-50 border border-orange-200 rounded-xl p-5">
        <h3 className="font-semibold text-orange-900 mb-2">📤 Link para compartir con clientes</h3>
        <p className="text-sm text-orange-800 mb-3">
          El maestro comparte este URL en WhatsApp/redes. Cuando un cliente entra, se preselecciona su código.
        </p>
        <code className="block bg-white border border-orange-200 rounded-lg px-3 py-2 text-sm font-mono text-orange-900 break-all">
          https://barraca.jurmaq.cl/maestros/{maestro.codigo}
        </code>
      </section>
    </div>
  );
}
