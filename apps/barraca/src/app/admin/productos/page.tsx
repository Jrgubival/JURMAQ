"use client"

import { useState, useEffect } from 'react';
import { formatCLP } from "@jurmaq/shared/format";

interface Categoria {
  id: number;
  nombre: string;
  slug: string;
}

interface Producto {
  id: number;
  codigo: string | null;
  nombre: string;
  slug: string;
  descripcion: string | null;
  precio: number;
  costo: number | null;
  stock: number | null;
  peso: number | null;
  unidad: string | null;
  categoria_id: number | null;
  categoria_nombre?: string;
  imagen: string | null;
  medida: string | null;
  activo: boolean;
  destacado: boolean;
  created_at: string;
}
const emptyForm = {
  codigo: '',
  nombre: '',
  slug: '',
  descripcion: '',
  precio: 0,
  costo: 0,
  stock: 0,
  peso: 0,
  unidad: 'UN',
  categoria_id: '',
  imagen: '',
  medida: '',
  activo: true,
  destacado: false,
};

export default function BarracaProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Producto | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const perPage = 15;

  // Tier 6 F5: bulk selection state.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<string>('');
  const [bulkPayload, setBulkPayload] = useState<{ categoria_id?: string; percent?: string }>({});
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const fetchData = async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        fetch('/api/productos?all=true&limit=5000'),
        fetch('/api/categorias'),
      ]);
      if (prodRes.ok) {
        const data = await prodRes.json();
        setProductos(data.productos || (Array.isArray(data) ? data : data.data || []));
      }
      if (catRes.ok) {
        const data = await catRes.json();
        setCategorias(Array.isArray(data) ? data : data.categorias || data.data || []);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = productos.filter((p) => {
    const matchSearch =
      !search ||
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      (p.codigo && p.codigo.toLowerCase().includes(search.toLowerCase()));
    const matchCat =
      !filterCat || String(p.categoria_id) === filterCat;
    return matchSearch && matchCat;
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (p: Producto) => {
    setEditing(p);
    setForm({
      codigo: p.codigo || '',
      nombre: p.nombre,
      slug: p.slug,
      descripcion: p.descripcion || '',
      precio: p.precio,
      costo: p.costo || 0,
      stock: p.stock || 0,
      peso: p.peso || 0,
      unidad: p.unidad || 'UN',
      categoria_id: p.categoria_id ? String(p.categoria_id) : '',
      imagen: p.imagen || '',
      medida: p.medida || '',
      activo: p.activo,
      destacado: p.destacado,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = editing
        ? `/api/productos/${editing.id}`
        : '/api/productos';
      const method = editing ? 'PUT' : 'POST';
      const body = {
        ...form,
        categoria_id: form.categoria_id ? Number(form.categoria_id) : null,
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

  const toggleActivo = async (p: Producto) => {
    try {
      await fetch(`/api/productos/${p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !p.activo }),
      });
      fetchData();
    } catch (err) {
      console.error('Error toggling:', err);
    }
  };

  const toggleDestacado = async (p: Producto) => {
    try {
      await fetch(`/api/productos/${p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destacado: !p.destacado }),
      });
      fetchData();
    } catch (err) {
      console.error('Error toggling:', err);
    }
  };

  const getCatName = (catId: number | null) => {
    if (!catId) return '-';
    const cat = categorias.find((c) => c.id === catId);
    return cat ? cat.nombre : '-';
  };

  // Tier 6 F5: bulk action handlers.
  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleSelectAllVisible() {
    const allSelected = paginated.every((p) => selectedIds.has(p.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) paginated.forEach((p) => next.delete(p.id));
      else paginated.forEach((p) => next.add(p.id));
      return next;
    });
  }
  function clearSelection() {
    setSelectedIds(new Set());
    setBulkAction('');
    setBulkPayload({});
  }

  async function runBulkAction() {
    if (selectedIds.size === 0 || !bulkAction) return;
    // Confirmar acciones destructivas.
    if (bulkAction === 'deactivate' || bulkAction === 'apply_discount' || bulkAction === 'remove_discount') {
      const ok = window.confirm(
        `Vas a aplicar "${bulkAction}" a ${selectedIds.size} productos. ¿Confirmás?`,
      );
      if (!ok) return;
    }

    const payload: Record<string, unknown> = {};
    if (bulkAction === 'change_category') {
      if (!bulkPayload.categoria_id) {
        setBulkMsg({ kind: 'err', text: 'Elegí una categoría' });
        return;
      }
      payload.categoria_id = Number(bulkPayload.categoria_id);
    }
    if (bulkAction === 'apply_discount') {
      const pct = Number(bulkPayload.percent);
      if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) {
        setBulkMsg({ kind: 'err', text: '% debe estar entre 1 y 99' });
        return;
      }
      payload.percent = pct;
    }

    setBulkRunning(true);
    setBulkMsg(null);
    try {
      const res = await fetch('/api/admin/productos/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          action: bulkAction,
          payload,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBulkMsg({ kind: 'err', text: data.error || 'Error al aplicar acción' });
        return;
      }
      setBulkMsg({
        kind: 'ok',
        text: `Acción aplicada a ${data.affected} producto(s)${data.failed ? `. ${data.failed} fallaron.` : '.'}`,
      });
      clearSelection();
      await fetchData();
    } finally {
      setBulkRunning(false);
      setTimeout(() => setBulkMsg(null), 5000);
    }
  }

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
          <h1 className="text-2xl font-bold text-gray-900">Productos Barraca</h1>
          <p className="text-sm text-gray-500 mt-1">{productos.length} productos registrados</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium text-sm transition hover:opacity-90"
          style={{ backgroundColor: '#0c1d3a' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Producto
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Buscar por nombre o codigo..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 text-sm"
          />
        </div>
        <select
          value={filterCat}
          onChange={(e) => { setFilterCat(e.target.value); setPage(1); }}
          className="px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 text-sm"
        >
          <option value="">Todas las categorias</option>
          {categorias.map((c) => (
            <option key={c.id} value={String(c.id)}>{c.nombre}</option>
          ))}
        </select>
      </div>

      {/* Bulk action bar (Tier 6 F5) — solo visible si hay selección */}
      {selectedIds.size > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex flex-col md:flex-row items-start md:items-center gap-3 sticky top-2 z-10 shadow-sm">
          <p className="text-sm font-semibold text-orange-900">
            {selectedIds.size} producto{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
          </p>
          <div className="flex-1 flex flex-wrap items-center gap-2">
            <select
              value={bulkAction}
              onChange={(e) => {
                setBulkAction(e.target.value);
                setBulkPayload({});
              }}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg"
            >
              <option value="">— Elegí acción —</option>
              <optgroup label="Estado">
                <option value="activate">Activar</option>
                <option value="deactivate">Desactivar</option>
              </optgroup>
              <optgroup label="Destacado">
                <option value="feature">Marcar como destacado</option>
                <option value="unfeature">Quitar destacado</option>
              </optgroup>
              <optgroup label="Catálogo">
                <option value="change_category">Cambiar categoría…</option>
              </optgroup>
              <optgroup label="Precios">
                <option value="apply_discount">Aplicar descuento %…</option>
                <option value="remove_discount">Quitar descuento</option>
              </optgroup>
            </select>

            {bulkAction === 'change_category' && (
              <select
                value={bulkPayload.categoria_id || ''}
                onChange={(e) => setBulkPayload({ categoria_id: e.target.value })}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg"
              >
                <option value="">— Categoría —</option>
                {categorias.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.nombre}</option>
                ))}
              </select>
            )}

            {bulkAction === 'apply_discount' && (
              <input
                type="number"
                min={1}
                max={99}
                value={bulkPayload.percent || ''}
                onChange={(e) => setBulkPayload({ percent: e.target.value })}
                placeholder="% (1-99)"
                className="w-20 px-3 py-1.5 text-sm border border-gray-300 rounded-lg"
              />
            )}

            <button
              onClick={runBulkAction}
              disabled={bulkRunning || !bulkAction}
              className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
            >
              {bulkRunning ? 'Aplicando…' : 'Aplicar a seleccionados'}
            </button>
            <button
              onClick={clearSelection}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-orange-100 rounded-lg"
            >
              Limpiar selección
            </button>
          </div>
        </div>
      )}

      {bulkMsg && (
        <div
          className={`px-4 py-3 rounded-xl text-sm ${
            bulkMsg.kind === 'ok'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {bulkMsg.text}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-3 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={paginated.length > 0 && paginated.every((p) => selectedIds.has(p.id))}
                    onChange={toggleSelectAllVisible}
                    className="cursor-pointer"
                    aria-label="Seleccionar todos"
                  />
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Imagen</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Codigo</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Categoria</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Precio</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Stock</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Estado</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Destacado</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((p) => (
                <tr
                  key={p.id}
                  className={`border-b border-gray-100 transition-colors ${
                    selectedIds.has(p.id) ? 'bg-orange-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="px-3 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => toggleSelect(p.id)}
                      className="cursor-pointer"
                      aria-label={`Seleccionar ${p.nombre}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden">
                      {p.imagen ? (
                        <img src={p.imagen} alt={p.nombre} className="w-full h-full object-cover" />
                      ) : (
                        <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.codigo || '-'}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{p.nombre}</td>
                  <td className="px-4 py-3 text-gray-500">{getCatName(p.categoria_id)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCLP(p.precio)}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{p.stock ?? 0}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActivo(p)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer hover:opacity-80 ${
                        p.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleDestacado(p)}
                      className={`text-lg cursor-pointer hover:scale-110 transition-transform ${
                        p.destacado ? 'text-yellow-500' : 'text-gray-300'
                      }`}
                      title={p.destacado ? 'Quitar destacado' : 'Marcar como destacado'}
                    >
                      {p.destacado ? '\u2605' : '\u2606'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => openEdit(p)}
                      className="px-3 py-1.5 text-xs font-medium rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                    No se encontraron productos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Mostrando {(page - 1) * perPage + 1}-{Math.min(page * perPage, filtered.length)} de {filtered.length}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition"
              >
                Anterior
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-3 py-1.5 text-sm rounded-xl border transition ${
                      page === p
                        ? 'text-white border-transparent'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    style={page === p ? { backgroundColor: '#0c1d3a' } : {}}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {editing ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Codigo</label>
                  <input type="text" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 text-sm" placeholder="SKU-001" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
                  <input type="text" value={form.unidad} onChange={(e) => setForm({ ...form, unidad: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 text-sm" placeholder="UN, KG, ML" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input type="text" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 text-sm" placeholder="Fierro estriado 8mm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Medida</label>
                <input type="text" value={form.medida} onChange={(e) => setForm({ ...form, medida: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 text-sm" placeholder="8mm x 6m" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                <select value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 text-sm">
                  <option value="">Sin categoria</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio</label>
                  <input type="number" min="0" step="1" value={form.precio} onChange={(e) => setForm({ ...form, precio: Number(e.target.value) })} className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Costo</label>
                  <input type="number" min="0" step="1" value={form.costo} onChange={(e) => setForm({ ...form, costo: Number(e.target.value) })} className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
                  <input type="number" min="0" step="1" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL Imagen</label>
                <input type="text" value={form.imagen} onChange={(e) => setForm({ ...form, imagen: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 text-sm" placeholder="https://..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
                <textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} rows={3} className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 text-sm resize-none" />
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} className="rounded border-gray-300" />
                  <span className="text-sm text-gray-700">Activo</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.destacado} onChange={(e) => setForm({ ...form, destacado: e.target.checked })} className="rounded border-gray-300" />
                  <span className="text-sm text-gray-700">Destacado</span>
                </label>
              </div>
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
