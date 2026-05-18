'use client';

import { useState, useEffect } from 'react';

interface Categoria {
  id: number;
  nombre: string;
  slug: string;
  descripcion: string | null;
  imagen: string | null;
  orden: number;
  padre_id: number | null;
  activa: boolean;
  producto_count?: number;
}

const emptyForm = {
  nombre: '',
  slug: '',
  descripcion: '',
  imagen: '',
  orden: 0,
  activa: true,
};

export default function BarracaCategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Categoria | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/categorias');
      if (res.ok) {
        const data = await res.json();
        setCategorias(Array.isArray(data) ? data : data.data || []);
      }
    } catch (err) {
      console.error('Error fetching categorias:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (cat: Categoria) => {
    setEditing(cat);
    setForm({
      nombre: cat.nombre,
      slug: cat.slug,
      descripcion: cat.descripcion || '',
      imagen: cat.imagen || '',
      orden: cat.orden,
      activa: cat.activa,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = editing
        ? `/api/categorias/${editing.id}`
        : '/api/categorias';
      const method = editing ? 'PUT' : 'POST';
      const body = {
        ...form,
        slug: form.slug || form.nombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  const toggleActiva = async (cat: Categoria) => {
    try {
      await fetch(`/api/categorias/${cat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activa: !cat.activa }),
      });
      fetchData();
    } catch (err) {
      console.error('Error toggling:', err);
    }
  };

  const moveOrder = async (cat: Categoria, direction: 'up' | 'down') => {
    const newOrder = direction === 'up' ? cat.orden - 1 : cat.orden + 1;
    try {
      await fetch(`/api/categorias/${cat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orden: newOrder }),
      });
      fetchData();
    } catch (err) {
      console.error('Error reordering:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#e6b422' }} />
      </div>
    );
  }

  const sorted = [...categorias].sort((a, b) => a.orden - b.orden);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorias Barraca</h1>
          <p className="text-sm text-gray-500 mt-1">{categorias.length} categorias registradas</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium text-sm transition hover:opacity-90"
          style={{ backgroundColor: '#0c1d3a' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva Categoria
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Slug</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Productos</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Orden</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Estado</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((cat) => (
                <tr key={cat.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{cat.nombre}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{cat.slug}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{cat.producto_count ?? '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => moveOrder(cat, 'up')}
                        className="p-1 text-gray-400 hover:text-gray-700 transition"
                        title="Subir"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <span className="text-gray-500 text-xs w-6 text-center">{cat.orden}</span>
                      <button
                        onClick={() => moveOrder(cat, 'down')}
                        className="p-1 text-gray-400 hover:text-gray-700 transition"
                        title="Bajar"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActiva(cat)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer hover:opacity-80 ${
                        cat.activa ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {cat.activa ? 'Activa' : 'Inactiva'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => openEdit(cat)}
                      className="px-3 py-1.5 text-xs font-medium rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    No hay categorias registradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {editing ? 'Editar Categoria' : 'Nueva Categoria'}
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
                <input type="text" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 text-sm" placeholder="Fierros Estriados" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                <input type="text" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 text-sm" placeholder="fierros-estriados (auto-generado)" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
                <textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} rows={2} className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 text-sm resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL Imagen</label>
                <input type="text" value={form.imagen} onChange={(e) => setForm({ ...form, imagen: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 text-sm" placeholder="https://..." />
              </div>
              <div>
                <label htmlFor="cat-orden" className="block text-sm font-medium text-gray-700 mb-1">Orden</label>
                <input
                  id="cat-orden"
                  type="number"
                  min={0}
                  step={1}
                  value={form.orden}
                  onChange={(e) => setForm({ ...form, orden: Math.max(0, Number(e.target.value) || 0) })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 text-sm tabular-nums"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.activa} onChange={(e) => setForm({ ...form, activa: e.target.checked })} className="rounded border-gray-300" />
                <span className="text-sm text-gray-700">Activa</span>
              </label>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving || !form.nombre} className="px-4 py-2.5 rounded-xl text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: '#0c1d3a' }}>
                {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
