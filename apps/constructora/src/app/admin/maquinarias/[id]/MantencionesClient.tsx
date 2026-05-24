'use client';

import { useEffect, useState } from 'react';
import { formatCLP } from '@jurmaq/shared/format';

/**
 * Tier 5 E2: Historial de mantenciones por máquina.
 *
 * Timeline con todas las mantenciones registradas + form para agregar nueva
 * + KPIs (total gastado, última, próxima programada).
 */

interface Mantencion {
  id: string;
  tipo: string;
  descripcion: string;
  fecha: string;
  costo: number;
  horometro_km: number | null;
  proveedor: string | null;
  factura_url: string | null;
  proxima_mantencion_at: string | null;
  notas: string | null;
  created_at: string;
}

interface Stats {
  total_gastado: number;
  total_mantenciones: number;
  ultima_fecha: string | null;
  proxima_at: string | null;
  dias_restantes: number | null;
}

const TIPO_OPTIONS: Array<{ value: string; label: string; icon: string }> = [
  { value: 'preventiva', label: 'Mantención preventiva', icon: '🔧' },
  { value: 'correctiva', label: 'Reparación / correctiva', icon: '🛠' },
  { value: 'inspeccion', label: 'Inspección técnica', icon: '🔍' },
  { value: 'cambio_aceite', label: 'Cambio de aceite', icon: '🛢' },
  { value: 'cambio_filtro', label: 'Cambio de filtros', icon: '🧴' },
  { value: 'neumaticos', label: 'Neumáticos', icon: '🛞' },
  { value: 'pintura_reparacion', label: 'Pintura / cosmético', icon: '🎨' },
  { value: 'otro', label: 'Otro', icon: '📋' },
];

const TIPO_BADGE: Record<string, string> = {
  preventiva: 'bg-blue-100 text-blue-700',
  correctiva: 'bg-red-100 text-red-700',
  inspeccion: 'bg-purple-100 text-purple-700',
  cambio_aceite: 'bg-amber-100 text-amber-700',
  cambio_filtro: 'bg-amber-100 text-amber-700',
  neumaticos: 'bg-gray-200 text-gray-700',
  pintura_reparacion: 'bg-pink-100 text-pink-700',
  otro: 'bg-gray-100 text-gray-700',
};

