'use client';

import { useState, useEffect } from 'react';
import { formatCLP } from "@jurmaq/shared/format";

// Aligned with the actual `cotizaciones` table schema.
// `cliente` / `monto` / `fecha` are UI-only aliases populated in the fetch mapper below.
interface Cotizacion {
  id: number | string;
  numero?: number | null;
  cliente_nombre: string | null;
  cliente_email: string | null;
  cliente_empresa?: string | null;
  cliente_telefono?: string | null;
  servicio: string | null;
  descripcion?: string | null; // kept for backward-compat, not in DB
  monto_total: number | null;
  estado: 'pendiente' | 'enviada' | 'aceptada' | 'rechazada';
  created_at: string;
  notas: string | null;
  items: { descripcion: string; cantidad: number; precio_unitario: number }[];
}

const estadoColors: Record<string, { bg: string; text: string; label: string }> = {
  pendiente: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Pendiente' },
  enviada: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Enviada' },
  aceptada: { bg: 'bg-green-100', text: 'text-green-700', label: 'Aceptada' },
  rechazada: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rechazada' },
};

const estadoFlow: Record<string, string[]> = {
  pendiente: ['enviada'],
  enviada: ['aceptada', 'rechazada'],
  aceptada: [],
  rechazada: [],
};

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('es-CL');
};

const emptyCotizacion = {
  cliente_nombre: '',
  cliente_email: '',
  cliente_empresa: '',
  cliente_telefono: '',
  servicio: '',
  notas: '',
  monto_total: 0,
  estado: 'pendiente' as Cotizacion['estado'],
  items: [{ descripcion: '', cantidad: 1, precio_unitario: 0 }],
};

