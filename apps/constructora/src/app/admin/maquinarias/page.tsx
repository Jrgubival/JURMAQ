'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatCLP } from "@jurmaq/shared/format";

type TipoCombustible = '' | 'diesel' | 'gasolina_93' | 'gasolina_95' | 'gasolina_97' | 'kerosene' | 'otro';

interface Maquinaria {
  id: string;
  nombre: string;
  tipo: string;
  descripcion: string;
  precio_dia: number;
  precio_semana: number;
  precio_mes: number;
  garantia_monto: number;
  tipo_combustible: TipoCombustible;
  estado: 'disponible' | 'arrendada' | 'mantencion';
  imagen: string;
  /** JSON column on the DB. Stored as text — parse before reading. */
  especificaciones: string | null;
  // Convenience fields derived from `especificaciones` for the form. Not in DB.
  marca?: string;
  modelo?: string;
  serie?: string;
  anio?: string;
}

/** Parse the `especificaciones` JSON column safely. */
function parseEspec(raw: unknown): Record<string, string> {
  if (!raw) return {};
  if (typeof raw === 'object' && raw !== null) return raw as Record<string, string>;
  if (typeof raw !== 'string') return {};
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

const estadoColors: Record<string, { bg: string; text: string; label: string }> = {
  disponible: { bg: 'bg-green-100', text: 'text-green-700', label: 'Disponible' },
  arrendada: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Arrendada' },
  mantencion: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Mantencion' },
};

const emptyMaquinaria: Omit<Maquinaria, 'id'> = {
  nombre: '',
  tipo: '',
  descripcion: '',
  precio_dia: 0,
  precio_semana: 0,
  precio_mes: 0,
  garantia_monto: 0,
  tipo_combustible: '',
  estado: 'disponible',
  imagen: '',
  especificaciones: null,
  marca: '',
  modelo: '',
  serie: '',
  anio: '',
};

export default function MaquinariasPage() {
  const [maquinarias, setMaquinarias] = useState<Maquinaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Maquinaria | null>(null);
  const [form, setForm] = useState<Omit<Maquinaria, 'id'>>(emptyMaquinaria);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/maquinarias');
      if (res.ok) {
        const data = await res.json();
        setMaquinarias(Array.isArray(data) ? data : data.data || []);
      }
    } catch (err) {
      console.error('Error fetching maquinarias:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyMaquinaria);
    setShowModal(true);
  };

  const openEdit = (maq: Maquinaria) => {
    setEditing(maq);
    const espec = parseEspec(maq.especificaciones);
    setForm({
      nombre: maq.nombre,
      tipo: maq.tipo,
      descripcion: maq.descripcion,
      precio_dia: maq.precio_dia || 0,
      precio_semana: maq.precio_semana || 0,
      precio_mes: maq.precio_mes || 0,
      garantia_monto: maq.garantia_monto || 0,
      tipo_combustible: (maq.tipo_combustible || '') as TipoCombustible,
      estado: maq.estado,
      imagen: maq.imagen,
      especificaciones: maq.especificaciones || null,
      marca: String(espec.marca ?? ''),
      modelo: String(espec.modelo ?? ''),
      serie: String(espec.serie ?? espec.numero_serie ?? ''),
      anio: String(espec.anio ?? espec.ano ?? espec.year ?? ''),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Merge into existing especificaciones (preserving any custom keys
      // the operator added previously, e.g. potencia, peso, etc.)
      const existingEspec = parseEspec(form.especificaciones);
      const especificaciones: Record<string, string> = {
        ...existingEspec,
        ...(form.marca ? { marca: form.marca } : { marca: '' }),
        ...(form.modelo ? { modelo: form.modelo } : { modelo: '' }),
        ...(form.serie ? { serie: form.serie } : { serie: '' }),
        ...(form.anio ? { anio: form.anio } : { anio: '' }),
      };
      // Strip empty keys so we don't bloat the JSON.
      Object.keys(especificaciones).forEach((k) => {
        if (!especificaciones[k]) delete especificaciones[k];
      });

      const payload = {
        nombre: form.nombre,
        tipo: form.tipo,
        descripcion: form.descripcion,
        precio_dia: form.precio_dia,
        precio_semana: form.precio_semana,
        precio_mes: form.precio_mes,
        garantia_monto: form.garantia_monto,
        tipo_combustible: form.tipo_combustible,
        estado: form.estado,
        imagen: form.imagen,
        especificaciones: Object.keys(especificaciones).length > 0 ? especificaciones : null,
      };

      const url = editing ? `/api/maquinarias/${editing.id}` : '/api/maquinarias';
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

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/maquinarias/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteConfirm(null);
        fetchData();
      }
    } catch (err) {
      console.error('Error deleting:', err);
    }
  };

  const handleStatusToggle = async (maq: Maquinaria) => {
    const states: Maquinaria['estado'][] = ['disponible', 'arrendada', 'mantencion'];
    const currentIdx = states.indexOf(maq.estado);
    const nextEstado = states[(currentIdx + 1) % states.length];
    try {
      await fetch(`/api/maquinarias/${maq.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...maq, estado: nextEstado }),
      });
      fetchData();
    } catch (err) {
      console.error('Error toggling status:', err);
    }
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
          <h1 className="text-2xl font-bold text-gray-900">Maquinarias</h1>
          <p className="text-sm text-gray-500 mt-1">{maquinarias.length} maquinarias registradas</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium text-sm transition hover:opacity-90"
          style={{ backgroundColor: '#0c1d3a' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva Maquinaria
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {maquinarias.map((maq) => {
          const est = estadoColors[maq.estado] || estadoColors.disponible;
          return (
            <div key={maq.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              {/* Image */}
              <div className="h-48 bg-gray-100 flex items-center justify-center relative">
                {maq.imagen ? (
                  <img src={maq.imagen} alt={maq.nombre} className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
                <button
                  onClick={() => handleStatusToggle(maq)}
                  className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-semibold ${est.bg} ${est.text} cursor-pointer hover:opacity-80`}
                >
                  {est.label}
                </button>
              </div>

              {/* Info */}
              <div className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{maq.nombre}</h3>
                    <p className="text-sm text-gray-500">{maq.tipo}</p>
                  </div>
                  <p className="text-lg font-bold" style={{ color: '#e6b422' }}>
                    {formatCLP(maq.precio_dia)}
                    <span className="text-xs text-gray-400 font-normal">/dia</span>
                  </p>
                </div>
                {maq.descripcion && (
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">{maq.descripcion}</p>
                )}
                <div className="flex gap-2">
                  <Link
                    href={`/admin/maquinarias/${maq.id}`}
                    className="flex-1 py-2 text-sm font-medium rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition text-center inline-flex items-center justify-center gap-1.5"
                    title="Ver detalle y documentos"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Detalle
                  </Link>
                  <button
                    onClick={() => openEdit(maq)}
                    className="flex-1 py-2 text-sm font-medium rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
                  >
                    Editar
                  </button>
                  {deleteConfirm === maq.id ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleDelete(maq.id)}
                        className="px-3 py-2 text-sm font-medium rounded-xl bg-red-600 text-white hover:bg-red-700 transition"
                      >
                        Si
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-3 py-2 text-sm font-medium rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(maq.id)}
                      className="px-3 py-2 text-sm font-medium rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {maquinarias.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
          </svg>
          <p className="text-gray-500">No hay maquinarias registradas</p>
          <button onClick={openCreate} className="mt-3 text-sm font-medium hover:underline" style={{ color: '#e6b422' }}>
            Agregar primera maquinaria
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {editing ? 'Editar Maquinaria' : 'Nueva Maquinaria'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900"
                  placeholder="Ej: Retroexcavadora CAT 320"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <input
                    type="text"
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900"
                    placeholder="Ej: Excavadora"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <select
                    value={form.estado}
                    onChange={(e) => setForm({ ...form, estado: e.target.value as Maquinaria['estado'] })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900"
                  >
                    <option value="disponible">Disponible</option>
                    <option value="arrendada">Arrendada</option>
                    <option value="mantencion">Mantencion</option>
                  </select>
                </div>
              </div>
              {/* Especificaciones técnicas — usadas en el contrato PDF */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-3">
                  Especificaciones técnicas (aparecen en el contrato)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Marca</label>
                    <input
                      type="text"
                      value={form.marca || ''}
                      onChange={(e) => setForm({ ...form, marca: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 text-sm"
                      placeholder="Hidromek, Bobcat, JLG..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Modelo</label>
                    <input
                      type="text"
                      value={form.modelo || ''}
                      onChange={(e) => setForm({ ...form, modelo: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 text-sm"
                      placeholder="HMK 102B, S650..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">N° de serie</label>
                    <input
                      type="text"
                      value={form.serie || ''}
                      onChange={(e) => setForm({ ...form, serie: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 text-sm"
                      placeholder="Identificador único de la máquina"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Año</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={form.anio || ''}
                      onChange={(e) => setForm({ ...form, anio: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 text-sm"
                      placeholder="2024"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio / Dia (CLP)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.precio_dia}
                    onChange={(e) => setForm({ ...form, precio_dia: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900"
                    placeholder="200000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio / Semana (CLP)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.precio_semana}
                    onChange={(e) => setForm({ ...form, precio_semana: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900"
                    placeholder="Opcional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio / Mes (CLP)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.precio_mes}
                    onChange={(e) => setForm({ ...form, precio_mes: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900"
                    placeholder="Opcional"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto de garantia (CLP)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.garantia_monto}
                    onChange={(e) => setForm({ ...form, garantia_monto: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900"
                    placeholder="500000"
                  />
                  <p className="text-xs text-gray-500 mt-1">Usado como valor por defecto al crear contratos.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de combustible</label>
                  <select
                    value={form.tipo_combustible}
                    onChange={(e) => setForm({ ...form, tipo_combustible: e.target.value as TipoCombustible })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900"
                  >
                    <option value="">— Sin especificar —</option>
                    <option value="diesel">Diésel</option>
                    <option value="gasolina_93">Gasolina 93</option>
                    <option value="gasolina_95">Gasolina 95</option>
                    <option value="gasolina_97">Gasolina 97</option>
                    <option value="kerosene">Kerosene</option>
                    <option value="otro">Otro</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Usado al registrar consumo de combustible.</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL Imagen</label>
                <input
                  type="text"
                  value={form.imagen}
                  onChange={(e) => setForm({ ...form, imagen: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
                <textarea
                  value={form.descripcion}
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 resize-none"
                  placeholder="Descripcion de la maquinaria..."
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
                disabled={saving || !form.nombre}
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
