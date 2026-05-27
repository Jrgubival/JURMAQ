"use client"

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Maestro {
  id: string;
  codigo: string;
  nombre: string;
  rut: string;
  email: string | null;
  telefono: string | null;
  porcentaje_comision: number;
  activo: boolean;
  created_at: string;
}

/**
 * /admin/maestros — Programa de Referidos para Maestros (Tier 2 B1).
 *
 * Lista paginada + búsqueda + formulario crear. Cada maestro abre detalle
 * en /admin/maestros/[id] con stats + comisiones devengadas.
 */
export default function MaestrosAdminPage() {
  const [items, setItems] = useState<Maestro[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filtroActivo, setFiltroActivo] = useState<'todos' | 'activos' | 'inactivos'>('activos');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    nombre: '',
    rut: '',
    email: '',
    telefono: '',
    banco: '',
    tipo_cuenta: '',
    numero_cuenta: '',
    porcentaje_comision: 1.0,
    notas: '',
  });
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    void load();
  }, [q, filtroActivo]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim().length >= 2) params.set('q', q.trim());
    if (filtroActivo === 'activos') params.set('activo', 'true');
    else if (filtroActivo === 'inactivos') params.set('activo', 'false');

    const res = await fetch(`/api/admin/maestros?${params}`);
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
      const res = await fetch('/api/admin/maestros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          tipo_cuenta: form.tipo_cuenta || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: 'err', text: data.error || 'Error creando maestro' });
        return;
      }
      setMsg({ kind: 'ok', text: `Maestro ${data.maestro.codigo} creado` });
      setForm({
        nombre: '',
        rut: '',
        email: '',
        telefono: '',
        banco: '',
        tipo_cuenta: '',
        numero_cuenta: '',
        porcentaje_comision: 1.0,
        notas: '',
      });
      setShowForm(false);
      await load();
    } finally {
      setCreating(false);
      setTimeout(() => setMsg(null), 5000);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Maestros — Programa de Referidos</h1>
          <p className="text-sm text-gray-500">
            Maestros registrados con código MAE-AAAA-NNN. Clientes que ingresan el código en checkout
            generan comisión configurable (default 1% del neto) al maestro.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-xl"
        >
          {showForm ? 'Cancelar' : '+ Nuevo maestro'}
        </button>
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
      {showForm && (
        <form onSubmit={create} className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Nuevo maestro</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                type="text"
                required
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Juan Pérez González"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">RUT * (12345678-9)</label>
              <input
                type="text"
                required
                value={form.rut}
                onChange={(e) => setForm({ ...form, rut: e.target.value.toUpperCase() })}
                placeholder="12345678-9"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm uppercase"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="maestro@ejemplo.cl"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input
                type="tel"
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                placeholder="+56 9 XXXX XXXX"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">% Comisión</label>
              <input
                type="number"
                step={0.1}
                min={0}
                max={100}
                value={form.porcentaje_comision}
                onChange={(e) => setForm({ ...form, porcentaje_comision: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
              <input
                type="text"
                value={form.banco}
                onChange={(e) => setForm({ ...form, banco: e.target.value })}
                placeholder="BancoEstado / Santander / etc."
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo cuenta</label>
              <select
                value={form.tipo_cuenta}
                onChange={(e) => setForm({ ...form, tipo_cuenta: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
              >
                <option value="">—</option>
                <option value="cuenta_corriente">Cuenta corriente</option>
                <option value="cuenta_vista">Cuenta vista / RUT</option>
                <option value="cuenta_ahorro">Cuenta ahorro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número cuenta</label>
              <input
                type="text"
                value={form.numero_cuenta}
                onChange={(e) => setForm({ ...form, numero_cuenta: e.target.value })}
                placeholder="00012345678"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-mono"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas internas</label>
              <textarea
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                placeholder="Especialidad, contacto referido por, etc."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={creating || !form.nombre || !form.rut}
            className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-xl disabled:opacity-50"
          >
            {creating ? 'Creando…' : 'Crear maestro'}
          </button>
        </form>
      )}

      {/* Filtros + búsqueda */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, código, RUT o email…"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm"
        />
        <div className="flex gap-2">
          {(['activos', 'inactivos', 'todos'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltroActivo(f)}
              className={`px-3 py-2 text-sm rounded-xl ${
                filtroActivo === f
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Cargando…</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">Sin maestros registrados.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Código</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Nombre</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">RUT</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Contacto</th>
                <th className="text-right px-4 py-2 font-semibold text-gray-600">% Com.</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Desde</th>
                <th className="text-center px-4 py-2 font-semibold text-gray-600">Estado</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((m) => (
                <tr key={m.id} className={m.activo ? '' : 'opacity-50'}>
                  <td className="px-4 py-3 font-mono font-semibold text-gray-900">{m.codigo}</td>
                  <td className="px-4 py-3 text-gray-900">{m.nombre}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs font-mono">{m.rut}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs">
                    {m.email || '—'}
                    {m.telefono && <div className="text-gray-500">{m.telefono}</div>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{Number(m.porcentaje_comision).toFixed(2)}%</td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {new Date(m.created_at).toLocaleDateString('es-CL')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                        m.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {m.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/maestros/${m.id}`}
                      className="text-xs text-orange-600 hover:underline"
                    >
                      Ver detalle →
                    </Link>
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
