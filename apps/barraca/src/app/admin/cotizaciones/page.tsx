'use client';

import { useState, useEffect } from 'react';
import { formatCLP } from "@jurmaq/shared/format";

interface CotizacionItem {
  productoId: number;
  nombre: string;
  medida?: string;
  cantidad: number;
  precio: number;
  subtotal: number;
}

/**
 * Shape de un item mientras se edita en el modo "Editar cotización".
 * Extiende CotizacionItem con `tipo` (producto/flete/servicio/otro) y
 * `descuento` (porcentaje 0-100). Algunas filas pueden ser ítems custom
 * sin productoId — por eso productoId es opcional acá.
 */
interface EditableCotizacionItem {
  productoId?: number;
  nombre: string;
  medida?: string;
  cantidad: number;
  precio: number;
  subtotal?: number;
  tipo: 'producto' | 'flete' | 'servicio' | 'otro';
  descuento: number;
}

interface Cotizacion {
  id: number;
  numero: string;
  nombre: string;
  empresa: string | null;
  email: string;
  telefono: string;
  rut: string | null;
  items: string;
  total: number;
  estado: string;
  metodo_pago: string | null;
  payment_url: string | null;
  notas: string | null;
  cotizacion_competencia: string | null;
  nombre_competencia: string | null;
  contraoferta_items: string | null;
  contraoferta_total: number | null;
  contraoferta_mensaje: string | null;
  created_at: string;
}
interface ContraofertaEditItem {
  nombre: string;
  cantidad: number;
  precioOriginal: number;
  precioContraoferta: number;
}

const estadoConfig: Record<string, { bg: string; text: string; label: string }> = {
  pendiente: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pendiente' },
  enviada: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Enviada' },
  contraoferta: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Contraoferta' },
  aprobada: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Aprobada' },
  aceptada: { bg: 'bg-green-100', text: 'text-green-700', label: 'Aceptada' },
  pagada: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Pagada' },
  rechazada: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rechazada' },
};

