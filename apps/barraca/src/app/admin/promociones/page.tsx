'use client';

import { useState, useEffect } from 'react';

interface Categoria {
  id: number;
  nombre: string;
  slug: string;
}

interface Promocion {
  id: number;
  titulo: string;
  descripcion: string | null;
  descuento_porcentaje: number;
  categoria_id: number;
  activa: boolean;
  imagen: string | null;
  created_at: string;
  barraca_categorias?: { nombre: string; slug: string };
}

export default function PromocionesAdminPage() {
  const [promociones, setPromociones] = useState<Promocion[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editPromo, setEditPromo] = useState<Promocion | null>(null);
  const [setupSql, setSetupSql] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    titulo: '',
    descripcion: '',
    descuento_porcentaje: 10,
    categoria_id: 0,
    activa: true,
  });

  // Daily preview
  const [dailyPreview, setDailyPreview] = useState<Promocion[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (promociones.length > 0) {
      // Calculate daily selection (same algorithm as server)
      const now = new Date();
      const chileOffset = -4 * 60;
      const chileTime = new Date(now.getTime() + (chileOffset + now.getTimezoneOffset()) * 60000);
      const seed = chileTime.getFullYear() * 10000 + (chileTime.getMonth() + 1) * 100 + chileTime.getDate();
      const active = promociones.filter(p => p.activa);
      const shuffled = [...active].sort((a, b) => {
        const hashA = ((seed * 31 + a.id * 17) % 1000) / 1000;
        const hashB = ((seed * 31 + b.id * 17) % 1000) / 1000;
        return hashA - hashB;
      });
      setDailyPreview(shuffled.slice(0, 4));
    }
  }, [promociones]);

  async function loadData() {
    setLoading(true);
    try {
      const [promoRes, catRes] = await Promise.all([
        fetch('/api/promociones'),
        fetch('/api/categorias'),
      ]);
      const promoData = await promoRes.json();
      const catData = await catRes.json();

      if (promoData.error?.includes('no existe') || promoData.detail?.includes('42P01')) {
        setSetupSql(promoData.sql || null);
      }

      setPromociones(promoData.promociones || []);
      setCategorias(Array.isArray(catData) ? catData : (catData.categorias || []));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSeed() {
    try {
      const res = await fetch('/api/setup', { method: 'POST' });
      const data = await res.json();
      if (data.sql) {
        setSetupSql(data.sql);
        alert('Debes crear la tabla primero. Copia el SQL que aparece y ejecutalo en el Dashboard de Supabase.');
      } else if (data.ok) {
        alert(`${data.message}`);
        setSetupSql(null);
        loadData();
      } else {
        alert('Error: ' + (data.error || 'Error desconocido'));
      }
    } catch {
      alert('Error de conexión');
    }
  }

  function openCreate() {
    setEditPromo(null);
    setForm({
      titulo: '',
      descripcion: '',
      descuento_porcentaje: 10,
      categoria_id: categorias[0]?.id || 0,
      activa: true,
    });
    setShowModal(true);
  }

  function openEdit(promo: Promocion) {
    setEditPromo(promo);
    setForm({
      titulo: promo.titulo,
      descripcion: promo.descripcion || '',
      descuento_porcentaje: promo.descuento_porcentaje,
      categoria_id: promo.categoria_id,
      activa: promo.activa,
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editPromo) {
        await fetch('/api/promociones', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editPromo.id, ...form }),
        });
      } else {
        await fetch('/api/promociones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      }
      setShowModal(false);
      loadData();
    } catch {
      alert('Error al guardar');
    }
  }

  async function toggleActiva(promo: Promocion) {
    await fetch('/api/promociones', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: promo.id, activa: !promo.activa }),
    });
    loadData();
  }

  async function handleDelete(id: number) {
    if (!confirm('Eliminar esta promocion?')) return;
    await fetch(`/api/promociones?id=${id}`, { method: 'DELETE' });
    loadData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Promociones</h1>
          <p className="text-sm text-gray-500 mt-1">
            {promociones.length} promociones en total, {promociones.filter(p => p.activa).length} activas
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSeed}
            className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Sembrar 30 promociones
          </button>
          <button
            onClick={openCreate}
            className="px-4 py-2 text-sm font-medium bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            + Nueva Promocion
          </button>
        </div>
      </div>

      {/* Setup SQL notice */}
      {setupSql && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-800 mb-2">Tabla no encontrada</h3>
          <p className="text-sm text-yellow-700 mb-3">
            Ejecuta este SQL en el editor SQL del Dashboard de Supabase:
          </p>
          <pre className="bg-white border border-yellow-200 rounded p-3 text-xs overflow-x-auto whitespace-pre-wrap">
            {setupSql}
          </pre>
          <button
            onClick={() => navigator.clipboard.writeText(setupSql)}
            className="mt-2 px-3 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700"
          >
            Copiar SQL
          </button>
        </div>
      )}

      {/* Daily preview */}
      {dailyPreview.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 mb-2">
            Hoy se muestran estas promociones en el sitio:
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {dailyPreview.map(p => (
              <div key={p.id} className="bg-white rounded-lg p-3 border border-blue-100">
                <div className="font-medium text-sm text-gray-900">{p.titulo}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {p.barraca_categorias?.nombre || 'Sin categoria'}
                </div>
                <div className="text-lg font-bold text-orange-600 mt-1">
                  -{p.descuento_porcentaje}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Promotions table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Titulo</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Categoria</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Descuento</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-700">Activa</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {promociones.map(promo => (
                <tr key={promo.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{promo.titulo}</div>
                    {promo.descripcion && (
                      <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{promo.descripcion}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {promo.barraca_categorias?.nombre || '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex px-2 py-0.5 text-xs font-bold bg-red-100 text-red-700 rounded-full">
                      -{promo.descuento_porcentaje}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActiva(promo)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        promo.activa ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          promo.activa ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(promo)}
                        className="px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(promo.id)}
                        className="px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {promociones.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No hay promociones. Usa el boton &quot;Sembrar 30 promociones&quot; para comenzar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {editPromo ? 'Editar Promocion' : 'Nueva Promocion'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titulo</label>
                <input
                  type="text"
                  required
                  value={form.titulo}
                  onChange={e => setForm({ ...form, titulo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Ej: Fierros de Construccion -15%"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
                <textarea
                  value={form.descripcion}
                  onChange={e => setForm({ ...form, descripcion: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  rows={2}
                  placeholder="Descripcion de la promocion"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descuento %</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={90}
                    value={form.descuento_porcentaje}
                    onChange={e => setForm({ ...form, descuento_porcentaje: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                  <select
                    required
                    value={form.categoria_id}
                    onChange={e => setForm({ ...form, categoria_id: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value={0}>Seleccionar...</option>
                    {categorias.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="activa"
                  checked={form.activa}
                  onChange={e => setForm({ ...form, activa: e.target.checked })}
                  className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                />
                <label htmlFor="activa" className="text-sm text-gray-700">Activa</label>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700"
                >
                  {editPromo ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
