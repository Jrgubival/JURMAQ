'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';

interface Template {
  id: number;
  nombre: string;
  version: number | string;
  activo: boolean;
  contenido: string;
  updated_at?: string;
}

/**
 * Tier 6 F3: Preview en VIVO de plantillas de contrato.
 *
 * Cambios vs versión anterior:
 *   - Editor + preview side-by-side (no toggle)
 *   - Preview auto-refresh con debounce 500ms al tipear
 *   - Sidebar con placeholders disponibles, click → inserta en el cursor
 *   - Variables de preview editables in-modal (probá con tu nombre real)
 *   - Detecta placeholders no reconocidos y los marca rojo
 */

const DEFAULT_VARS: Record<string, string | number | boolean> = {
  numero_contrato: 'JQ-2026-001',
  fecha_emision: '21/04/2026',
  arrendador_nombre: 'JURMAQ SpA',
  arrendador_rut: '76.123.456-7',
  arrendador_domicilio: 'Av. Poniente 2157, Molina',
  arrendador_rep: 'Juan Rep Legal',
  arrendatario_nombre: 'Cliente de Prueba',
  arrendatario_rut: '12.345.678-9',
  arrendatario_domicilio: 'Calle Ejemplo 456, Talca',
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
  direccion_entrega: 'Obra Proyecto X, Talca',
  direccion_retiro: 'Obra Proyecto X, Talca',
  observaciones: 'Ninguna',
  con_operador: false,
  operador_nombre: '',
  garantia_klap_clausula: '',
};