export default function CotizacionesPage() {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Cotizacion | null>(null);
  const [form, setForm] = useState(emptyCotizacion);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | number | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/cotizaciones');
      if (res.ok) {
        const data = await res.json();
        setCotizaciones(Array.isArray(data) ? data : data.data || []);
      }
    } catch (err) {
      console.error('Error fetching cotizaciones:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyCotizacion);
    setShowModal(true);
  };

  const openEdit = (cot: Cotizacion) => {
    setEditing(cot);
    setForm({
      cliente_nombre: cot.cliente_nombre || '',
      cliente_email: cot.cliente_email || '',
      cliente_empresa: cot.cliente_empresa || '',
      cliente_telefono: cot.cliente_telefono || '',
      servicio: cot.servicio || '',
      notas: cot.notas || '',
      monto_total: cot.monto_total || 0,
      estado: cot.estado,
      items: cot.items && cot.items.length > 0 ? cot.items : [{ descripcion: '', cantidad: 1, precio_unitario: 0 }],
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const totalMonto = form.items.reduce((sum, item) => sum + item.cantidad * item.precio_unitario, 0);
    // Payload uses the DB-aligned field names. The PUT handler already accepts both
    // camelCase and snake_case, so we send snake_case + clienteNombre alias for safety.
    const payload = {
      clienteNombre: form.cliente_nombre,
      cliente_nombre: form.cliente_nombre,
      cliente_email: form.cliente_email,
      cliente_empresa: form.cliente_empresa,
      cliente_telefono: form.cliente_telefono,
      servicio: form.servicio,
      notas: form.notas,
      estado: form.estado,
      items: form.items,
      monto_total: totalMonto || form.monto_total || 0,
      monto: totalMonto || form.monto_total || 0, // UI-side alias, some handlers expect this
    };
    try {
      const url = editing ? `/api/cotizaciones/${editing.id}` : '/api/cotizaciones';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShowModal(false);
        fetchData();
      }
    } catch (err) {
      console.error('Error saving:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string | number) => {
    try {
      const res = await fetch(`/api/cotizaciones/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteConfirm(null);
        fetchData();
      }
    } catch (err) {
      console.error('Error deleting:', err);
    }
  };

  const handleStatusChange = async (cot: Cotizacion, newEstado: string) => {
    try {
      await fetch(`/api/cotizaciones/${cot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cot, estado: newEstado }),
      });
      fetchData();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const addItem = () => {
    setForm({
      ...form,
      items: [...form.items, { descripcion: '', cantidad: 1, precio_unitario: 0 }],
    });
  };

  const removeItem = (idx: number) => {
    setForm({
      ...form,
      items: form.items.filter((_, i) => i !== idx),
    });
  };

  const updateItem = (idx: number, field: string, value: string | number) => {
    const newItems = [...form.items];
    newItems[idx] = { ...newItems[idx], [field]: value };
    setForm({ ...form, items: newItems });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#e6b422' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cotizaciones</h1>
          <p className="text-sm text-gray-500 mt-1">{cotizaciones.length} cotizaciones registradas</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium text-sm transition hover:opacity-90"
          style={{ backgroundColor: '#0c1d3a' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva Cotizacion
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase bg-gray-50">
                <th className="px-6 py-3">#</th>
                <th className="px-6 py-3">Cliente</th>
                <th className="px-6 py-3">Servicio</th>
                <th className="px-6 py-3">Monto</th>
                <th className="px-6 py-3">Estado</th>
                <th className="px-6 py-3">Fecha</th>
                <th className="px-6 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cotizaciones.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400 text-sm">
                    No hay cotizaciones registradas
                  </td>
                </tr>
              ) : (
                cotizaciones.map((cot) => {
                  const est = estadoColors[cot.estado] || estadoColors.pendiente;
                  const nextStates = estadoFlow[cot.estado] || [];
                  return (
                    <tr key={cot.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-600 font-mono">{cot.numero ?? `#${cot.id}`}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{cot.cliente_nombre || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{cot.servicio}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{formatCLP(cot.monto_total || 0)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${est.bg} ${est.text}`}>
                          {est.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{formatDate(cot.created_at)}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2 flex-wrap">
                          {nextStates.map((ns) => {
                            const nsColors = estadoColors[ns];
                            return (
                              <button
                                key={ns}
                                onClick={() => handleStatusChange(cot, ns)}
                                className={`px-2.5 py-1 text-xs font-medium rounded-md border transition hover:opacity-80 ${nsColors.bg} ${nsColors.text}`}
                              >
                                {nsColors.label}
                              </button>
                            );
                          })}
                          <button
                            onClick={() => openEdit(cot)}
                            className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
                          >
                            Editar
                          </button>
                          {deleteConfirm === cot.id ? (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleDelete(cot.id)}
                                className="px-2 py-1.5 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-700"
                              >
                                Si
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-2 py-1.5 text-xs font-medium rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(cot.id)}
                              className="px-3 py-1.5 text-xs font-medium rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition"
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {editing ? 'Editar Cotizacion' : 'Nueva Cotizacion'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                  <input
                    type="text"
                    value={form.cliente_nombre}
                    onChange={(e) => setForm({ ...form, cliente_nombre: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900"
                    placeholder="Nombre del cliente"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Cliente</label>
                  <input
                    type="email"
                    value={form.cliente_email}
                    onChange={(e) => setForm({ ...form, cliente_email: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900"
                    placeholder="correo@ejemplo.cl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
                  <input
                    type="text"
                    value={form.cliente_empresa}
                    onChange={(e) => setForm({ ...form, cliente_empresa: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900"
                    placeholder="(opcional)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                  <input
                    type="tel"
                    value={form.cliente_telefono}
                    onChange={(e) => setForm({ ...form, cliente_telefono: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900"
                    placeholder="+56 9 ..."
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Servicio</label>
                <input
                  type="text"
                  value={form.servicio}
                  onChange={(e) => setForm({ ...form, servicio: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900"
                  placeholder="Ej: Arriendo Retroexcavadora"
                />
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Items</label>
                  <button
                    type="button"
                    onClick={addItem}
                    className="text-xs font-medium hover:underline"
                    style={{ color: '#e6b422' }}
                  >
                    + Agregar item
                  </button>
                </div>
                <div className="space-y-2">
                  {form.items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <input
                        type="text"
                        value={item.descripcion}
                        onChange={(e) => updateItem(idx, 'descripcion', e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 text-sm"
                        placeholder="Descripcion"
                      />
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.cantidad}
                        onChange={(e) => updateItem(idx, 'cantidad', Number(e.target.value))}
                        className="w-20 px-3 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 text-sm"
                        placeholder="Cant."
                      />
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={item.precio_unitario}
                        onChange={(e) => updateItem(idx, 'precio_unitario', Number(e.target.value))}
                        className="w-32 px-3 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 text-sm"
                        placeholder="Precio unit."
                      />
                      <span className="py-2 text-sm text-gray-600 w-28 text-right">
                        {formatCLP(item.cantidad * item.precio_unitario)}
                      </span>
                      {form.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="p-2 text-red-400 hover:text-red-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-right">
                  <span className="text-sm text-gray-500">Total: </span>
                  <span className="text-lg font-bold" style={{ color: '#0c1d3a' }}>
                    {formatCLP(form.items.reduce((sum, item) => sum + item.cantidad * item.precio_unitario, 0))}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 resize-none"
                  placeholder="Notas internas o detalles adicionales..."
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.cliente_nombre}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: '#0c1d3a' }}
              >
                {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
