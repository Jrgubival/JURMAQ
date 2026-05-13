'use client';

import { useState, useEffect, useCallback } from 'react';

interface Tarifa {
  id: number;
  tipo_combustible: string;
  vigente_desde: string;
  vigente_hasta: string | null;
  componente_fijo_clp_litro: number;
  componente_variable_utm_m3: number;
  utm_referencia_clp: number | null;
  decreto_supremo: string | null;
  notas: string | null;
  created_at: string;
  created_by: string | null;
}

const TIPOS = [
  { key: 'diesel', label: 'Diesel' },
  { key: 'gasolina_93', label: 'Gasolina 93' },
  { key: 'gasolina_95', label: 'Gasolina 95' },
  { key: 'gasolina_97', label: 'Gasolina 97' },
  { key: 'kerosene', label: 'Kerosene' },
];

function formatCLP(n: number | null): string {
  if (n == null) return '—';
  return '$' + n.toLocaleString('es-CL', { maximumFractionDigits: 2 });
}

function formatDate(s: string | null): string {
  if (!s) return 'Vigente';
  return new Date(s).toLocaleDateString('es-CL');
}

export default function TarifasIECPage() {
  const [items, setItems] = useState<Tarifa[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Form state
  const [tipo, setTipo] = useState('diesel');
  const [vigenteDesde, setVigenteDesde] = useState(new Date().toISOString().slice(0, 10));
  const [componenteFijo, setComponenteFijo] = useState('');
  const [componenteVariable, setComponenteVariable] = useState('0');
  const [utmRef, setUtmRef] = useState('');
  const [decreto, setDecreto] = useState('');
  const [notas, setNotas] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchTarifas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/combustible/tarifas-iec');
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: 'err', text: data.error || 'Error' });
        return;
      }
      setItems(data.items || []);
    } catch {
      setMsg({ kind: 'err', text: 'Error de conexion' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTarifas();
  }, [fetchTarifas]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch('/api/admin/combustible/tarifas-iec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo_combustible: tipo,
          vigente_desde: vigenteDesde,
          componente_fijo_clp_litro: Number(componenteFijo),
          componente_variable_utm_m3: Number(componenteVariable) || 0,
          utm_referencia_clp: utmRef ? Number(utmRef) : null,
          decreto_supremo: decreto || null,
          notas: notas || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: 'err', text: data.error || 'Error al crear' });
        return;
      }
      setMsg({ kind: 'ok', text: 'Tarifa creada. La anterior del mismo tipo quedo cerrada.' });
      setComponenteFijo('');
      setDecreto('');
      setNotas('');
      fetchTarifas();
    } catch {
      setMsg({ kind: 'err', text: 'Error de conexion' });
    } finally {
      setCreating(false);
      setTimeout(() => setMsg(null), 4000);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Eliminar esta tarifa? Si ya se uso en facturas, dejara huerfanas esas referencias.')) return;
    try {
      const res = await fetch(`/api/admin/combustible/tarifas-iec?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: 'err', text: data.error || 'Error' });
        return;
      }
      setMsg({ kind: 'ok', text: 'Tarifa eliminada' });
      fetchTarifas();
    } catch {
      setMsg({ kind: 'err', text: 'Error de conexion' });
    } finally {
      setTimeout(() => setMsg(null), 3000);
    }
  }

  // Agrupa por tipo para visualizacion
  const porTipo = TIPOS.map((t) => ({
    ...t,
    tarifas: items.filter((i) => i.tipo_combustible === t.key),
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tarifas IEC</h1>
        <p className="text-sm text-gray-500">
          Tasas del Impuesto Especifico a los Combustibles (Ley 18.502). El sistema usa la tarifa vigente para
          calcular automaticamente el monto IEC al ingresar facturas. Actualiza cuando SII publica nuevos valores
          (Decreto Supremo correspondiente).
        </p>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${msg.kind === 'ok' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {msg.text}
        </div>
      )}

      {/* Form de creacion */}
      <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Agregar tarifa</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo combustible</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {TIPOS.map((t) => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vigente desde</label>
            <input
              type="date"
              value={vigenteDesde}
              onChange={(e) => setVigenteDesde(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Decreto Supremo (opc.)</label>
            <input
              type="text"
              value={decreto}
              onChange={(e) => setDecreto(e.target.value)}
              placeholder="Ej: DS 567/2024"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Componente fijo (CLP/litro)</label>
            <input
              type="number"
              step="0.01"
              value={componenteFijo}
              onChange={(e) => setComponenteFijo(e.target.value)}
              placeholder="Ej: 60.5"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Componente variable (UTM/m³)</label>
            <input
              type="number"
              step="0.0001"
              value={componenteVariable}
              onChange={(e) => setComponenteVariable(e.target.value)}
              placeholder="Ej: 1.5"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">UTM referencia (CLP)</label>
            <input
              type="number"
              value={utmRef}
              onChange={(e) => setUtmRef(e.target.value)}
              placeholder="Ej: 67429"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opc.)</label>
          <input
            type="text"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={creating || !componenteFijo}
          className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
        >
          {creating ? 'Guardando...' : 'Crear tarifa'}
        </button>
        <p className="mt-2 text-xs text-gray-500">
          Al crear una tarifa nueva del mismo tipo, la anterior queda cerrada automaticamente con vigente_hasta = (nueva vigente_desde - 1 dia).
        </p>
      </form>

      {/* Listado por tipo */}
      <div className="space-y-6">
        {porTipo.map((g) => (
          <div key={g.key} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-6 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">{g.label}</h3>
              <span className="text-xs text-gray-500">{g.tarifas.length} tarifa(s)</span>
            </div>
            {g.tarifas.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-400">
                Sin tarifas configuradas. El admin debera ingresar IEC manual hasta que agregues una.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-4 py-2 font-semibold text-gray-600">Vigente</th>
                      <th className="text-right px-4 py-2 font-semibold text-gray-600">Comp. fijo</th>
                      <th className="text-right px-4 py-2 font-semibold text-gray-600">Comp. variable</th>
                      <th className="text-right px-4 py-2 font-semibold text-gray-600">UTM ref.</th>
                      <th className="text-left px-4 py-2 font-semibold text-gray-600">Decreto</th>
                      <th className="text-right px-4 py-2 font-semibold text-gray-600"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.tarifas.map((t) => (
                      <tr key={t.id} className={`border-t border-gray-100 ${t.vigente_hasta === null ? 'bg-green-50/30' : ''}`}>
                        <td className="px-4 py-2 text-xs text-gray-700">
                          {formatDate(t.vigente_desde)} → {formatDate(t.vigente_hasta)}
                          {t.vigente_hasta === null && <span className="ml-2 text-xs font-semibold text-green-700">vigente</span>}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-900">{formatCLP(t.componente_fijo_clp_litro)} /lt</td>
                        <td className="px-4 py-2 text-right text-gray-700">{t.componente_variable_utm_m3} UTM/m³</td>
                        <td className="px-4 py-2 text-right text-gray-700">{formatCLP(t.utm_referencia_clp)}</td>
                        <td className="px-4 py-2 text-xs text-gray-600">{t.decreto_supremo || '—'}</td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => handleDelete(t.id)}
                            className="text-xs text-red-600 hover:text-red-800"
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
