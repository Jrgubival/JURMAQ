'use client';

import { useState, useEffect } from 'react';

interface Categoria {
  id: number;
  nombre: string;
  slug: string;
}

interface Producto {
  id: number;
  nombre: string;
  precio: number;
  peso: number | null;
  categoria_id: number | null;
}

const formatCLP = (amount: number) => '$' + amount.toLocaleString('es-CL');

export default function PreciosPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Section 1: Percentage
  const [pctCat, setPctCat] = useState('');
  const [pctValue, setPctValue] = useState('');
  const [pctPreview, setPctPreview] = useState<{ count: number; ejemplo?: { antes: number; despues: number } } | null>(null);
  const [pctApplying, setPctApplying] = useState(false);

  // Section 2: By weight
  const [valorKg, setValorKg] = useState('');
  const [weightPreview, setWeightPreview] = useState<{ id: number; nombre: string; peso: number; precioActual: number; precioNuevo: number }[]>([]);
  const [weightLoading, setWeightLoading] = useState(false);
  const [weightApplying, setWeightApplying] = useState(false);
  const [weightCat, setWeightCat] = useState('');

  // Section 3: Bulk image
  const [imgCat, setImgCat] = useState('');
  const [imgUrl, setImgUrl] = useState('');
  const [imgApplying, setImgApplying] = useState(false);

  // Section 4: Excel-driven legitimate promotions module.
  type PromoRow = {
    rowIndex: number;
    codigo: string;
    precio_promocional: number;
    fecha_fin: string | null;
    status: 'ok' | 'reject';
    reason?: string;
    productoId?: number;
    precioActual?: number;
    diasVigencia?: number;
    descuento?: number;
  };
  const [promoFile, setPromoFile] = useState<File | null>(null);
  const [promoPreviewLoading, setPromoPreviewLoading] = useState(false);
  const [promoApplying, setPromoApplying] = useState(false);
  const [promoExpireLoading, setPromoExpireLoading] = useState(false);
  const [promoRows, setPromoRows] = useState<PromoRow[]>([]);
  const [promoSummary, setPromoSummary] = useState<{ total: number; ok: number; reject: number } | null>(null);
  const [promoExecuted, setPromoExecuted] = useState(false);

  // Section 5: Remove offers
  const [removeFiltro, setRemoveFiltro] = useState<'categoria' | 'codigo'>('categoria');
  const [removeOfferCat, setRemoveOfferCat] = useState('');
  const [removeOfferCodigo, setRemoveOfferCodigo] = useState('');
  const [removeOfferApplying, setRemoveOfferApplying] = useState(false);
  const [ofertasActivas, setOfertasActivas] = useState<{ id: number; codigo: string; nombre: string; precioInflado: number; precioReal: number; descuentoVisible: number }[]>([]);
  const [ofertasLoading, setOfertasLoading] = useState(false);

  // Section 6: Solo cotizar
  const [cotizarCat, setCotizarCat] = useState('');
  const [cotizarValue, setCotizarValue] = useState(true);
  const [cotizarApplying, setCotizarApplying] = useState(false);

  // All products for preview
  const [allProducts, setAllProducts] = useState<Producto[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [catRes, prodRes] = await Promise.all([
        fetch('/api/barraca/categorias'),
        fetch('/api/barraca/productos'),
      ]);
      if (catRes.ok) {
        const data = await catRes.json();
        setCategorias(Array.isArray(data) ? data : data.data || data.categorias || []);
      }
      if (prodRes.ok) {
        const data = await prodRes.json();
        const prods = Array.isArray(data) ? data : data.data || data.productos || [];
        setAllProducts(prods);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  // Preview for percentage
  useEffect(() => {
    if (pctCat && pctValue) {
      const catId = Number(pctCat);
      const pct = Number(pctValue);
      const matching = allProducts.filter((p) => p.categoria_id === catId);
      if (matching.length > 0) {
        const ejemplo = matching[0];
        setPctPreview({
          count: matching.length,
          ejemplo: {
            antes: ejemplo.precio,
            despues: Math.round(ejemplo.precio * (1 + pct / 100)),
          },
        });
      } else {
        setPctPreview({ count: 0 });
      }
    } else {
      setPctPreview(null);
    }
  }, [pctCat, pctValue, allProducts]);

  // Preview for weight
  const loadWeightPreview = async () => {
    if (!valorKg) return;
    setWeightLoading(true);
    try {
      const kg = Number(valorKg);
      let catId = weightCat ? Number(weightCat) : null;
      if (!catId) {
        const fierroCat = categorias.find((c) => c.nombre.toLowerCase().includes('fierro'));
        catId = fierroCat?.id || null;
      }
      if (!catId) {
        setWeightPreview([]);
        setWeightLoading(false);
        return;
      }
      const matching = allProducts.filter(
        (p) => p.categoria_id === catId && p.peso && p.peso > 0
      );
      setWeightPreview(
        matching.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          peso: p.peso || 0,
          precioActual: p.precio,
          precioNuevo: Math.round((p.peso || 0) * kg),
        }))
      );
    } catch {
      setWeightPreview([]);
    } finally {
      setWeightLoading(false);
    }
  };

  // Apply percentage
  const applyPercentage = async () => {
    setPctApplying(true);
    try {
      const res = await fetch('/api/barraca/productos/bulk-price', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'percentage',
          categoriaId: Number(pctCat),
          percentage: Number(pctValue),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showMessage(`${data.updated} productos actualizados`, 'success');
        fetchData();
      } else {
        showMessage(data.error || 'Error', 'error');
      }
    } catch {
      showMessage('Error de conexión', 'error');
    } finally {
      setPctApplying(false);
    }
  };

  // Apply by weight
  const applyWeight = async () => {
    setWeightApplying(true);
    try {
      let catId = weightCat ? Number(weightCat) : null;
      if (!catId) {
        const fierroCat = categorias.find((c) => c.nombre.toLowerCase().includes('fierro'));
        catId = fierroCat?.id || null;
      }
      const res = await fetch('/api/barraca/productos/bulk-price', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'by_weight',
          categoriaId: catId,
          valorKg: Number(valorKg),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showMessage(`${data.updated} productos actualizados`, 'success');
        fetchData();
        setWeightPreview([]);
      } else {
        showMessage(data.error || 'Error', 'error');
      }
    } catch {
      showMessage('Error de conexión', 'error');
    } finally {
      setWeightApplying(false);
    }
  };

  // Apply bulk image
  const applyImage = async () => {
    setImgApplying(true);
    try {
      const res = await fetch('/api/barraca/productos/bulk-image', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoriaId: Number(imgCat),
          imagen: imgUrl,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showMessage(`${data.updated} productos actualizados`, 'success');
        setImgUrl('');
      } else {
        showMessage(data.error || 'Error', 'error');
      }
    } catch {
      showMessage('Error de conexión', 'error');
    } finally {
      setImgApplying(false);
    }
  };

  // ---- Section 4: Excel-driven legitimate promotions ----
  const promoUploadAndPreview = async () => {
    if (!promoFile) return;
    setPromoPreviewLoading(true);
    setPromoRows([]);
    setPromoSummary(null);
    setPromoExecuted(false);
    try {
      const fd = new FormData();
      fd.append('file', promoFile);
      const res = await fetch('/api/barraca/promociones/import?mode=preview', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        showMessage(data.error || 'Error al validar el Excel', 'error');
        return;
      }
      setPromoRows(data.rows || []);
      setPromoSummary({ total: data.total, ok: data.ok, reject: data.reject });
      if ((data.ok || 0) === 0) {
        showMessage('Ninguna fila pasa validacion. Revisa los motivos en la tabla.', 'error');
      }
    } catch {
      showMessage('Error de conexion', 'error');
    } finally {
      setPromoPreviewLoading(false);
    }
  };

  const promoExecute = async () => {
    if (!promoFile) return;
    if (!confirm('Aplicar las promociones validadas? Los precios actuales pasaran a precio_original.')) return;
    setPromoApplying(true);
    try {
      const fd = new FormData();
      fd.append('file', promoFile);
      const res = await fetch('/api/barraca/promociones/import?mode=execute', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        showMessage(data.error || 'Error al aplicar', 'error');
        return;
      }
      setPromoRows(data.rows || []);
      setPromoSummary({ total: (data.applied || 0) + (data.rejected || 0) + (data.failedAtUpdate || 0), ok: data.applied || 0, reject: (data.rejected || 0) + (data.failedAtUpdate || 0) });
      setPromoExecuted(true);
      showMessage(`Aplicadas ${data.applied} promociones`, 'success');
      fetchData();
    } catch {
      showMessage('Error de conexion', 'error');
    } finally {
      setPromoApplying(false);
    }
  };

  const promoExpire = async () => {
    setPromoExpireLoading(true);
    try {
      const res = await fetch('/api/barraca/promociones/import?mode=expire', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        showMessage(data.error || 'Error al expirar ofertas', 'error');
        return;
      }
      showMessage(`${data.revertidas} oferta(s) revertida(s)`, 'success');
      fetchData();
    } catch {
      showMessage('Error de conexion', 'error');
    } finally {
      setPromoExpireLoading(false);
    }
  };

  // Load active offers
  const loadOfertasActivas = async () => {
    setOfertasLoading(true);
    setOfertasActivas([]);
    try {
      const res = await fetch('/api/barraca/productos/bulk-price', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'list_offers',
          categoriaId: removeFiltro === 'categoria' ? Number(removeOfferCat) : undefined,
          codigoPrefix: removeFiltro === 'codigo' ? removeOfferCodigo.trim().toUpperCase() : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setOfertasActivas(data.productos || []);
        if ((data.productos || []).length === 0) {
          showMessage('No hay productos en oferta con este filtro', 'error');
        }
      } else {
        showMessage(data.error || 'Error', 'error');
      }
    } catch {
      showMessage('Error de conexión', 'error');
    } finally {
      setOfertasLoading(false);
    }
  };

  // Remove offers (restaurar precios)
  const removeOffers = async () => {
    setRemoveOfferApplying(true);
    try {
      const res = await fetch('/api/barraca/productos/bulk-price', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove_offers',
          categoriaId: removeFiltro === 'categoria' ? Number(removeOfferCat) : undefined,
          codigoPrefix: removeFiltro === 'codigo' ? removeOfferCodigo.trim().toUpperCase() : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showMessage(`Precios restaurados en ${data.updated} productos`, 'success');
        setOfertasActivas([]);
        fetchData();
      } else {
        showMessage(data.error || 'Error', 'error');
      }
    } catch {
      showMessage('Error de conexión', 'error');
    } finally {
      setRemoveOfferApplying(false);
    }
  };

  // Toggle cotizar
  const applyCotizar = async () => {
    setCotizarApplying(true);
    try {
      const res = await fetch('/api/barraca/productos/bulk-price', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_cotizar',
          categoriaId: Number(cotizarCat),
          soloCotizar: cotizarValue,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showMessage(`${data.updated} productos actualizados`, 'success');
        fetchData();
      } else {
        showMessage(data.error || 'Error', 'error');
      }
    } catch {
      showMessage('Error de conexión', 'error');
    } finally {
      setCotizarApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#e6b422' }} />
      </div>
    );
  }

  const CategorySelect = ({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) => (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 text-sm"
    >
      <option value="">Seleccionar categoria</option>
      {categorias.map((c) => (
        <option key={c.id} value={String(c.id)}>{c.nombre}</option>
      ))}
    </select>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gestion de Precios</h1>
        <p className="text-sm text-gray-500 mt-1">Modificar precios en lote, ofertas y modo cotizacion</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Section 1: Percentage Price Change */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Modificar precios en lote</h2>
        <p className="text-sm text-gray-500 mb-4">Aplica un porcentaje de aumento o descuento a todos los productos de una categoria</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="pct-cat" className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <CategorySelect id="pct-cat" value={pctCat} onChange={setPctCat} />
          </div>
          <div>
            <label htmlFor="pct-value" className="block text-sm font-medium text-gray-700 mb-1">Porcentaje (%)</label>
            <input
              id="pct-value"
              type="number"
              value={pctValue}
              onChange={(e) => setPctValue(e.target.value)}
              placeholder="Ej: 20 o -10"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 text-sm"
            />
          </div>
        </div>

        {pctPreview && (
          <div className="bg-gray-50 rounded-lg p-4 mb-4 text-sm">
            <p className="text-gray-700">
              <span className="font-semibold">{pctPreview.count}</span> productos seran afectados
            </p>
            {pctPreview.ejemplo && (
              <p className="text-gray-500 mt-1">
                Ejemplo: {formatCLP(pctPreview.ejemplo.antes)} → <span className="font-semibold text-gray-900">{formatCLP(pctPreview.ejemplo.despues)}</span>
              </p>
            )}
          </div>
        )}

        <button
          onClick={applyPercentage}
          disabled={pctApplying || !pctCat || !pctValue}
          className="px-5 py-2.5 rounded-lg text-white font-medium text-sm transition hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: '#0c1d3a' }}
        >
          {pctApplying ? 'Aplicando...' : 'Aplicar'}
        </button>
      </div>

      {/* Section 2: Price by Weight */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Precio por Kilogramo (Fierros)</h2>
        <p className="text-sm text-gray-500 mb-4">Recalcula precios basado en peso * valor del kg para productos con peso registrado</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="weight-cat" className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <CategorySelect id="weight-cat" value={weightCat} onChange={setWeightCat} />
            <p className="text-xs text-gray-400 mt-1">Vacio = categoria &quot;FIERROS CONSTRUCCION&quot; automatica</p>
          </div>
          <div>
            <label htmlFor="valor-kg" className="block text-sm font-medium text-gray-700 mb-1">Valor del KG fierro ($)</label>
            <div className="flex gap-2">
              <input
                id="valor-kg"
                type="number"
                value={valorKg}
                onChange={(e) => setValorKg(e.target.value)}
                placeholder="Ej: 950"
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 text-sm"
              />
              <button
                onClick={loadWeightPreview}
                disabled={!valorKg || weightLoading}
                className="px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
              >
                {weightLoading ? '...' : 'Vista previa'}
              </button>
            </div>
          </div>
        </div>

        {weightPreview.length > 0 && (
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">Producto</th>
                  <th className="text-right px-3 py-2 font-semibold text-gray-600">Peso (kg)</th>
                  <th className="text-right px-3 py-2 font-semibold text-gray-600">Precio Actual</th>
                  <th className="text-right px-3 py-2 font-semibold text-gray-600">Precio Nuevo</th>
                </tr>
              </thead>
              <tbody>
                {weightPreview.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100">
                    <td className="px-3 py-2 text-gray-900">{p.nombre}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{p.peso}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{formatCLP(p.precioActual)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatCLP(p.precioNuevo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button
          onClick={applyWeight}
          disabled={weightApplying || !valorKg}
          className="px-5 py-2.5 rounded-lg text-white font-medium text-sm transition hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: '#0c1d3a' }}
        >
          {weightApplying ? 'Aplicando...' : 'Aplicar'}
        </button>
      </div>

      {/* Section 3: Bulk Image */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Actualizar imagenes en lote</h2>
        <p className="text-sm text-gray-500 mb-4">Asigna la misma imagen a todos los productos de una categoria</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="img-cat" className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <CategorySelect id="img-cat" value={imgCat} onChange={setImgCat} />
          </div>
          <div>
            <label htmlFor="img-url" className="block text-sm font-medium text-gray-700 mb-1">URL de imagen</label>
            <input
              id="img-url"
              type="text"
              value={imgUrl}
              onChange={(e) => setImgUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 text-sm"
            />
          </div>
        </div>

        {imgUrl && (
          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-2">Vista previa:</p>
            <img src={imgUrl} alt="Preview" className="w-24 h-24 object-cover rounded-lg border border-gray-200" />
          </div>
        )}

        <button
          onClick={applyImage}
          disabled={imgApplying || !imgCat || !imgUrl}
          className="px-5 py-2.5 rounded-lg text-white font-medium text-sm transition hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: '#0c1d3a' }}
        >
          {imgApplying ? 'Aplicando...' : 'Aplicar a todos'}
        </button>
      </div>

      {/* Section 4: Importar Promociones desde Excel — reemplazo legitimo de "fake offers" */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Importar Promociones (Excel)</h2>
        <p className="text-sm text-gray-500 mb-1">
          Sube un Excel con columnas <code className="bg-gray-100 px-1 rounded text-xs">codigo</code>,{' '}
          <code className="bg-gray-100 px-1 rounded text-xs">precio_promocional</code> y opcionalmente{' '}
          <code className="bg-gray-100 px-1 rounded text-xs">fecha_fin</code> (YYYY-MM-DD).
        </p>
        <p className="text-xs text-amber-700 mb-4">
          ⚖ Cumplimiento Ley 19.496 art. 28: el sistema rechaza filas donde el precio promocional sea mayor o igual al actual,
          o donde el precio actual no haya estado vigente al menos 30 dias en los ultimos 30.
        </p>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              setPromoFile(e.target.files?.[0] || null);
              setPromoRows([]);
              setPromoSummary(null);
              setPromoExecuted(false);
            }}
            className="text-sm"
          />
          <button
            onClick={promoUploadAndPreview}
            disabled={!promoFile || promoPreviewLoading}
            className="px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
          >
            {promoPreviewLoading ? 'Validando...' : 'Validar (preview)'}
          </button>
          <button
            onClick={promoExpire}
            disabled={promoExpireLoading}
            className="ml-auto px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition"
            title="Revierte automaticamente las ofertas cuya fecha_fin ya paso"
          >
            {promoExpireLoading ? 'Expirando...' : 'Expirar vencidas'}
          </button>
        </div>

        {promoSummary && (
          <div className="mb-4 grid grid-cols-3 gap-3 text-center">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-2xl font-semibold text-gray-900">{promoSummary.total}</div>
              <div className="text-xs text-gray-500">Total filas</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 border border-green-200">
              <div className="text-2xl font-semibold text-green-700">{promoSummary.ok}</div>
              <div className="text-xs text-green-700">{promoExecuted ? 'Aplicadas' : 'Validas'}</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3 border border-red-200">
              <div className="text-2xl font-semibold text-red-700">{promoSummary.reject}</div>
              <div className="text-xs text-red-700">Rechazadas</div>
            </div>
          </div>
        )}

        {promoRows.length > 0 && (
          <div className="space-y-3">
            <div className="overflow-x-auto max-h-96 border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Fila</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Codigo</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600">Precio Actual</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600">Precio Promo</th>
                    <th className="text-center px-3 py-2 font-semibold text-gray-600">Descuento</th>
                    <th className="text-center px-3 py-2 font-semibold text-gray-600">Fecha Fin</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {promoRows.map((r) => (
                    <tr key={r.rowIndex} className={`border-t border-gray-100 ${r.status === 'reject' ? 'bg-red-50/40' : ''}`}>
                      <td className="px-3 py-2 text-gray-500 text-xs">{r.rowIndex}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-700">{r.codigo || <span className="text-red-500">—</span>}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{r.precioActual ? formatCLP(r.precioActual) : '—'}</td>
                      <td className="px-3 py-2 text-right font-medium text-gray-900">{formatCLP(r.precio_promocional)}</td>
                      <td className="px-3 py-2 text-center">
                        {r.descuento !== undefined ? (
                          <span className="inline-flex px-2 py-0.5 text-xs font-bold bg-green-100 text-green-700 rounded-full">-{r.descuento}%</span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2 text-center text-xs text-gray-600">{r.fecha_fin || <span className="text-gray-400">sin fin</span>}</td>
                      <td className="px-3 py-2">
                        {r.status === 'ok' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">✓ ok</span>
                        ) : (
                          <span className="text-xs text-red-700" title={r.reason}>✗ {r.reason}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!promoExecuted && (promoSummary?.ok || 0) > 0 && (
              <div className="flex gap-3">
                <button
                  onClick={promoExecute}
                  disabled={promoApplying}
                  className="px-5 py-2.5 rounded-lg text-white font-medium text-sm transition hover:opacity-90 disabled:opacity-50 bg-green-600 hover:bg-green-700"
                >
                  {promoApplying ? 'Aplicando...' : `Aplicar ${promoSummary?.ok} promocion(es)`}
                </button>
                <button
                  onClick={() => { setPromoRows([]); setPromoSummary(null); }}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 5: Desactivar Promocion */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Desactivar Promocion</h2>
        <p className="text-sm text-gray-500 mb-4">Restaura los precios originales y quita las marcas de oferta</p>

        {/* Filtro tipo */}
        <div className="flex gap-4 mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="removeFiltro" checked={removeFiltro === 'categoria'} onChange={() => { setRemoveFiltro('categoria'); setOfertasActivas([]); }} className="text-orange-600 focus:ring-orange-500" />
            <span className="text-sm font-medium text-gray-700">Por Categoria</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="removeFiltro" checked={removeFiltro === 'codigo'} onChange={() => { setRemoveFiltro('codigo'); setOfertasActivas([]); }} className="text-orange-600 focus:ring-orange-500" />
            <span className="text-sm font-medium text-gray-700">Por Codigo (prefijo)</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {removeFiltro === 'categoria' ? (
            <div>
              <label htmlFor="remove-offer-cat" className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
              <CategorySelect id="remove-offer-cat" value={removeOfferCat} onChange={(v) => { setRemoveOfferCat(v); setOfertasActivas([]); }} />
            </div>
          ) : (
            <div>
              <label htmlFor="remove-offer-codigo" className="block text-sm font-medium text-gray-700 mb-1">Prefijo de Codigo</label>
              <input
                id="remove-offer-codigo"
                type="text"
                value={removeOfferCodigo}
                onChange={(e) => { setRemoveOfferCodigo(e.target.value.toUpperCase()); setOfertasActivas([]); }}
                placeholder='Ej: "FE", "ACH", "AM"'
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 text-sm uppercase"
              />
            </div>
          )}
          <div className="flex items-end">
            <button
              onClick={loadOfertasActivas}
              disabled={ofertasLoading || (removeFiltro === 'categoria' && !removeOfferCat) || (removeFiltro === 'codigo' && !removeOfferCodigo.trim())}
              className="px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
            >
              {ofertasLoading ? 'Cargando...' : 'Ver Ofertas Activas'}
            </button>
          </div>
        </div>

        {/* Active offers table */}
        {ofertasActivas.length > 0 && (
          <div className="space-y-4">
            <div className="bg-orange-50 rounded-lg p-3 text-sm text-orange-800 border border-orange-200">
              <p className="font-medium">{ofertasActivas.length} productos actualmente en oferta</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Codigo</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Nombre</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600">Precio Inflado</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600">Precio Real</th>
                    <th className="text-center px-3 py-2 font-semibold text-gray-600">&quot;Descuento&quot;</th>
                  </tr>
                </thead>
                <tbody>
                  {ofertasActivas.map((p) => (
                    <tr key={p.id} className="border-b border-gray-100">
                      <td className="px-3 py-2 text-xs font-mono text-gray-500">{p.codigo}</td>
                      <td className="px-3 py-2 text-gray-900 truncate max-w-[200px]">{p.nombre}</td>
                      <td className="px-3 py-2 text-right"><span className="line-through text-gray-400">{formatCLP(p.precioInflado)}</span></td>
                      <td className="px-3 py-2 text-right font-medium text-green-700">{formatCLP(p.precioReal)}</td>
                      <td className="px-3 py-2 text-center"><span className="inline-flex px-2 py-0.5 text-xs font-bold bg-red-100 text-red-700 rounded-full">-{p.descuentoVisible}%</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={removeOffers}
              disabled={removeOfferApplying}
              className="px-5 py-2.5 rounded-lg text-sm font-medium border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 transition bg-red-50"
            >
              {removeOfferApplying ? 'Restaurando...' : `Restaurar Precios (${ofertasActivas.length} productos)`}
            </button>
          </div>
        )}
      </div>

      {/* Section 6: Solo Cotizar */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Modo solo cotizar</h2>
        <p className="text-sm text-gray-500 mb-4">Los productos en modo cotizar no muestran precio y el boton cambia a &quot;Solicitar Cotizacion&quot;</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="cotizar-cat" className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <CategorySelect id="cotizar-cat" value={cotizarCat} onChange={setCotizarCat} />
          </div>
          <div>
            <label htmlFor="cotizar-mode" className="block text-sm font-medium text-gray-700 mb-1">Modo</label>
            <select
              id="cotizar-mode"
              value={cotizarValue ? 'true' : 'false'}
              onChange={(e) => setCotizarValue(e.target.value === 'true')}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 text-sm"
            >
              <option value="true">Activar &quot;Solo Cotizar&quot;</option>
              <option value="false">Desactivar &quot;Solo Cotizar&quot; (mostrar precios)</option>
            </select>
          </div>
        </div>

        <button
          onClick={applyCotizar}
          disabled={cotizarApplying || !cotizarCat}
          className="px-5 py-2.5 rounded-lg text-white font-medium text-sm transition hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: '#0c1d3a' }}
        >
          {cotizarApplying ? 'Aplicando...' : 'Aplicar'}
        </button>
      </div>
    </div>
  );
}
