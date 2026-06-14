"use client"

import { useState, useRef, useEffect } from 'react';
import type { MatchResult } from '@/lib/import-barraca-smart';

const STEP_LABELS = ['Subir Archivo', 'Mapear Columnas', 'Configurar', 'Vista Previa', 'Ejecutar'];

const FIELD_OPTIONS = [
  { value: 'codigo', label: 'Codigo' },
  { value: 'nombre', label: 'Nombre' },
  { value: 'precio', label: 'Precio' },
  { value: 'costo', label: 'Costo' },
  { value: 'stock', label: 'Stock' },
  { value: 'peso', label: 'Peso' },
  { value: 'unidad', label: 'Unidad' },
  { value: 'medida', label: 'Medida' },
  { value: 'categoria', label: 'Categoria' },
  { value: 'subcategoria', label: 'Subcategoria' },
  { value: 'precio_tachado', label: 'Precio Tachado' },
  { value: 'imagen', label: 'Imagen (URL foto)' },
  { value: 'activo', label: 'Activo (Si/No)' },
  { value: '__ignore__', label: '(ignorar)' },
];

export default function BarracaImportarPage() {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1 result
  const [parseResult, setParseResult] = useState<any>(null);

  // Step 2
  const [columnMapping, setColumnMapping] = useState<Record<string, string | null>>({});

  // Step 3
  const [matchBy, setMatchBy] = useState<'codigo' | 'nombre'>('codigo');
  const [fieldsToUpdate, setFieldsToUpdate] = useState<string[]>(['precio', 'costo', 'stock']);
  const [createNew, setCreateNew] = useState(false);
  const [createPromotionalPrices, setCreatePromotionalPrices] = useState(false);

  // Step 4
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'update' | 'create' | 'skip'>('all');

  // Step 5
  const [importResult, setImportResult] = useState<any>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  // ── Helpers ──

  const hasPrecioTachado = Object.values(columnMapping).includes('precio_tachado');

  function resetAll() {
    setStep(1);
    setFile(null);
    setError('');
    setParseResult(null);
    setColumnMapping({});
    setMatchBy('codigo');
    setFieldsToUpdate(['precio', 'costo', 'stock']);
    setCreateNew(false);
    setCreatePromotionalPrices(false);
    setPreviewResult(null);
    setPreviewFilter('all');
    setImportResult(null);
  }

  // ── Export ──

  async function handleExport() {
    setLoading(true);
    try {
      const res = await fetch('/api/productos/export');
      if (!res.ok) throw new Error('Error al exportar');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `productos-barraca-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Step 1: File handling ──

  function handleFile(f: File) {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      setError('Solo se permiten archivos .xlsx o .xls');
      return;
    }
    setFile(f);
    setError('');
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  }

  async function handleParse() {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/importar/parse', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar archivo');
      setParseResult(data);
      if (data.columnMapping) {
        // API returns { dbField: excelHeader }, UI needs { excelHeader: dbField }
        const inverted: Record<string, string | null> = {};
        for (const [dbField, excelHeader] of Object.entries(data.columnMapping)) {
          if (excelHeader) inverted[excelHeader as string] = dbField;
        }
        // Also set unmapped headers to null
        for (const h of data.headers || []) {
          if (!(h in inverted)) inverted[h] = null;
        }
        setColumnMapping(inverted);
      }
      setStep(2);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Step 3 → 4: Preview ──

  // Convert UI mapping { excelHeader: dbField } → API format { dbField: excelHeader }
  function getApiMapping() {
    const apiMapping: Record<string, string | null> = {};
    for (const [excelHeader, dbField] of Object.entries(columnMapping)) {
      if (dbField) apiMapping[dbField] = excelHeader;
    }
    return apiMapping;
  }

  async function handlePreview() {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('config', JSON.stringify({ columnMapping: getApiMapping(), matchBy, fieldsToUpdate, createNew, createPromotionalPrices }));
      const res = await fetch('/api/importar/preview', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar vista previa');
      setPreviewResult(data);
      setStep(4);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Step 5: Execute ──

  async function handleExecute() {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('config', JSON.stringify({ columnMapping: getApiMapping(), matchBy, fieldsToUpdate, createNew, createPromotionalPrices }));
      const res = await fetch('/api/importar/execute', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al ejecutar importacion');
      setImportResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (step === 5 && !importResult && !loading) {
      handleExecute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Column mapping update ──

  function updateMapping(header: string, value: string) {
    setColumnMapping((prev) => ({ ...prev, [header]: value === '__ignore__' ? null : value }));
  }

  // ── Fields to update toggle ──

  function toggleField(field: string) {
    setFieldsToUpdate((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  }

  // ── Preview filtering ──

  // Flatten matches into displayable rows (one row per change)
  function getFilteredRows() {
    if (!previewResult?.matches) return [];
    const matches = previewResult.matches as MatchResult[];

    // Filter by status
    const filtered = previewFilter === 'all'
      ? matches
      : matches.filter((m) => m.status === previewFilter);

    // Flatten: each match can have multiple changes
    const rows: any[] = [];
    for (const m of filtered) {
      const codigo = m.matchedProduct?.codigo || m.excelRow?.Codigo || m.excelRow?.codigo || '—';
      const nombre = m.matchedProduct?.nombre || m.excelRow?.Nombre || m.excelRow?.nombre || '—';
      if (m.changes && m.changes.length > 0) {
        for (const c of m.changes) {
          rows.push({ codigo, nombre, field: c.field, oldValue: c.oldValue, newValue: c.newValue, status: m.status });
        }
      } else {
        rows.push({ codigo, nombre, field: m.status === 'skip' ? 'sin cambios' : '—', oldValue: null, newValue: null, status: m.status });
      }
    }
    return rows;
  }

  // ── Render ──

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Importar / Exportar Productos</h1>
          <p className="text-sm text-gray-500 mt-1">
            Importe o exporte productos desde un archivo Excel (.xlsx)
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={loading}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-medium text-sm transition hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: '#0c1d3a' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Exportar Excel
        </button>
      </div>

      {/* Step Indicator */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          {STEP_LABELS.map((label, i) => {
            const num = i + 1;
            const isActive = num === step;
            const isCompleted = num < step;
            return (
              <div key={num} className="flex items-center flex-1">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                      isActive
                        ? 'text-white'
                        : isCompleted
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                    style={isActive ? { backgroundColor: '#e6b422' } : undefined}
                  >
                    {isCompleted ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      num
                    )}
                  </div>
                  <span
                    className={`text-sm font-medium hidden sm:inline ${
                      isActive ? 'text-gray-900' : isCompleted ? 'text-green-600' : 'text-gray-500'
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {num < STEP_LABELS.length && (
                  <div
                    className={`flex-1 h-0.5 mx-3 ${
                      num < step ? 'bg-green-400' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-red-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <p className="text-red-700 text-sm">{error}</p>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          STEP 1: Upload File
      ═══════════════════════════════════════════ */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Paso 1: Subir Archivo</h2>

          <div
            className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
              dragging
                ? 'border-[#e6b422] bg-yellow-50/50'
                : 'border-gray-300 hover:border-gray-400 bg-gray-50/50'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />

            <svg className="w-14 h-14 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>

            {file ? (
              <div>
                <p className="text-lg font-semibold text-gray-900 mb-1">{file.name}</p>
                <p className="text-sm text-gray-500 mb-4">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
                <button
                  onClick={() => setFile(null)}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Quitar archivo
                </button>
              </div>
            ) : (
              <div>
                <p className="text-gray-600 mb-2">Arrastre su archivo Excel aqui o</p>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-medium text-sm transition hover:opacity-90"
                  style={{ backgroundColor: '#0c1d3a' }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Seleccionar Archivo
                </button>
                <p className="text-xs text-gray-500 mt-3">Solo archivos .xlsx o .xls</p>
              </div>
            )}
          </div>

          {file && (
            <div className="flex justify-end">
              <button
                onClick={handleParse}
                disabled={loading}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-semibold text-sm transition hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: '#0c1d3a' }}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Procesando...
                  </>
                ) : (
                  'Siguiente'
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════
          STEP 2: Column Mapping
      ═══════════════════════════════════════════ */}
      {step === 2 && parseResult && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Paso 2: Mapear Columnas</h2>
            <span className="text-sm text-gray-500">
              {parseResult.totalRows} filas detectadas
            </span>
          </div>

          {/* Mapping Table */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Columna Excel</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Campo Mapeado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(parseResult.headers || []).map((header: string) => (
                  <tr key={header} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-mono text-gray-800">{header}</td>
                    <td className="px-4 py-3">
                      <select
                        value={columnMapping[header] ?? '__ignore__'}
                        onChange={(e) => updateMapping(header, e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-3 py-1.5 text-sm focus:ring-2 focus:ring-yellow-300 focus:border-yellow-400 outline-none"
                      >
                        {FIELD_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sample Data Preview */}
          {parseResult.sampleRows && parseResult.sampleRows.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Vista previa de datos (primeras filas)</h3>
              <div className="border border-gray-200 rounded-xl overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {(parseResult.headers || []).map((h: string) => (
                        <th key={h} className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parseResult.sampleRows.slice(0, 5).map((row: any, idx: number) => (
                      <tr key={idx}>
                        {(parseResult.headers || []).map((h: string) => (
                          <td key={h} className="px-3 py-2 text-gray-700 whitespace-nowrap">
                            {row[h] ?? '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 transition"
            >
              Volver
            </button>
            <button
              onClick={() => setStep(3)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-semibold text-sm transition hover:opacity-90"
              style={{ backgroundColor: '#0c1d3a' }}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          STEP 3: Configuration
      ═══════════════════════════════════════════ */}
      {step === 3 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Paso 3: Configurar Importacion</h2>

          {/* Match By */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Buscar por</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="matchBy"
                  checked={matchBy === 'codigo'}
                  onChange={() => setMatchBy('codigo')}
                  className="w-4 h-4 accent-yellow-500"
                />
                <span className="text-sm text-gray-700">Codigo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="matchBy"
                  checked={matchBy === 'nombre'}
                  onChange={() => setMatchBy('nombre')}
                  className="w-4 h-4 accent-yellow-500"
                />
                <span className="text-sm text-gray-700">Nombre</span>
              </label>
            </div>
          </div>

          {/* Fields to Update */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Campos a actualizar</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { key: 'precio', label: 'Precio', default: true },
                { key: 'costo', label: 'Costo', default: true },
                { key: 'stock', label: 'Stock', default: true },
                { key: 'nombre', label: 'Nombre', default: false },
                { key: 'peso', label: 'Peso', default: false },
                { key: 'unidad', label: 'Unidad', default: false },
                { key: 'imagen', label: 'Imagen (foto)', default: false },
                { key: 'activo', label: 'Activo', default: false },
              ].map((f) => (
                <label key={f.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fieldsToUpdate.includes(f.key)}
                    onChange={() => toggleField(f.key)}
                    className="w-4 h-4 rounded accent-yellow-500"
                  />
                  <span className="text-sm text-gray-700">{f.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Create New */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={createNew}
                onChange={(e) => setCreateNew(e.target.checked)}
                className="w-4 h-4 rounded accent-yellow-500"
              />
              <span className="text-sm text-gray-700 font-medium">Crear productos nuevos que no existan</span>
            </label>

            {/* Promotional prices (strikethrough) */}
            {hasPrecioTachado && (
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createPromotionalPrices}
                    onChange={(e) => setCreatePromotionalPrices(e.target.checked)}
                    className="w-4 h-4 rounded accent-yellow-500"
                  />
                  <span className="text-sm text-gray-700 font-medium">Marcar como oferta (precio tachado)</span>
                </label>
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 ml-6 mt-1">
                  <strong>Importante:</strong> Segun Ley 19.496 (SERNAC), el precio tachado debe haber sido el precio
                  efectivo de venta durante los 30 dias previos. Solo actives esta opcion si el valor de la columna
                  "precio tachado" corresponde al precio historico real del producto.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 transition"
            >
              Volver
            </button>
            <button
              onClick={handlePreview}
              disabled={loading}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-semibold text-sm transition hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: '#0c1d3a' }}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Generando vista previa...
                </>
              ) : (
                'Vista Previa'
              )}
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          STEP 4: Preview
      ═══════════════════════════════════════════ */}
      {step === 4 && previewResult && (
        <div className="space-y-5">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-blue-200 p-5 text-center">
              <p className="text-3xl font-bold text-blue-600">{previewResult.summary?.toUpdate ?? 0}</p>
              <p className="text-sm text-gray-600 mt-1">a actualizar</p>
            </div>
            <div className="bg-white rounded-xl border border-green-200 p-5 text-center">
              <p className="text-3xl font-bold text-green-600">{previewResult.summary?.toCreate ?? 0}</p>
              <p className="text-sm text-gray-600 mt-1">a crear</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
              <p className="text-3xl font-bold text-gray-500">{previewResult.summary?.toSkip ?? 0}</p>
              <p className="text-sm text-gray-600 mt-1">sin cambios</p>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'all' as const, label: 'Todos' },
                { key: 'update' as const, label: 'A actualizar' },
                { key: 'create' as const, label: 'A crear' },
                { key: 'skip' as const, label: 'Sin cambios' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setPreviewFilter(tab.key)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                    previewFilter === tab.key
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={previewFilter === tab.key ? { backgroundColor: '#0c1d3a' } : undefined}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Preview Table */}
            <div className="border border-gray-200 rounded-xl overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Codigo</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Campo</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Valor Actual</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Valor Nuevo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {getFilteredRows().length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        No hay registros para este filtro.
                      </td>
                    </tr>
                  ) : (
                    getFilteredRows().map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="px-4 py-2 font-mono text-gray-800">{row.codigo ?? '—'}</td>
                        <td className="px-4 py-2 text-gray-700">{row.nombre ?? '—'}</td>
                        <td className="px-4 py-2 text-gray-600">{row.field ?? '—'}</td>
                        <td className="px-4 py-2">
                          {row.oldValue != null ? (
                            <span className="text-red-600 line-through">{String(row.oldValue)}</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {row.newValue != null ? (
                            <span className="text-green-600 font-medium">{String(row.newValue)}</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <button
              onClick={() => setStep(3)}
              className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 transition"
            >
              Volver
            </button>
            <button
              onClick={() => setStep(5)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-semibold text-sm transition hover:bg-orange-700"
              style={{ backgroundColor: '#ea580c' }}
            >
              Ejecutar Importacion
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          STEP 5: Execution
      ═══════════════════════════════════════════ */}
      {step === 5 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          {loading && !importResult && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-orange-500 mb-4" />
              <p className="text-lg font-semibold text-gray-700">Importando productos...</p>
              <p className="text-sm text-gray-500 mt-1">Esto puede tomar unos segundos</p>
            </div>
          )}

          {importResult && (
            <div className="space-y-6">
              <div className="text-center mb-2">
                <svg className="w-14 h-14 mx-auto text-green-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-xl font-bold text-gray-900">Importacion Completada</h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">{importResult.updated ?? 0}</p>
                  <p className="text-xs text-gray-600 mt-1">productos actualizados</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{importResult.created ?? 0}</p>
                  <p className="text-xs text-gray-600 mt-1">productos creados</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-gray-500">{importResult.skipped ?? 0}</p>
                  <p className="text-xs text-gray-600 mt-1">sin cambios</p>
                </div>
                <div className="bg-red-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-red-600">{importResult.errors?.length ?? 0}</p>
                  <p className="text-xs text-gray-600 mt-1">errores</p>
                </div>
              </div>

              {/* Error details */}
              {importResult.errors && importResult.errors.length > 0 && (
                <details className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <summary className="text-sm font-medium text-red-800 cursor-pointer">
                    Ver {importResult.errors.length} error(es)
                  </summary>
                  <ul className="mt-2 text-xs text-red-700 space-y-1 max-h-48 overflow-y-auto">
                    {importResult.errors.map((err: string, i: number) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="shrink-0 mt-0.5">&#x2022;</span>
                        <span>{err}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <div className="flex justify-center pt-2">
                <button
                  onClick={resetAll}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-semibold text-sm transition hover:opacity-90"
                  style={{ backgroundColor: '#0c1d3a' }}
                >
                  Volver al inicio
                </button>
              </div>
            </div>
          )}

          {!loading && !importResult && error && (
            <div className="text-center py-12">
              <svg className="w-14 h-14 mx-auto text-red-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Error en la importacion</h2>
              <p className="text-sm text-gray-500 mb-4">{error}</p>
              <button
                onClick={resetAll}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-semibold text-sm transition hover:opacity-90"
                style={{ backgroundColor: '#0c1d3a' }}
              >
                Volver al inicio
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
