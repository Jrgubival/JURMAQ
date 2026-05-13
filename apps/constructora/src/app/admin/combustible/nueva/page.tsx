'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatRut } from '@/lib/rut';
import { tiposCombustibleLabels, type TipoCombustible } from '@/lib/combustible-utils';
import { formatCLP } from "@jurmaq/shared/format";

interface Maquinaria {
  id: number;
  nombre: string;
  tipo_combustible?: string | null;
}

interface Contrato {
  id: number;
  numero: string;
  maquinaria_id: number;
  arrendatario_nombre: string | null;
  arrendatario_razon_social: string | null;
  estado: string;
}

interface ItemRow {
  maquinaria_id: string;
  contrato_id: string;
  tipo_combustible: TipoCombustible;
  litros: string;
  monto: string;
  horometro: string;
  observaciones: string;
}

const emptyItem = (): ItemRow => ({
  maquinaria_id: '',
  contrato_id: '',
  tipo_combustible: 'diesel',
  litros: '',
  monto: '',
  horometro: '',
  observaciones: '',
});

const currentDate = () => new Date().toISOString().slice(0, 10);

export default function NuevaFacturaPage() {
  const router = useRouter();

  // Header state
  const [fecha, setFecha] = useState(currentDate());
  const [tipoDocumento, setTipoDocumento] = useState('factura_electronica');
  const [folio, setFolio] = useState('');
  const [proveedorNombre, setProveedorNombre] = useState('');
  const [proveedorRut, setProveedorRut] = useState('');
  const [proveedorDireccion, setProveedorDireccion] = useState('');
  const [montoTotal, setMontoTotal] = useState('');
  const [montoNeto, setMontoNeto] = useState('');
  const [montoIva, setMontoIva] = useState('');
  const [montoIec, setMontoIec] = useState('');
  const [recuperable, setRecuperable] = useState(true);
  const [notas, setNotas] = useState('');

  // File
  const [archivoUrl, setArchivoUrl] = useState<string | null>(null);
  const [archivoNombre, setArchivoNombre] = useState<string | null>(null);
  const [archivoTamano, setArchivoTamano] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Items
  const [items, setItems] = useState<ItemRow[]>([emptyItem()]);

  // Data
  const [maquinarias, setMaquinarias] = useState<Maquinaria[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/maquinarias').then((r) => r.json()).then((d) => {
      setMaquinarias(Array.isArray(d) ? d : d.data || []);
    }).catch(() => {});
    fetch('/api/admin/contratos?estado=vigente').then((r) => r.json()).then((d) => {
      setContratos(Array.isArray(d) ? d : d.data || []);
    }).catch(() => {});
    fetch('/api/admin/contratos?estado=firmado').then((r) => r.json()).then((d) => {
      const extra = Array.isArray(d) ? d : d.data || [];
      setContratos((prev) => [...prev, ...extra]);
    }).catch(() => {});
  }, []);

  // Auto-compute neto/iva when total changes (if user hasn't overridden)
  useEffect(() => {
    const total = Number(montoTotal);
    if (total > 0 && !montoNeto && !montoIva) {
      const neto = Math.round(total / 1.19);
      setMontoNeto(String(neto));
      setMontoIva(String(total - neto));
    }
  }, [montoTotal]);

  // Upload file
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('El archivo supera 10MB');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/combustible/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Error al subir');
        return;
      }
      const d = await res.json();
      setArchivoUrl(d.path);
      setArchivoNombre(d.nombre);
      setArchivoTamano(d.tamano);
    } finally {
      setUploading(false);
    }
  };

  const updateItem = (idx: number, field: keyof ItemRow, value: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (idx: number) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Auto-select default combustible when maquinaria changes
  const onMaquinariaChange = (idx: number, maqId: string) => {
    updateItem(idx, 'maquinaria_id', maqId);
    const m = maquinarias.find((x) => String(x.id) === maqId);
    if (m?.tipo_combustible) updateItem(idx, 'tipo_combustible', m.tipo_combustible as TipoCombustible);
  };

  const totalItems = items.reduce((s, it) => s + (Number(it.monto) || 0), 0);
  const totalLitros = items.reduce((s, it) => s + (Number(it.litros) || 0), 0);
  const diferencia = Number(montoTotal) - totalItems;
  const diferenciaSignif = Math.abs(diferencia) > Number(montoTotal) * 0.05;

  const handleSubmit = async (estado: 'registrada' | 'validada') => {
    setError('');
    if (!fecha || !folio || !proveedorNombre || !montoTotal) {
      setError('Completa fecha, folio, proveedor y monto total');
      return;
    }
    if (items.length === 0) {
      setError('Agrega al menos un item');
      return;
    }
    for (const it of items) {
      if (!it.litros || Number(it.litros) <= 0) {
        setError('Todos los items deben tener litros > 0');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        fecha,
        tipo_documento: tipoDocumento,
        folio,
        proveedor_nombre: proveedorNombre,
        proveedor_rut: proveedorRut || null,
        proveedor_direccion: proveedorDireccion || null,
        monto_total: Number(montoTotal),
        monto_neto: montoNeto ? Number(montoNeto) : null,
        monto_iva: montoIva ? Number(montoIva) : null,
        monto_iec: montoIec ? Number(montoIec) : null,
        recuperable,
        notas: notas || null,
        archivo_url: archivoUrl,
        archivo_nombre: archivoNombre,
        archivo_tamano: archivoTamano,
        estado,
        items: items.map((it) => ({
          maquinaria_id: it.maquinaria_id ? Number(it.maquinaria_id) : null,
          contrato_id: it.contrato_id ? Number(it.contrato_id) : null,
          tipo_combustible: it.tipo_combustible,
          litros: Number(it.litros),
          monto: Number(it.monto) || 0,
          precio_por_litro: it.litros && it.monto ? Number(it.monto) / Number(it.litros) : null,
          horometro: it.horometro ? Number(it.horometro) : null,
          observaciones: it.observaciones || null,
        })),
      };
      const res = await fetch('/api/admin/combustible/facturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Error al guardar');
        setSaving(false);
        return;
      }
      router.push('/admin/combustible');
    } catch (e) {
      setError('Error de conexion');
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <Link href="/admin/combustible" className="text-sm text-gray-500 hover:text-gray-700">&larr; Volver</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Nueva Factura de Combustible</h1>
      </div>

      {/* Sección 1: Datos de la factura */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Datos de la factura</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Fecha *">
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </Field>
          <Field label="Tipo de documento">
            <select value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="factura_electronica">Factura electrónica</option>
              <option value="boleta">Boleta</option>
              <option value="factura_exenta">Factura exenta</option>
              <option value="vale">Vale</option>
            </select>
          </Field>
          <Field label="Folio *">
            <input type="text" value={folio} onChange={(e) => setFolio(e.target.value)} placeholder="Ej: 12345" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Proveedor (estación) *">
            <input type="text" value={proveedorNombre} onChange={(e) => setProveedorNombre(e.target.value)} placeholder="Ej: Copec Curicó" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </Field>
          <Field label="RUT proveedor">
            <input
              type="text"
              value={proveedorRut}
              onChange={(e) => setProveedorRut(e.target.value)}
              onBlur={(e) => setProveedorRut(formatRut(e.target.value))}
              placeholder="99.500.140-9"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Dirección del proveedor">
            <input type="text" value={proveedorDireccion} onChange={(e) => setProveedorDireccion(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </Field>
        </div>
      </div>

      {/* Sección 2: Montos */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Montos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Field label="Monto total *">
            <input type="number" value={montoTotal} onChange={(e) => setMontoTotal(e.target.value)} placeholder="0" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </Field>
          <Field label="Neto (sin IVA)">
            <input type="number" value={montoNeto} onChange={(e) => setMontoNeto(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </Field>
          <Field label="IVA (19%)">
            <input type="number" value={montoIva} onChange={(e) => setMontoIva(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </Field>
          <Field label="IEC recuperable">
            <input type="number" value={montoIec} onChange={(e) => setMontoIec(e.target.value)} placeholder="Opcional" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={recuperable} onChange={(e) => setRecuperable(e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
          Recuperable — se incluye en F29 para recuperar Impuesto Específico
        </label>
      </div>

      {/* Sección 3: Archivo */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Archivo de la factura</h2>
        {archivoUrl ? (
          <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
            <div>
              <div className="text-sm font-medium">{archivoNombre}</div>
              <div className="text-xs text-gray-500">{archivoTamano ? Math.round(archivoTamano / 1024) + ' KB' : ''}</div>
            </div>
            <button
              onClick={() => {
                setArchivoUrl(null);
                setArchivoNombre(null);
                setArchivoTamano(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="text-xs text-red-600 hover:text-red-700"
            >
              Quitar
            </button>
          </div>
        ) : (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleFile}
              disabled={uploading}
              className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            />
            <p className="text-xs text-gray-500 mt-2">PDF, JPG, PNG o WEBP. Máximo 10MB.</p>
            {uploading && <p className="text-xs text-orange-600 mt-1">Subiendo...</p>}
          </div>
        )}
      </div>

      {/* Sección 4: Items */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Detalle de consumo</h2>
            <p className="text-xs text-gray-500">Asigna el consumo a una o más maquinarias</p>
          </div>
          <button onClick={addItem} type="button" className="text-sm font-medium text-orange-600 hover:text-orange-700">
            + Agregar equipo
          </button>
        </div>

        <div className="space-y-3">
          {items.map((it, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-3 bg-gray-50/30">
              <div className="flex items-start justify-between">
                <div className="text-xs font-semibold text-gray-600">Equipo #{idx + 1}</div>
                {items.length > 1 && (
                  <button onClick={() => removeItem(idx)} type="button" className="text-xs text-red-500 hover:text-red-700">Eliminar</button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Maquinaria">
                  <select value={it.maquinaria_id} onChange={(e) => onMaquinariaChange(idx, e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">— Sin asignar —</option>
                    {maquinarias.map((m) => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Contrato asociado (opcional)">
                  <select value={it.contrato_id} onChange={(e) => updateItem(idx, 'contrato_id', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    <option value="">— Ninguno —</option>
                    {contratos
                      .filter((c) => !it.maquinaria_id || c.maquinaria_id === Number(it.maquinaria_id))
                      .map((c) => (
                        <option key={c.id} value={c.id}>{c.numero} — {c.arrendatario_razon_social || c.arrendatario_nombre}</option>
                      ))}
                  </select>
                </Field>
                <Field label="Tipo combustible">
                  <select value={it.tipo_combustible} onChange={(e) => updateItem(idx, 'tipo_combustible', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {Object.entries(tiposCombustibleLabels).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Field label="Litros *">
                  <input type="number" step="0.01" value={it.litros} onChange={(e) => updateItem(idx, 'litros', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </Field>
                <Field label="Monto CLP">
                  <input type="number" value={it.monto} onChange={(e) => updateItem(idx, 'monto', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </Field>
                <Field label="Horómetro (opc.)">
                  <input type="number" step="0.1" value={it.horometro} onChange={(e) => updateItem(idx, 'horometro', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </Field>
                <Field label="Observaciones">
                  <input type="text" value={it.observaciones} onChange={(e) => updateItem(idx, 'observaciones', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </Field>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-gray-200 text-sm">
          <div>
            <span className="text-gray-500">Total litros:</span> <strong>{totalLitros.toFixed(2)} L</strong>
            <span className="ml-4 text-gray-500">Suma items:</span> <strong>{formatCLP(totalItems)}</strong>
          </div>
          {montoTotal && diferenciaSignif && (
            <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              ⚠ Diferencia {formatDiff(diferencia)} con el monto total declarado
            </div>
          )}
        </div>
      </div>

      {/* Notas + acciones */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <Field label="Notas (opcional)">
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </Field>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}

        <div className="flex gap-3 justify-end">
          <Link href="/admin/combustible" className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50">
            Cancelar
          </Link>
          <button
            onClick={() => handleSubmit('registrada')}
            disabled={saving}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar como borrador'}
          </button>
          <button
            onClick={() => handleSubmit('validada')}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-white font-medium text-sm hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#0c1d3a' }}
          >
            {saving ? 'Guardando...' : 'Guardar y validar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function formatDiff(n: number) {
  const sign = n > 0 ? '+' : '';
  return sign + formatCLP(Math.round(n));
}
