'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Template {
  id: number;
  nombre: string;
  version: number | string;
  activo: boolean;
  contenido: string;
  updated_at?: string;
}

// Dummy vars used for the "Probar plantilla" preview.
const DUMMY_VARS: Record<string, string | number | boolean> = {
  numero_contrato: 'JQ-2026-001',
  fecha_emision: '21/04/2026',
  arrendador_nombre: 'JURMAQ SpA',
  arrendador_rut: '76.123.456-7',
  arrendador_domicilio: 'Av. Principal 123, Santiago',
  arrendador_rep: 'Juan Rep Legal',
  arrendatario_nombre: 'Cliente de Prueba',
  arrendatario_rut: '12.345.678-9',
  arrendatario_domicilio: 'Calle Ejemplo 456, Santiago',
  arrendatario_telefono: '+56 9 1234 5678',
  arrendatario_email: 'cliente@ejemplo.cl',
  maquinaria_nombre: 'Retroexcavadora CAT 320',
  maquinaria_tipo: 'Excavadora',
  fecha_inicio: '01/05/2026',
  fecha_termino: '15/05/2026',
  modalidad: 'dia',
  precio_unidad: 200000,
  precio_unidad_fmt: '$200.000',
  total: 3000000,
  total_fmt: '$3.000.000',
  total_letras: 'tres millones',
  garantia_monto: 500000,
  garantia_monto_fmt: '$500.000',
  garantia_monto_letras: 'quinientos mil',
  direccion_entrega: 'Obra Proyecto X, Las Condes',
  direccion_retiro: 'Obra Proyecto X, Las Condes',
  observaciones: 'Ninguna',
  con_operador: false,
  operador_nombre: '',
};

/**
 * Minimal client-side Handlebars-lite renderer, mirroring src/lib/contrato-render.ts.
 * Used only for the "Probar plantilla" preview so the admin gets instant feedback.
 */
function renderPreview(template: string, vars: Record<string, any>): string {
  let out = template;
  const ifRegex =
    /\{\{#if\s+([a-zA-Z_][\w]*)\s*\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;
  let prev = '';
  while (prev !== out) {
    prev = out;
    out = out.replace(ifRegex, (_m, name: string, thenBlock: string, elseBlock?: string) => {
      const val = vars[name];
      const truthy = !!val && val !== '0' && val !== 0 && val !== 'false';
      return truthy ? thenBlock : (elseBlock || '');
    });
  }
  out = out.replace(/\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g, (_m, name: string) => {
    const v = vars[name];
    if (v === null || v === undefined) return '';
    return String(v);
  });
  return out;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Edit modal state
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState<{ nombre: string; contenido: string; activo: boolean }>({
    nombre: '',
    contenido: '',
    activo: true,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [isNew, setIsNew] = useState(false);

  async function fetchData() {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch('/api/admin/contratos/templates');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudieron cargar las plantillas');
      }
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : data.data || []);
    } catch (err: any) {
      setLoadError(err?.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  function openEdit(t: Template) {
    setEditing(t);
    setIsNew(false);
    setForm({ nombre: t.nombre, contenido: t.contenido, activo: t.activo });
    setSaveError('');
    setShowPreview(false);
  }

  function openCreate() {
    setEditing(null);
    setIsNew(true);
    setForm({ nombre: '', contenido: '', activo: true });
    setSaveError('');
    setShowPreview(false);
  }

  function closeModal() {
    setEditing(null);
    setIsNew(false);
    setShowPreview(false);
  }

  async function handleSave() {
    if (!form.nombre.trim() || !form.contenido.trim()) {
      setSaveError('El nombre y el contenido son requeridos');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const url = editing
        ? `/api/admin/contratos/templates/${editing.id}`
        : '/api/admin/contratos/templates';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre,
          contenido: form.contenido,
          activo: form.activo,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo guardar la plantilla');
      }
      await fetchData();
      closeModal();
    } catch (err: any) {
      setSaveError(err?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2"
          style={{ borderColor: '#e6b422' }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link
            href="/admin/contratos"
            className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1 mb-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver a contratos
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Plantillas de contrato</h1>
          <p className="text-sm text-gray-500 mt-1">
            Edita el HTML usado al generar los contratos. Usa {`{{placeholders}}`} y{' '}
            {`{{#if var}}...{{/if}}`}.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-white font-medium text-sm transition hover:opacity-90"
          style={{ backgroundColor: '#0c1d3a' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva plantilla
        </button>
      </div>

      {loadError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {loadError}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">ID</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Nombre</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Version</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Activo</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{t.id}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{t.nombre}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{t.version}</td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                        t.activo
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {t.activo ? 'Si' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => openEdit(t)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                    No hay plantillas todavia — crea la primera
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit modal */}
      {(editing || isNew) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {isNew ? 'Nueva plantilla' : `Editar plantilla`}
                </h3>
                {editing && (
                  <p className="text-xs text-gray-500">
                    Version actual: {editing.version} · Se creara una nueva version al guardar.
                  </p>
                )}
              </div>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900"
                    placeholder="Ej: Contrato estandar"
                  />
                </div>
                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.activo}
                      onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                    />
                    Plantilla activa
                  </label>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Contenido</label>
                  <button
                    type="button"
                    onClick={() => setShowPreview((s) => !s)}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    {showPreview ? 'Ocultar preview' : 'Probar plantilla'}
                  </button>
                </div>
                <textarea
                  value={form.contenido}
                  onChange={(e) => setForm({ ...form, contenido: e.target.value })}
                  rows={18}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 text-xs font-mono resize-y"
                  placeholder="<html>...{{arrendatario_nombre}}...</html>"
                  spellCheck={false}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Placeholders disponibles: arrendatario_nombre, arrendatario_rut,
                  arrendador_nombre, maquinaria_nombre, fecha_inicio, fecha_termino,
                  modalidad, precio_unidad_fmt, total_fmt, total_letras,
                  garantia_monto_fmt, direccion_entrega, con_operador (booleano), etc.
                </p>
              </div>

              {showPreview && (
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-2">
                    Preview con variables de prueba
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <iframe
                      srcDoc={renderPreview(form.contenido, DUMMY_VARS)}
                      title="Preview plantilla"
                      className="w-full"
                      style={{ height: '50vh', border: 0 }}
                    />
                  </div>
                </div>
              )}

              {saveError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                  {saveError}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={closeModal}
                className="px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.nombre.trim() || !form.contenido.trim()}
                className="px-4 py-2.5 rounded-lg text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: '#0c1d3a' }}
              >
                {saving ? 'Guardando...' : isNew ? 'Crear' : 'Guardar nueva version'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