export default function BarracaCotizacionesPage() {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEstado, setFilterEstado] = useState('');
  const [selectedCot, setSelectedCot] = useState<Cotizacion | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');

  // Counter-offer state
  const [showContraoferta, setShowContraoferta] = useState(false);
  const [contraofertaItems, setContraofertaItems] = useState<ContraofertaEditItem[]>([]);
  const [contraofertaMensaje, setContraofertaMensaje] = useState('');
  const [sendingContraoferta, setSendingContraoferta] = useState(false);

  // Message modal state
  const [messageModal, setMessageModal] = useState(false);
  const [messageForm, setMessageForm] = useState({ tipo: 'Aprobada', mensaje: '', linkPago: '', asunto: '' });
  const [sendingMessage, setSendingMessage] = useState(false);

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [editItems, setEditItems] = useState<EditableCotizacionItem[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const TIPO_OPTIONS = [
    { value: 'producto', label: 'Producto' },
    { value: 'flete', label: 'Flete / Despacho' },
    { value: 'servicio', label: 'Servicio' },
    { value: 'otro', label: 'Otro' },
  ];

  const computeSubtotal = (item: EditableCotizacionItem) => {
    const base = (item.precio || 0) * (item.cantidad || 1);
    if (item.descuento && item.descuento > 0) return Math.round(base * (1 - item.descuento / 100));
    return base;
  };

  const editTotal = editItems.reduce((sum, item) => sum + computeSubtotal(item), 0);

  const openEditMode = (cot: Cotizacion) => {
    const items: EditableCotizacionItem[] = parseItems(cot.items).map((item) => ({
      productoId: item.productoId,
      nombre: item.nombre,
      medida: item.medida,
      cantidad: item.cantidad,
      precio: item.precio,
      subtotal: item.subtotal,
      tipo: (item as Partial<EditableCotizacionItem>).tipo || 'producto',
      descuento: (item as Partial<EditableCotizacionItem>).descuento || 0,
    }));
    setEditItems(items);
    setEditMode(true);
  };

  const updateEditItem = <K extends keyof EditableCotizacionItem>(
    idx: number,
    field: K,
    value: EditableCotizacionItem[K]
  ) => {
    setEditItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  };

  const addCustomItem = () => {
    setEditItems(prev => [...prev, { nombre: '', cantidad: 1, precio: 0, tipo: 'flete', descuento: 0 }]);
  };

  const removeEditItem = (idx: number) => {
    setEditItems(prev => prev.filter((_, i) => i !== idx));
  };

  const saveEditedCotizacion = async () => {
    if (!selectedCot || editItems.length === 0) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/cotizaciones/${selectedCot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: editItems, total: Math.max(0, editTotal) }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error'); }
      setEditMode(false);
      fetchData();
      setSelectedCot({ ...selectedCot, items: JSON.stringify(editItems), total: Math.max(0, editTotal) });
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const fetchData = async () => {
    try {
      const res = await fetch('/api/cotizaciones');
      if (res.ok) {
        const data = await res.json();
        setCotizaciones(Array.isArray(data) ? data : data.data || []);
      }
    } catch (err) {
      console.error('Error fetching cotizaciones:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const changeEstado = async (cot: Cotizacion, nuevoEstado: string) => {
    try {
      await fetch(`/api/cotizaciones/${cot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      fetchData();
      if (selectedCot?.id === cot.id) {
        setSelectedCot({ ...cot, estado: nuevoEstado });
      }
    } catch (err) {
      console.error('Error changing estado:', err);
    }
  };

  const approveAndSendPayment = async (cot: Cotizacion, method: 'mercadopago' | 'efectivo') => {
    setActionLoading(cot.id);
    setActionError('');
    try {
      const res = await fetch('/api/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cotizacionId: cot.id, method }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || 'Error al procesar');
        return;
      }
      fetchData();
      if (selectedCot?.id === cot.id) {
        setSelectedCot({ ...cot, estado: 'aprobada', metodo_pago: method, payment_url: data.paymentUrl || null });
      }
    } catch (err) {
      setActionError('Error de conexión');
      console.error('Error approving cotizacion:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const markAsPaid = async (cot: Cotizacion) => {
    setActionLoading(cot.id);
    try {
      await fetch(`/api/cotizaciones/${cot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'pagada' }),
      });
      fetchData();
      if (selectedCot?.id === cot.id) {
        setSelectedCot({ ...cot, estado: 'pagada' });
      }
    } catch (err) {
      console.error('Error marking as paid:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const openDetail = (cot: Cotizacion) => {
    setSelectedCot(cot);
    setShowDetail(true);
    setShowContraoferta(false);
    setActionError('');
  };

  const openContraofertaForm = (cot: Cotizacion) => {
    const items = parseItems(cot.items);
    setContraofertaItems(
      items.map((item) => ({
        nombre: item.nombre,
        cantidad: item.cantidad,
        precioOriginal: item.precio,
        precioContraoferta: Math.round(item.precio * 0.85), // Start with 15% discount
      }))
    );
    setContraofertaMensaje(
      cot.nombre_competencia
        ? `Le mejoramos los precios de ${cot.nombre_competencia}. Aproveche esta oferta especial de JURMAQ Barraca.`
        : 'Le ofrecemos mejores precios. Aproveche esta oferta especial de JURMAQ Barraca.'
    );
    setShowContraoferta(true);
  };

  const updateContraofertaPrice = (idx: number, newPrice: number) => {
    setContraofertaItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, precioContraoferta: newPrice } : item))
    );
  };

  const contraofertaTotal = contraofertaItems.reduce(
    (sum, item) => sum + item.precioContraoferta * item.cantidad,
    0
  );

  const sendContraoferta = async (cot: Cotizacion) => {
    setSendingContraoferta(true);
    setActionError('');
    try {
      // 1. Save contraoferta to DB
      const totalOriginal = contraofertaItems.reduce(
        (sum, item) => sum + item.precioOriginal * item.cantidad,
        0
      );
      const res = await fetch(`/api/cotizaciones/${cot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado: 'contraoferta',
          contraoferta_items: contraofertaItems,
          contraoferta_total: contraofertaTotal,
          contraoferta_mensaje: contraofertaMensaje,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setActionError(data.error || 'Error al guardar contraoferta');
        return;
      }

      // 2. Send email
      const emailRes = await fetch('/api/cotizaciones/contraoferta-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cotizacionId: cot.id,
          email: cot.email,
          numero: cot.numero,
          nombre: cot.nombre,
          nombreCompetencia: cot.nombre_competencia || 'la competencia',
          itemsOriginales: contraofertaItems.map((i) => ({
            nombre: i.nombre,
            cantidad: i.cantidad,
            precio: i.precioOriginal,
          })),
          itemsContraoferta: contraofertaItems.map((i) => ({
            nombre: i.nombre,
            cantidad: i.cantidad,
            precio: i.precioContraoferta,
          })),
          totalOriginal,
          totalContraoferta: contraofertaTotal,
          mensaje: contraofertaMensaje,
          ahorroTotal: totalOriginal - contraofertaTotal,
        }),
      });

      if (!emailRes.ok) {
        console.error('Error al enviar email de contraoferta, pero la contraoferta fue guardada');
      }

      setShowContraoferta(false);
      fetchData();
      if (selectedCot?.id === cot.id) {
        setSelectedCot({ ...cot, estado: 'contraoferta' });
      }
    } catch (err) {
      setActionError('Error al enviar contraoferta');
      console.error(err);
    } finally {
      setSendingContraoferta(false);
    }
  };

  const openMessageModal = (cot: Cotizacion) => {
    setSelectedCot(cot);
    setMessageForm({ tipo: 'Aprobada', mensaje: '', linkPago: '', asunto: '' });
    setMessageModal(true);
    setActionError('');
  };

  const sendMessage = async () => {
    if (!selectedCot) return;
    setSendingMessage(true);
    setActionError('');
    try {
      const res = await fetch(`/api/cotizaciones/${selectedCot.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: messageForm.tipo,
          mensaje: messageForm.mensaje,
          linkPago: messageForm.linkPago || undefined,
          asunto: messageForm.asunto || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setActionError(data.error || 'Error al enviar mensaje');
        return;
      }
      setMessageModal(false);
      fetchData();
    } catch (err) {
      setActionError('Error de conexion al enviar mensaje');
      console.error('Error sending message:', err);
    } finally {
      setSendingMessage(false);
    }
  };

  const parseItems = (itemsJson: string): any[] => {
    try {
      const arr = JSON.parse(itemsJson);
      if (!Array.isArray(arr)) return [];
      return arr.map((item: any) => ({
        ...item,
        tipo: item.tipo || 'producto',
        descuento: item.descuento || 0,
        subtotal: (() => {
          const base = (item.precio || 0) * (item.cantidad || 1);
          if (item.descuento && item.descuento > 0) return Math.round(base * (1 - item.descuento / 100));
          return base;
        })(),
      }));
    } catch {
      return [];
    }
  };

  const filtered = cotizaciones.filter(
    (c) => !filterEstado || c.estado === filterEstado
  );

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
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
          <h1 className="text-2xl font-bold text-gray-900">Cotizaciones Barraca</h1>
          <p className="text-sm text-gray-500 mt-1">{cotizaciones.length} cotizaciones</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-3">
        <select
          value={filterEstado}
          onChange={(e) => setFilterEstado(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900 text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="enviada">Enviada</option>
          <option value="contraoferta">Contraoferta</option>
          <option value="aprobada">Aprobada</option>
          <option value="aceptada">Aceptada</option>
          <option value="pagada">Pagada</option>
          <option value="rechazada">Rechazada</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Numero</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Cliente</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Total</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Estado</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Pago</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Fecha</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cot) => {
                const est = estadoConfig[cot.estado] || estadoConfig.pendiente;
                const isProcessing = actionLoading === cot.id;
                return (
                  <tr key={cot.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-900">{cot.numero}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 flex items-center gap-1.5">
                        {cot.nombre}
                        {cot.cotizacion_competencia && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700" title={`Cotización de ${cot.nombre_competencia || 'competencia'}`}>
                            VS
                          </span>
                        )}
                      </div>
                      {cot.empresa && <div className="text-xs text-gray-500">{cot.empresa}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{cot.email}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCLP(cot.total)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${est.bg} ${est.text}`}>
                        {est.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {cot.metodo_pago ? (
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          cot.metodo_pago === 'mercadopago' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'
                        }`}>
                          {cot.metodo_pago === 'mercadopago' ? 'MercadoPago' : 'Efectivo'}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-500 text-xs">{formatDate(cot.created_at)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        <button
                          onClick={() => openDetail(cot)}
                          className="px-3 py-1.5 text-xs font-medium rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
                        >
                          Ver
                        </button>
                        <button
                          onClick={() => openMessageModal(cot)}
                          className="px-3 py-1.5 text-xs font-medium rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition flex items-center gap-1"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          Mensaje
                        </button>
                        <a
                          href={`/api/cotizaciones/${cot.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 text-xs font-medium rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition flex items-center gap-1"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          PDF
                        </a>
                        {(cot.estado === 'pendiente' || cot.estado === 'enviada') && (
                          <>
                            <button
                              onClick={() => approveAndSendPayment(cot, 'mercadopago')}
                              disabled={isProcessing}
                              className="px-3 py-1.5 text-xs font-medium rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition disabled:opacity-50"
                            >
                              {isProcessing ? '...' : 'MercadoPago'}
                            </button>
                            <button
                              onClick={() => approveAndSendPayment(cot, 'efectivo')}
                              disabled={isProcessing}
                              className="px-3 py-1.5 text-xs font-medium rounded-xl bg-green-50 text-green-700 hover:bg-green-100 transition disabled:opacity-50"
                            >
                              {isProcessing ? '...' : 'Efectivo'}
                            </button>
                          </>
                        )}
                        {cot.estado === 'aprobada' && (
                          <button
                            onClick={() => markAsPaid(cot)}
                            disabled={isProcessing}
                            className="px-3 py-1.5 text-xs font-medium rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition disabled:opacity-50"
                          >
                            {isProcessing ? '...' : 'Marcar Pagado'}
                          </button>
                        )}
                        {cot.estado === 'pendiente' && (
                          <button
                            onClick={() => changeEstado(cot, 'rechazada')}
                            className="px-3 py-1.5 text-xs font-medium rounded-xl bg-red-50 text-red-700 hover:bg-red-100 transition"
                          >
                            Rechazar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    No se encontraron cotizaciones
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Message Modal */}
      {messageModal && selectedCot && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Enviar Mensaje</h3>
                <p className="text-sm text-gray-500">Cotizacion {selectedCot.numero} - {selectedCot.nombre}</p>
              </div>
              <button onClick={() => setMessageModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Tipo */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de mensaje</label>
                <select
                  value={messageForm.tipo}
                  onChange={(e) => setMessageForm((prev) => ({ ...prev, tipo: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                >
                  <option value="Aprobada">Aprobada</option>
                  <option value="Rechazada">Rechazada</option>
                  <option value="Info">Info</option>
                  <option value="Link de Pago">Link de Pago</option>
                  <option value="Mensaje personalizado">Mensaje personalizado</option>
                </select>
              </div>

              {/* Asunto */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Asunto (opcional)</label>
                <input
                  type="text"
                  value={messageForm.asunto}
                  onChange={(e) => setMessageForm((prev) => ({ ...prev, asunto: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  placeholder="Asunto del correo"
                />
              </div>

              {/* Mensaje */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Mensaje</label>
                <textarea
                  value={messageForm.mensaje}
                  onChange={(e) => setMessageForm((prev) => ({ ...prev, mensaje: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  placeholder="Escriba el mensaje para el cliente..."
                />
              </div>

              {/* Link de Pago */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Link de Pago (opcional - Transbank URL)</label>
                <input
                  type="url"
                  value={messageForm.linkPago}
                  onChange={(e) => setMessageForm((prev) => ({ ...prev, linkPago: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  placeholder="https://www.webpay.cl/..."
                />
              </div>

              {/* Error */}
              {actionError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
                  {actionError}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={sendMessage}
                  disabled={sendingMessage || !messageForm.mensaje.trim()}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {sendingMessage ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                  Enviar Mensaje
                </button>
                <button
                  onClick={() => setMessageModal(false)}
                  className="px-4 py-2.5 text-sm font-medium rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && selectedCot && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Cotizacion {selectedCot.numero}
                </h3>
                <p className="text-sm text-gray-500">{formatDate(selectedCot.created_at)}</p>
              </div>
              <button onClick={() => setShowDetail(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Client Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Cliente</p>
                  <p className="font-medium text-gray-900">{selectedCot.nombre}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Empresa</p>
                  <p className="text-gray-700">{selectedCot.empresa || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Email</p>
                  <p className="text-gray-700">{selectedCot.email}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Teléfono</p>
                  <p className="text-gray-700">{selectedCot.telefono}</p>
                </div>
                {selectedCot.rut && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">RUT</p>
                    <p className="text-gray-700">{selectedCot.rut}</p>
                  </div>
                )}
              </div>

              {/* Payment Status */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Estado</p>
                    {(() => {
                      const est = estadoConfig[selectedCot.estado] || estadoConfig.pendiente;
                      return (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${est.bg} ${est.text}`}>
                          {est.label}
                        </span>
                      );
                    })()}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Metodo de Pago</p>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedCot.metodo_pago === 'mercadopago' ? 'MercadoPago' :
                       selectedCot.metodo_pago === 'efectivo' ? 'Efectivo (Transferencia)' : 'Sin asignar'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-900">Productos</h4>
                  {!editMode && ['pendiente', 'enviada', 'contraoferta'].includes(selectedCot.estado) && (
                    <button
                      onClick={() => openEditMode(selectedCot)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Editar Cotizacion
                    </button>
                  )}
                </div>

                {/* Warning if editing cotización with contraoferta */}
                {editMode && selectedCot.contraoferta_items && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 text-xs text-amber-800">
                    <strong>Nota:</strong> Esta cotizacion tiene una contraoferta activa. Estos cambios aplican solo a la cotizacion original.
                  </div>
                )}

                {/* Edit Mode Table */}
                {editMode ? (
                  <div className="space-y-3">
                    <div className="border border-blue-200 rounded-xl overflow-hidden bg-blue-50/30">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-blue-50 border-b border-blue-200">
                            <th className="text-left px-2 py-2 text-blue-800 font-medium text-xs">Producto</th>
                            <th className="text-center px-2 py-2 text-blue-800 font-medium text-xs w-20">Tipo</th>
                            <th className="text-center px-2 py-2 text-blue-800 font-medium text-xs w-16">Cant.</th>
                            <th className="text-right px-2 py-2 text-blue-800 font-medium text-xs w-24">Precio</th>
                            <th className="text-center px-2 py-2 text-blue-800 font-medium text-xs w-16">Dto.%</th>
                            <th className="text-right px-2 py-2 text-blue-800 font-medium text-xs w-24">Subtotal</th>
                            <th className="w-8"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {editItems.map((item, idx) => (
                            <tr key={idx} className="border-b border-blue-100 bg-white">
                              <td className="px-2 py-1.5">
                                <input
                                  type="text"
                                  value={item.nombre}
                                  onChange={(e) => updateEditItem(idx, 'nombre', e.target.value)}
                                  className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-300 focus:border-blue-400 outline-none"
                                  placeholder="Nombre del item"
                                />
                              </td>
                              <td className="px-1 py-1.5">
                                <select
                                  value={item.tipo || 'producto'}
                                  onChange={(e) => updateEditItem(idx, 'tipo', e.target.value as EditableCotizacionItem['tipo'])}
                                  className="w-full border border-gray-200 rounded px-1 py-1 text-xs focus:ring-1 focus:ring-blue-300 outline-none"
                                >
                                  {TIPO_OPTIONS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-1 py-1.5">
                                <input
                                  type="number"
                                  value={item.cantidad}
                                  onChange={(e) => updateEditItem(idx, 'cantidad', Number(e.target.value) || 1)}
                                  min={1}
                                  className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-center focus:ring-1 focus:ring-blue-300 outline-none"
                                />
                              </td>
                              <td className="px-1 py-1.5">
                                <input
                                  type="number"
                                  value={item.precio}
                                  onChange={(e) => updateEditItem(idx, 'precio', Number(e.target.value) || 0)}
                                  className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-right focus:ring-1 focus:ring-blue-300 outline-none"
                                />
                              </td>
                              <td className="px-1 py-1.5">
                                <input
                                  type="number"
                                  value={item.descuento || 0}
                                  onChange={(e) => updateEditItem(idx, 'descuento', Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                                  min={0}
                                  max={100}
                                  className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-center focus:ring-1 focus:ring-blue-300 outline-none"
                                />
                              </td>
                              <td className="px-2 py-1.5 text-right font-semibold text-gray-900 text-sm">
                                {formatCLP(computeSubtotal(item))}
                              </td>
                              <td className="px-1 py-1.5">
                                <button
                                  onClick={() => removeEditItem(idx)}
                                  className="p-1 text-red-400 hover:text-red-600 transition"
                                  title="Eliminar"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-blue-50">
                            <td colSpan={5} className="px-3 py-2 text-right font-semibold text-gray-900">Total</td>
                            <td className="px-2 py-2 text-right font-bold text-lg" style={{ color: '#e6b422' }}>{formatCLP(Math.max(0, editTotal))}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Add Item + Save/Cancel */}
                    <div className="flex items-center justify-between">
                      <button
                        onClick={addCustomItem}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 transition"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Agregar Item (Flete, Servicio, etc.)
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditMode(false)}
                          className="px-4 py-1.5 text-xs font-medium rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={saveEditedCotizacion}
                          disabled={savingEdit || editItems.length === 0}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-xl text-white transition hover:opacity-90 disabled:opacity-50"
                          style={{ backgroundColor: '#0c1d3a' }}
                        >
                          {savingEdit ? (
                            <><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" /> Guardando...</>
                          ) : (
                            'Guardar Cambios'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Read-only Items Table */
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-3 py-2 text-gray-600 font-medium">Producto</th>
                          <th className="text-center px-3 py-2 text-gray-600 font-medium">Cant.</th>
                          <th className="text-right px-3 py-2 text-gray-600 font-medium">Precio</th>
                          {parseItems(selectedCot.items).some((i: any) => i.descuento > 0) && (
                            <th className="text-center px-3 py-2 text-gray-600 font-medium">Dto.</th>
                          )}
                          <th className="text-right px-3 py-2 text-gray-600 font-medium">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parseItems(selectedCot.items).map((item: any, idx: number) => {
                          const hasAnyDiscount = parseItems(selectedCot.items).some((i: any) => i.descuento > 0);
                          const sub = computeSubtotal(item);
                          return (
                            <tr key={idx} className="border-b border-gray-100">
                              <td className="px-3 py-2">
                                <div className="font-medium text-gray-900 flex items-center gap-1.5">
                                  {item.nombre}
                                  {item.tipo && item.tipo !== 'producto' && (
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                      item.tipo === 'flete' ? 'bg-blue-100 text-blue-700' :
                                      item.tipo === 'servicio' ? 'bg-purple-100 text-purple-700' :
                                      'bg-gray-100 text-gray-600'
                                    }`}>
                                      {TIPO_OPTIONS.find(o => o.value === item.tipo)?.label || item.tipo}
                                    </span>
                                  )}
                                </div>
                                {item.medida && <div className="text-xs text-gray-500">{item.medida}</div>}
                              </td>
                              <td className="px-3 py-2 text-center text-gray-600">{item.cantidad}</td>
                              <td className="px-3 py-2 text-right text-gray-600">{formatCLP(item.precio)}</td>
                              {hasAnyDiscount && (
                                <td className="px-3 py-2 text-center text-orange-600 font-medium">
                                  {item.descuento > 0 ? `${item.descuento}%` : '—'}
                                </td>
                              )}
                              <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatCLP(sub)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50">
                          <td colSpan={parseItems(selectedCot.items).some((i: any) => i.descuento > 0) ? 4 : 3} className="px-3 py-2 text-right font-semibold text-gray-900">Total</td>
                          <td className="px-3 py-2 text-right font-bold text-lg" style={{ color: '#e6b422' }}>{formatCLP(selectedCot.total)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Competitor Quote */}
              {selectedCot.cotizacion_competencia && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-purple-800 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Cotización de {selectedCot.nombre_competencia || 'Competencia'}
                  </h4>
                  <a
                    href={selectedCot.cotizacion_competencia}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-xl bg-purple-100 text-purple-700 hover:bg-purple-200 transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Ver archivo de competencia
                  </a>
                  {selectedCot.cotizacion_competencia.match(/\.(jpg|jpeg|png)$/i) && (
                    <div className="mt-3">
                      <img
                        src={selectedCot.cotizacion_competencia}
                        alt="Cotización competencia"
                        className="max-w-full max-h-48 rounded-xl border border-purple-200"
                      />
                    </div>
                  )}
                  {!showContraoferta && (selectedCot.estado === 'pendiente' || selectedCot.estado === 'enviada') && (
                    <button
                      onClick={() => openContraofertaForm(selectedCot)}
                      className="mt-3 px-4 py-2 text-sm font-semibold rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Crear Contraoferta
                    </button>
                  )}
                </div>
              )}

              {/* Counter-offer form */}
              {showContraoferta && selectedCot && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-4">
                  <h4 className="text-sm font-semibold text-green-800 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Crear Contraoferta
                  </h4>

                  {/* Editable items table */}
                  <div className="border border-green-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-green-100 border-b border-green-200">
                          <th className="text-left px-3 py-2 text-green-800 font-medium text-xs">Producto</th>
                          <th className="text-center px-2 py-2 text-green-800 font-medium text-xs">Cant.</th>
                          <th className="text-right px-2 py-2 text-red-600 font-medium text-xs">P. Original</th>
                          <th className="text-right px-3 py-2 text-green-700 font-medium text-xs">P. JURMAQ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contraofertaItems.map((item, idx) => (
                          <tr key={idx} className="border-b border-green-100 bg-white">
                            <td className="px-3 py-2 text-gray-900 text-xs">{item.nombre}</td>
                            <td className="px-2 py-2 text-center text-gray-600 text-xs">{item.cantidad}</td>
                            <td className="px-2 py-2 text-right text-red-500 text-xs line-through">{formatCLP(item.precioOriginal)}</td>
                            <td className="px-3 py-1">
                              <input
                                type="number"
                                value={item.precioContraoferta}
                                onChange={(e) => updateContraofertaPrice(idx, parseInt(e.target.value) || 0)}
                                className="w-full text-right text-sm font-semibold text-green-700 border border-green-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-500"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-green-100">
                          <td colSpan={3} className="px-3 py-2 text-right font-semibold text-gray-900 text-sm">Total Contraoferta</td>
                          <td className="px-3 py-2 text-right font-bold text-green-700 text-lg">{formatCLP(contraofertaTotal)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Savings preview */}
                  {(() => {
                    const totalOrig = contraofertaItems.reduce((s, i) => s + i.precioOriginal * i.cantidad, 0);
                    const ahorro = totalOrig - contraofertaTotal;
                    const pct = totalOrig > 0 ? Math.round((ahorro / totalOrig) * 100) : 0;
                    return (
                      <div className="bg-green-600 text-white rounded-xl p-3 text-center">
                        <p className="text-xs opacity-80">Ahorro para el cliente</p>
                        <p className="text-xl font-bold">{formatCLP(ahorro)} ({pct}%)</p>
                      </div>
                    );
                  })()}

                  {/* Message */}
                  <div>
                    <label className="block text-xs font-medium text-green-800 mb-1">Mensaje para el cliente</label>
                    <textarea
                      value={contraofertaMensaje}
                      onChange={(e) => setContraofertaMensaje(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-green-300 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-500 text-gray-900"
                      placeholder="Ej: Le mejoramos los precios de Sodimac en un 15%"
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => sendContraoferta(selectedCot)}
                      disabled={sendingContraoferta}
                      className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {sendingContraoferta ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      )}
                      Enviar Contraoferta
                    </button>
                    <button
                      onClick={() => setShowContraoferta(false)}
                      className="px-4 py-2.5 text-sm font-medium rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Existing counter-offer info (already sent) */}
              {selectedCot.estado === 'contraoferta' && selectedCot.contraoferta_items && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-purple-800 mb-2">Contraoferta Enviada</h4>
                  <p className="text-xs text-purple-600 mb-2">
                    Total contraoferta: <strong>{formatCLP(selectedCot.contraoferta_total || 0)}</strong>
                    {' | '}Ahorro: <strong>{formatCLP(selectedCot.total - (selectedCot.contraoferta_total || 0))}</strong>
                  </p>
                  {selectedCot.contraoferta_mensaje && (
                    <p className="text-sm text-purple-700 italic">&quot;{selectedCot.contraoferta_mensaje}&quot;</p>
                  )}
                </div>
              )}

              {/* Notes */}
              {selectedCot.notas && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Notas</h4>
                  <p className="text-gray-600 text-sm">{selectedCot.notas}</p>
                </div>
              )}

              {/* Action error */}
              {actionError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
                  {actionError}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-gray-200">
                {(selectedCot.estado === 'pendiente' || selectedCot.estado === 'enviada') && (
                  <>
                    <button
                      onClick={() => approveAndSendPayment(selectedCot, 'mercadopago')}
                      disabled={actionLoading === selectedCot.id}
                      className="px-4 py-2 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                    >
                      {actionLoading === selectedCot.id ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                      )}
                      Aprobar y Enviar Link MercadoPago
                    </button>
                    <button
                      onClick={() => approveAndSendPayment(selectedCot, 'efectivo')}
                      disabled={actionLoading === selectedCot.id}
                      className="px-4 py-2 text-sm font-semibold rounded-xl bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-2"
                    >
                      {actionLoading === selectedCot.id ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      )}
                      Aprobar y Enviar Datos Transferencia
                    </button>
                    <button
                      onClick={() => changeEstado(selectedCot, 'rechazada')}
                      className="px-4 py-2 text-sm font-semibold rounded-xl bg-red-50 text-red-700 hover:bg-red-100 transition"
                    >
                      Rechazar
                    </button>
                  </>
                )}

                {selectedCot.estado === 'aprobada' && (
                  <button
                    onClick={() => markAsPaid(selectedCot)}
                    disabled={actionLoading === selectedCot.id}
                    className="px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {actionLoading === selectedCot.id ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    Marcar como Pagado (Efectivo)
                  </button>
                )}

                <button
                  onClick={() => openMessageModal(selectedCot)}
                  className="px-4 py-2 text-sm font-semibold rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Enviar Mensaje
                </button>
                <a
                  href={`/api/cotizaciones/${selectedCot.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 text-sm font-semibold rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Ver PDF
                </a>

                {/* Estado selector for all states */}
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-gray-500">Estado:</span>
                  {['pendiente', 'enviada', 'contraoferta', 'aprobada', 'pagada', 'rechazada'].map((est) => {
                    const conf = estadoConfig[est];
                    const isCurrent = selectedCot.estado === est;
                    return (
                      <button
                        key={est}
                        onClick={() => changeEstado(selectedCot, est)}
                        disabled={isCurrent}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold transition ${
                          isCurrent
                            ? `${conf.bg} ${conf.text} ring-2 ring-offset-1 ring-current`
                            : `${conf.bg} ${conf.text} opacity-60 hover:opacity-100`
                        }`}
                      >
                        {conf.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