export default function MantencionesClient({ maquinariaId }: { maquinariaId: number }) {
  const [items, setItems] = useState<Mantencion[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [form, setForm] = useState({
    tipo: 'preventiva',
    descripcion: '',
    fecha: new Date().toISOString().slice(0, 10),
    costo: 0,
    horometro_km: '',
    proveedor: '',
    factura_url: '',
    proxima_mantencion_at: '',
    notas: '',
  });

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/maquinarias/${maquinariaId}/mantenciones`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items || []);
      setStats(data.stats || null);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maquinariaId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.descripcion.trim() || form.descripcion.length < 5) {
      setMsg({ kind: 'err', text: 'Descripción requerida (mín 5 chars)' });
      return;
    }
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/maquinarias/${maquinariaId}/mantenciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          horometro_km: form.horometro_km !== '' ? Number(form.horometro_km) : null,
          proxima_mantencion_at: form.proxima_mantencion_at || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: 'err', text: data.error || 'Error al guardar' });
        return;
      }
      setMsg({ kind: 'ok', text: 'Mantención registrada' });
      setForm({
        tipo: 'preventiva',
        descripcion: '',
        fecha: new Date().toISOString().slice(0, 10),
        costo: 0,
        horometro_km: '',
        proveedor: '',
        factura_url: '',
        proxima_mantencion_at: '',
        notas: '',
      });
      setShowForm(false);
      await load();
    } finally {
      setSubmitting(false);
      setTimeout(() => setMsg(null), 4000);
    }
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este registro de mantención?')) return;
    const res = await fetch(`/api/admin/maquinarias/${maquinariaId}/mantenciones/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) await load();
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-lg font-bold text-navy-950">Historial de mantenciones</h2>
          <p className="text-xs text-gray-500 mt-1">
            Pautas preventivas, correctivas y costos asociados a esta máquina.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-xl"
        >
          {showForm ? 'Cancelar' : '+ Registrar mantención'}
        </button>
      </div>

      {msg && (
        <div
          className={`mb-4 px-4 py-2 rounded-lg text-sm ${
            msg.kind === 'ok'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-xs text-gray-500">Mantenciones</p>
            <p className="text-xl font-bold text-gray-900">{stats.total_mantenciones}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-xs text-red-700">Total gastado</p>
            <p className="text-xl font-bold text-red-900">{formatCLP(stats.total_gastado)}</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-xs text-gray-500">Última</p>
            <p className="text-sm font-bold text-gray-900">
              {stats.ultima_fecha
                ? new Date(stats.ultima_fecha).toLocaleDateString('es-CL')
                : '—'}
            </p>
          </div>
          <div
            className={`border rounded-lg p-3 ${
              stats.dias_restantes !== null && stats.dias_restantes <= 14
                ? 'bg-amber-50 border-amber-300'
                : 'bg-gray-50 border-gray-200'
            }`}
          >
            <p className="text-xs text-gray-500">Próxima programada</p>
            <p className="text-sm font-bold text-gray-900">
              {stats.proxima_at ? (
                <>
                  {new Date(stats.proxima_at).toLocaleDateString('es-CL')}
                  {stats.dias_restantes !== null && (
                    <span
                      className={`ml-2 text-xs ${
                        stats.dias_restantes <= 7
                          ? 'text-red-600 font-semibold'
                          : stats.dias_restantes <= 14
                          ? 'text-amber-600'
                          : 'text-gray-500'
                      }`}
                    >
                      ({stats.dias_restantes}d)
                    </span>
                  )}
                </>
              ) : (
                '—'
              )}
            </p>
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={submit} className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Tipo *</label>
              <select
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {TIPO_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.icon} {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Fecha *</label>
              <input
                type="date"
                required
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Descripción del trabajo *</label>
              <textarea
                required
                rows={2}
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Ej: Pauta 250h. Cambio aceite motor y filtros. Revisión sistema hidráulico."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Costo neto (CLP)</label>
              <input
                type="number"
                min={0}
                step={1000}
                value={form.costo}
                onChange={(e) => setForm({ ...form, costo: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Horómetro / km (lectura)
              </label>
              <input
                type="number"
                step={0.1}
                min={0}
                value={form.horometro_km}
                onChange={(e) => setForm({ ...form, horometro_km: e.target.value })}
                placeholder="Ej: 1250.5"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Proveedor / taller</label>
              <input
                type="text"
                value={form.proveedor}
                onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
                placeholder="Servitec Maule, Taller Pérez, etc."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">URL factura (opcional)</label>
              <input
                type="url"
                value={form.factura_url}
                onChange={(e) => setForm({ ...form, factura_url: e.target.value })}
                placeholder="https://…/factura.pdf"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Próxima mantención programada (opcional)
              </label>
              <input
                type="date"
                value={form.proxima_mantencion_at}
                onChange={(e) => setForm({ ...form, proxima_mantencion_at: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Notas internas</label>
              <textarea
                rows={2}
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                placeholder="Repuestos cambiados, observaciones del taller, etc."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
            >
              {submitting ? 'Guardando…' : 'Registrar'}
            </button>
          </div>
        </form>
      )}

      {/* Timeline */}
      {loading ? (
        <div className="text-center py-6 text-sm text-gray-500">Cargando…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg">
          Sin mantenciones registradas todavía.
        </div>
      ) : (
        <ol className="relative border-l-2 border-gray-200 ml-2 space-y-3">
          {items.map((m) => {
            const tipoMeta = TIPO_OPTIONS.find((t) => t.value === m.tipo);
            return (
              <li key={m.id} className="ml-4 pl-2">
                <span className="absolute -left-[7px] mt-1.5 w-3 h-3 bg-orange-500 rounded-full border-2 border-white" />
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        TIPO_BADGE[m.tipo] ?? 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {tipoMeta?.icon} {tipoMeta?.label}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(m.fecha).toLocaleDateString('es-CL')}
                    </span>
                    {m.horometro_km !== null && (
                      <span className="text-xs text-gray-500">@ {m.horometro_km} hrs/km</span>
                    )}
                    <span className="ml-auto font-bold text-red-600 text-sm">
                      {formatCLP(m.costo)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800">{m.descripcion}</p>
                  {(m.proveedor || m.notas || m.factura_url) && (
                    <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-600 space-y-0.5">
                      {m.proveedor && <p>🏪 {m.proveedor}</p>}
                      {m.notas && <p className="text-gray-500">{m.notas}</p>}
                      {m.factura_url && (
                        <a
                          href={m.factura_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          📄 Ver factura
                        </a>
                      )}
                    </div>
                  )}
                  {m.proxima_mantencion_at && (
                    <p className="mt-1 text-[11px] text-amber-700 font-medium">
                      ⏰ Próxima programada:{' '}
                      {new Date(m.proxima_mantencion_at).toLocaleDateString('es-CL')}
                    </p>
                  )}
                  <button
                    onClick={() => eliminar(m.id)}
                    className="mt-2 text-[10px] text-red-600 hover:underline"
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
