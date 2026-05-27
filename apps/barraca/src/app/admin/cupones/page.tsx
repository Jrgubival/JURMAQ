"use client"

import { useEffect, useState } from 'react';

interface Cupon {
  id: string;
  codigo: string;
  descripcion: string | null;
  tipo: 'porcentaje' | 'monto_fijo';
  valor: number;
  monto_minimo_compra: number;
  max_usos_total: number | null;
  max_usos_por_usuario: number;
  usos_actuales: number;
  valido_desde: string;
  valido_hasta: string | null;
  activo: boolean;
}

export default function CuponesAdminPage() {
  const [items, setItems] = useState<Cupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    codigo: '',
    descripcion: '',
    tipo: 'porcentaje' as 'porcentaje' | 'monto_fijo',
    valor: 10,
    monto_minimo_compra: 0,
    max_usos_total: '',
    max_usos_por_usuario: 1,
    valido_hasta: '',
  });
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/cupones');
    if (res.ok) {
      const data = await res.json();
      setItems(data.items || []);
    }
    setLoading(false);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/cupones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          max_usos_total: form.max_usos_total ? Number(form.max_usos_total) : null,
          valido_hasta: form.valido_hasta || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: 'err', text: data.error || 'Error' });
        return;
      }
      setMsg({ kind: 'ok', text: `Cupón ${data.cupon.codigo} creado` });
      setForm({
        codigo: '',
        descripcion: '',
        tipo: 'porcentaje',
        valor: 10,
        monto_minimo_compra: 0,
        max_usos_total: '',
        max_usos_por_usuario: 1,
        valido_hasta: '',
      });
      await load();
    } finally {
      setCreating(false);
      setTimeout(() => setMsg(null), 4000);
    }
  }

  async function toggleActivo(c: Cupon) {
    const res = await fetch(`/api/admin/cupones/${c.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !c.activo }),
    });
    if (res.ok) void load();
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cupones de descuento</h1>
        <p className="text-sm text-gray-500">
          Códigos de descuento aplicables en el checkout. Validez por porcentaje o monto fijo.
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

      {/* Form crear */}
      <form onSubmit={create} className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">+ Nuevo cupón</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código *</label>
            <input
              type="text"
              required
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
              placeholder="BIENVENIDO20"
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-mono uppercase"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
            <select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value as 'porcentaje' | 'monto_fijo' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
            >
              <option value="porcentaje">% Porcentaje</option>
              <option value="monto_fijo">$ Monto fijo CLP</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Valor * ({form.tipo === 'porcentaje' ? '%' : 'CLP'})
            </label>
            <input
              type="number"
              required
              min={0}
              max={form.tipo === 'porcentaje' ? 100 : undefined}
              value={form.valor}
              onChange={(e) => setForm({ ...form, valor: Number(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opc)</label>
            <input
              type="text"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Ej: Descuento bienvenida nuevos clientes"
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Compra mínima CLP</label>
            <input
              type="number"
              min={0}
              step={1000}
              value={form.monto_minimo_compra}
              onChange={(e) => setForm({ ...form, monto_minimo_compra: Number(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max usos total (opc)</label>
            <input
              type="number"
              min={1}
              value={form.max_usos_total}
              onChange={(e) => setForm({ ...form, max_usos_total: e.target.value })}
              placeholder="Ilimitado"
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vence (opc)</label>
            <input
              type="date"
              value={form.valido_hasta}
              onChange={(e) => setForm({ ...form, valido_hasta: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={creating || !form.codigo || form.valor <= 0}
          className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-xl disabled:opacity-50"
        >
          {creating ? 'Creando…' : 'Crear cupón'}
        </button>
      </form>

      {/* Lista */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Cargando…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">Sin cupones creados.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Código</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Descripción</th>
                <th className="text-right px-4 py-2 font-semibold text-gray-600">Valor</th>
                <th className="text-right px-4 py-2 font-semibold text-gray-600">Mín. compra</th>
                <th className="text-right px-4 py-2 font-semibold text-gray-600">Usos</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Vence</th>
                <th className="text-center px-4 py-2 font-semibold text-gray-600">Estado</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((c) => (
                <tr key={c.id} className={c.activo ? '' : 'opacity-50'}>
                  <td className="px-4 py-3 font-mono font-semibold text-gray-900">{c.codigo}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs">{c.descripcion || '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {c.tipo === 'porcentaje' ? `${c.valor}%` : `$${c.valor.toLocaleString('es-CL')}`}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                    ${c.monto_minimo_compra.toLocaleString('es-CL')}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                    {c.usos_actuales}/{c.max_usos_total ?? '∞'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {c.valido_hasta ? new Date(c.valido_hasta).toLocaleDateString('es-CL') : 'Sin vencimiento'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                        c.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {c.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleActivo(c)}
                      className="text-xs text-orange-600 hover:underline"
                    >
                      {c.activo ? 'Desactivar' : 'Activar'}
                    </button>
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