/** Renderer espejo de src/lib/contrato-render.ts (Handlebars-lite). */
function renderPreview(
  template: string,
  vars: Record<string, string | number | boolean>,
): string {
  let out = template;
  const ifRegex =
    /\{\{#if\s+([a-zA-Z_][\w]*)\s*\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;
  let prev = '';
  while (prev !== out) {
    prev = out;
    out = out.replace(ifRegex, (_m, name: string, thenBlock: string, elseBlock?: string) => {
      const val = vars[name];
      const truthy = !!val && val !== '0' && val !== 0 && val !== 'false';
      return truthy ? thenBlock : elseBlock || '';
    });
  }
  out = out.replace(/\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g, (_m, name: string) => {
    const v = vars[name];
    if (v === null || v === undefined) return '';
    return String(v);
  });
  return out;
}

/** Detecta los placeholders usados en el template + si están todos definidos. */
function extractPlaceholders(template: string): { used: string[]; missing: string[] } {
  const found = new Set<string>();
  const reSimple = /\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g;
  const reIf = /\{\{#if\s+([a-zA-Z_][\w]*)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = reSimple.exec(template)) !== null) found.add(m[1]);
  while ((m = reIf.exec(template)) !== null) found.add(m[1]);
  const used = Array.from(found).sort();
  const known = new Set(Object.keys(DEFAULT_VARS));
  const missing = used.filter((p) => !known.has(p));
  return { used, missing };
}

/** Grupos de placeholders documentados para el sidebar click-to-insert. */
const PLACEHOLDER_GROUPS: Array<{ label: string; vars: string[] }> = [
  {
    label: '📄 Contrato',
    vars: ['numero_contrato', 'fecha_emision'],
  },
  {
    label: '🏢 Arrendador (JURMAQ)',
    vars: ['arrendador_nombre', 'arrendador_rut', 'arrendador_domicilio', 'arrendador_rep'],
  },
  {
    label: '👤 Arrendatario (cliente)',
    vars: [
      'arrendatario_nombre',
      'arrendatario_rut',
      'arrendatario_domicilio',
      'arrendatario_telefono',
      'arrendatario_email',
    ],
  },
  {
    label: '🏗 Máquina',
    vars: ['maquinaria_nombre', 'maquinaria_tipo'],
  },
  {
    label: '📅 Fechas y modalidad',
    vars: ['fecha_inicio', 'fecha_termino', 'modalidad'],
  },
  {
    label: '💰 Precios',
    vars: [
      'precio_unidad',
      'precio_unidad_fmt',
      'total',
      'total_fmt',
      'total_letras',
      'garantia_monto',
      'garantia_monto_fmt',
      'garantia_monto_letras',
    ],
  },
  {
    label: '📍 Entrega / Retiro',
    vars: ['direccion_entrega', 'direccion_retiro'],
  },
  {
    label: '⚙️ Otros',
    vars: ['observaciones', 'con_operador', 'operador_nombre', 'garantia_klap_clausula'],
  },
];

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
  const [isNew, setIsNew] = useState(false);

  // Preview state (Tier 6 F3)
  const [previewVars, setPreviewVars] = useState<Record<string, string | number | boolean>>(DEFAULT_VARS);
  const [debouncedContent, setDebouncedContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showVarsEditor, setShowVarsEditor] = useState(false);

  // Debounce 500ms para no re-renderizar el iframe en cada tecla.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedContent(form.contenido), 500);
    return () => clearTimeout(t);
  }, [form.contenido]);

  // Análisis del template (live, sin debounce — es barato).
  const analysis = useMemo(() => extractPlaceholders(form.contenido), [form.contenido]);

  const previewHtml = useMemo(
    () => renderPreview(debouncedContent || '<p style="color:#999;padding:20px;">El preview aparecerá aquí cuando empieces a escribir…</p>', previewVars),
    [debouncedContent, previewVars],
  );

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
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Error de conexión');
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
    setPreviewVars(DEFAULT_VARS);
  }

  function openCreate() {
    setEditing(null);
    setIsNew(true);
    setForm({ nombre: '', contenido: '', activo: true });
    setSaveError('');
    setPreviewVars(DEFAULT_VARS);
  }

  function closeModal() {
    setEditing(null);
    setIsNew(false);
  }

  function insertPlaceholder(name: string) {
    const ta = textareaRef.current;
    const token = `{{${name}}}`;
    if (!ta) {
      setForm((f) => ({ ...f, contenido: f.contenido + token }));
      return;
    }
    const start = ta.selectionStart ?? form.contenido.length;
    const end = ta.selectionEnd ?? form.contenido.length;
    const nuevo = form.contenido.slice(0, start) + token + form.contenido.slice(end);
    setForm((f) => ({ ...f, contenido: nuevo }));
    // Reposicionar cursor después del token.
    requestAnimationFrame(() => {
      ta.focus();
      const newPos = start + token.length;
      ta.setSelectionRange(newPos, newPos);
    });
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
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/admin/contratos" className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1 mb-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver a contratos
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Plantillas de contrato</h1>
          <p className="text-sm text-gray-500 mt-1">
            Editor con <strong>preview en vivo</strong>. Click en placeholders del sidebar para insertarlos.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium text-sm transition hover:opacity-90"
          style={{ backgroundColor: '#0c1d3a' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva plantilla
        </button>
      </div>

      {loadError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">{loadError}</div>
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
                <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{t.id}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{t.nombre}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{t.version}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${t.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {t.activo ? 'Si' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => openEdit(t)} className="px-3 py-1.5 text-xs font-medium rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition">
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                    No hay plantillas todavia — crea la primera
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit modal — side-by-side editor + preview en vivo */}
      {(editing || isNew) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-stretch justify-center p-2 md:p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-[1600px] flex flex-col">
            {/* Modal header */}
            <div className="px-6 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-4 flex-wrap">
                <h3 className="text-lg font-semibold text-gray-900">
                  {isNew ? 'Nueva plantilla' : 'Editar plantilla'}
                </h3>
                {editing && (
                  <p className="text-xs text-gray-500">
                    Version {editing.version} · se crea nueva al guardar
                  </p>
                )}
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm"
                  placeholder="Nombre de la plantilla"
                />
                <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.activo}
                    onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                  />
                  Activa
                </label>
              </div>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal body: 3 columnas */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[200px_1fr_1fr] divide-x divide-gray-200 overflow-hidden">
              {/* Col 1: placeholders sidebar */}
              <div className="overflow-y-auto p-3 bg-gray-50">
                <h4 className="text-xs font-semibold uppercase text-gray-600 mb-2 tracking-wide">
                  Placeholders
                </h4>
                <p className="text-[10px] text-gray-500 mb-3">
                  Click para insertar en el cursor
                </p>
                {PLACEHOLDER_GROUPS.map((g) => (
                  <details key={g.label} open className="mb-2">
                    <summary className="text-xs font-medium text-gray-700 cursor-pointer hover:text-gray-900 py-1">
                      {g.label}
                    </summary>
                    <ul className="ml-1 mt-1 space-y-0.5">
                      {g.vars.map((v) => (
                        <li key={v}>
                          <button
                            type="button"
                            onClick={() => insertPlaceholder(v)}
                            className={`block w-full text-left text-[11px] font-mono px-1.5 py-0.5 rounded hover:bg-blue-100 ${
                              analysis.used.includes(v)
                                ? 'text-blue-700 bg-blue-50'
                                : 'text-gray-600'
                            }`}
                            title={`Valor demo: ${String(DEFAULT_VARS[v] ?? '')}`}
                          >
                            {v}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}

                {/* Status: usados + missing */}
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <p className="text-[10px] text-gray-500 mb-1 uppercase tracking-wide">
                    En este template
                  </p>
                  <p className="text-xs text-gray-700">
                    <strong>{analysis.used.length}</strong> placeholders usados
                  </p>
                  {analysis.missing.length > 0 && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-[10px] text-red-700">
                      <p className="font-semibold mb-1">⚠ No reconocidos:</p>
                      <ul className="space-y-0.5">
                        {analysis.missing.map((m) => (
                          <li key={m} className="font-mono">{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Col 2: editor */}
              <div className="flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Editor HTML</p>
                  <button
                    type="button"
                    onClick={() => setShowVarsEditor((v) => !v)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {showVarsEditor ? '✕ Cerrar variables' : '⚙ Editar variables demo'}
                  </button>
                </div>
                <textarea
                  ref={textareaRef}
                  value={form.contenido}
                  onChange={(e) => setForm({ ...form, contenido: e.target.value })}
                  className="flex-1 p-3 font-mono text-[11px] leading-relaxed resize-none outline-none focus:bg-blue-50/30 transition"
                  placeholder="<html>...{{arrendatario_nombre}}...</html>"
                  spellCheck={false}
                />
              </div>

              {/* Col 3: preview live */}
              <div className="flex flex-col overflow-hidden bg-gray-100">
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Preview en vivo</p>
                  {form.contenido !== debouncedContent && (
                    <span className="text-[10px] text-amber-600 animate-pulse">actualizando…</span>
                  )}
                </div>
                {showVarsEditor ? (
                  <div className="flex-1 overflow-y-auto p-3 bg-white space-y-2">
                    <p className="text-[10px] text-gray-500 mb-2">
                      Cambiá valores acá para ver cómo se rinde el template con datos distintos.
                    </p>
                    {Object.entries(DEFAULT_VARS).map(([key, defaultVal]) => (
                      <div key={key} className="flex items-center gap-2">
                        <label className="text-[10px] font-mono text-gray-600 w-32 flex-shrink-0 truncate" title={key}>
                          {key}
                        </label>
                        {typeof defaultVal === 'boolean' ? (
                          <input
                            type="checkbox"
                            checked={!!previewVars[key]}
                            onChange={(e) =>
                              setPreviewVars((p) => ({ ...p, [key]: e.target.checked }))
                            }
                          />
                        ) : (
                          <input
                            type="text"
                            value={String(previewVars[key] ?? '')}
                            onChange={(e) => setPreviewVars((p) => ({ ...p, [key]: e.target.value }))}
                            className="flex-1 px-2 py-1 border border-gray-200 rounded text-[11px] font-mono"
                          />
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPreviewVars(DEFAULT_VARS)}
                      className="mt-2 text-[10px] text-blue-600 hover:underline"
                    >
                      ↻ Restaurar defaults
                    </button>
                  </div>
                ) : (
                  <iframe
                    srcDoc={previewHtml}
                    title="Preview plantilla"
                    className="flex-1 w-full bg-white"
                    sandbox=""
                  />
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-200 flex gap-3 justify-between items-center flex-shrink-0">
              {saveError ? (
                <p className="text-sm text-red-600">{saveError}</p>
              ) : (
                <p className="text-xs text-gray-500">
                  💡 <strong>Tip:</strong> usá <code>{`{{#if con_operador}}…{{/if}}`}</code> para bloques condicionales.
                </p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.nombre.trim() || !form.contenido.trim()}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: '#0c1d3a' }}
                >
                  {saving ? 'Guardando…' : isNew ? 'Crear' : 'Guardar nueva version'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
