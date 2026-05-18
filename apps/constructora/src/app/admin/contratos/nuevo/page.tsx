'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatRut, validateRut } from '@/lib/rut';
import { formatCLP } from "@jurmaq/shared/format";

type Modalidad = 'dia' | 'semana' | 'mes';
type TipoArrendatario = 'natural' | 'juridica';

interface Maquinaria {
  id: number;
  nombre: string;
  tipo: string;
  imagen: string | null;
  precio_dia: number | null;
  precio_semana: number | null;
  precio_mes: number | null;
  garantia_monto: number | null;
  estado: string;
}

interface ArrendatarioForm {
  tipo: TipoArrendatario;
  // natural
  nombre: string;
  rut: string;
  domicilio: string;
  telefono: string;
  email: string;
  profesion: string;
  // juridica
  razon_social: string;
  rut_empresa: string;
  giro: string;
  domicilio_fiscal: string;
  rep_legal: string;
  rep_rut: string;
}

interface CondicionesForm {
  con_operador: boolean;
  operador_nombre: string;
  fecha_inicio: string;
  fecha_termino: string;
  modalidad: Modalidad;
  precio_unidad: number;
  total: number;
  total_manual: boolean;
  garantia_monto: number;
  direccion_entrega: string;
  direccion_retiro: string;
  misma_direccion: boolean;
  observaciones: string;
}

const stepNames = ['Maquinaria', 'Arrendatario', 'Condiciones', 'Preview'];

// Compute number of units between two ISO dates for a given modality.
function computeUnits(fechaInicio: string, fechaTermino: string, modalidad: Modalidad): number {
  if (!fechaInicio || !fechaTermino) return 0;
  const a = new Date(fechaInicio).getTime();
  const b = new Date(fechaTermino).getTime();
  if (isNaN(a) || isNaN(b) || b <= a) return 0;
  const days = Math.max(1, Math.round((b - a) / (24 * 60 * 60 * 1000)));
  if (modalidad === 'dia') return days;
  if (modalidad === 'semana') return Math.max(1, Math.ceil(days / 7));
  return Math.max(1, Math.ceil(days / 30));
}

function defaultPrice(maq: Maquinaria | null, modalidad: Modalidad): number {
  if (!maq) return 0;
  if (modalidad === 'dia') return maq.precio_dia ?? 0;
  if (modalidad === 'semana') return maq.precio_semana ?? (maq.precio_dia ? maq.precio_dia * 7 : 0);
  return maq.precio_mes ?? (maq.precio_dia ? maq.precio_dia * 30 : 0);
}

export default function NuevoContratoPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1 — Maquinaria
  const [maquinarias, setMaquinarias] = useState<Maquinaria[]>([]);
  const [loadingMaq, setLoadingMaq] = useState(true);
  const [maqError, setMaqError] = useState('');
  const [maqSearch, setMaqSearch] = useState('');
  const [selectedMaq, setSelectedMaq] = useState<Maquinaria | null>(null);

  // Step 2 — Arrendatario
  const [arrendatario, setArrendatario] = useState<ArrendatarioForm>({
    tipo: 'natural',
    nombre: '',
    rut: '',
    domicilio: '',
    telefono: '',
    email: '',
    profesion: '',
    razon_social: '',
    rut_empresa: '',
    giro: '',
    domicilio_fiscal: '',
    rep_legal: '',
    rep_rut: '',
  });
  const [step2Errors, setStep2Errors] = useState<Record<string, string>>({});

  // Step 3 — Condiciones
  const [condiciones, setCondiciones] = useState<CondicionesForm>({
    con_operador: false,
    operador_nombre: '',
    fecha_inicio: '',
    fecha_termino: '',
    modalidad: 'dia',
    precio_unidad: 0,
    total: 0,
    total_manual: false,
    garantia_monto: 0,
    direccion_entrega: '',
    direccion_retiro: '',
    misma_direccion: true,
    observaciones: '',
  });
  const [step3Errors, setStep3Errors] = useState<Record<string, string>>({});

  // Step 4 — Preview / creation state
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [sendingSignature, setSendingSignature] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  // Fetch maquinarias on mount
  useEffect(() => {
    (async () => {
      setLoadingMaq(true);
      setMaqError('');
      try {
        const res = await fetch('/api/maquinarias');
        if (!res.ok) throw new Error('No se pudieron cargar las maquinarias');
        const data = await res.json();
        const list: Maquinaria[] = Array.isArray(data) ? data : data.data || [];
        setMaquinarias(list);
      } catch (err: any) {
        setMaqError(err?.message || 'Error al cargar maquinarias');
      } finally {
        setLoadingMaq(false);
      }
    })();
  }, []);

  // When maquinaria or modalidad change, set default prices
  useEffect(() => {
    if (!selectedMaq) return;
    setCondiciones((c) => {
      if (c.total_manual && c.precio_unidad > 0) return c;
      const p = defaultPrice(selectedMaq, c.modalidad);
      const units = computeUnits(c.fecha_inicio, c.fecha_termino, c.modalidad);
      return {
        ...c,
        precio_unidad: p,
        total: p * units,
        garantia_monto: c.garantia_monto || (selectedMaq.garantia_monto || 0),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMaq, condiciones.modalidad]);

  // Recompute total when dates or precio_unidad change (unless the admin has
  // manually overridden the total).
  useEffect(() => {
    setCondiciones((c) => {
      if (c.total_manual) return c;
      const units = computeUnits(c.fecha_inicio, c.fecha_termino, c.modalidad);
      return { ...c, total: c.precio_unidad * units };
    });
  }, [condiciones.fecha_inicio, condiciones.fecha_termino, condiciones.precio_unidad, condiciones.modalidad]);

  const filteredMaq = useMemo(() => {
    const q = maqSearch.trim().toLowerCase();
    if (!q) return maquinarias;
    return maquinarias.filter(
      (m) =>
        m.nombre.toLowerCase().includes(q) ||
        (m.tipo || '').toLowerCase().includes(q)
    );
  }, [maquinarias, maqSearch]);

  function validateStep2(): boolean {
    const errors: Record<string, string> = {};
    if (arrendatario.tipo === 'natural') {
      if (!arrendatario.nombre.trim()) errors.nombre = 'Requerido';
      if (!arrendatario.rut.trim()) errors.rut = 'Requerido';
      else if (!validateRut(arrendatario.rut)) errors.rut = 'RUT invalido';
      if (!arrendatario.domicilio.trim()) errors.domicilio = 'Requerido';
      if (!arrendatario.telefono.trim()) errors.telefono = 'Requerido';
      if (!arrendatario.email.trim()) errors.email = 'Requerido';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(arrendatario.email)) errors.email = 'Email invalido';
    } else {
      if (!arrendatario.razon_social.trim()) errors.razon_social = 'Requerido';
      if (!arrendatario.rut_empresa.trim()) errors.rut_empresa = 'Requerido';
      else if (!validateRut(arrendatario.rut_empresa)) errors.rut_empresa = 'RUT invalido';
      if (!arrendatario.giro.trim()) errors.giro = 'Requerido';
      if (!arrendatario.domicilio_fiscal.trim()) errors.domicilio_fiscal = 'Requerido';
      if (!arrendatario.rep_legal.trim()) errors.rep_legal = 'Requerido';
      if (!arrendatario.rep_rut.trim()) errors.rep_rut = 'Requerido';
      else if (!validateRut(arrendatario.rep_rut)) errors.rep_rut = 'RUT invalido';
      if (!arrendatario.telefono.trim()) errors.telefono = 'Requerido';
      if (!arrendatario.email.trim()) errors.email = 'Requerido';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(arrendatario.email)) errors.email = 'Email invalido';
    }
    setStep2Errors(errors);
    return Object.keys(errors).length === 0;
  }

  function validateStep3(): boolean {
    const errors: Record<string, string> = {};
    if (!condiciones.fecha_inicio) errors.fecha_inicio = 'Requerido';
    if (!condiciones.fecha_termino) errors.fecha_termino = 'Requerido';
    if (
      condiciones.fecha_inicio &&
      condiciones.fecha_termino &&
      new Date(condiciones.fecha_termino) <= new Date(condiciones.fecha_inicio)
    ) {
      errors.fecha_termino = 'Debe ser posterior a la fecha de inicio';
    }
    if (!condiciones.precio_unidad || condiciones.precio_unidad <= 0)
      errors.precio_unidad = 'Requerido';
    if (condiciones.total <= 0) errors.total = 'Total debe ser mayor a 0';
    if (!condiciones.direccion_entrega.trim()) errors.direccion_entrega = 'Requerido';
    if (!condiciones.misma_direccion && !condiciones.direccion_retiro.trim())
      errors.direccion_retiro = 'Requerido';
    setStep3Errors(errors);
    return Object.keys(errors).length === 0;
  }

  function buildCreatePayload() {
    if (!selectedMaq) return null;
    const payload: any = {
      maquinaria_id: selectedMaq.id,
      arrendatario_tipo: arrendatario.tipo,
      fecha_inicio: condiciones.fecha_inicio,
      fecha_termino: condiciones.fecha_termino,
      precio_unidad: condiciones.modalidad,
      precio_por_unidad: condiciones.precio_unidad,
      precio_total: condiciones.total,
      garantia_monto: condiciones.garantia_monto,
      con_operador: condiciones.con_operador,
      operador_nombre: condiciones.con_operador ? condiciones.operador_nombre || '' : '',
      direccion_entrega: condiciones.direccion_entrega,
      direccion_retiro: condiciones.misma_direccion
        ? condiciones.direccion_entrega
        : condiciones.direccion_retiro,
      observaciones: condiciones.observaciones,
      estado: 'borrador',
    };
    if (arrendatario.tipo === 'natural') {
      payload.arrendatario_nombre = arrendatario.nombre;
      payload.arrendatario_rut = formatRut(arrendatario.rut);
      payload.arrendatario_domicilio = arrendatario.domicilio;
      payload.arrendatario_telefono = arrendatario.telefono;
      payload.arrendatario_email = arrendatario.email;
      payload.arrendatario_profesion = arrendatario.profesion || null;
    } else {
      payload.arrendatario_razon_social = arrendatario.razon_social;
      payload.arrendatario_rut = formatRut(arrendatario.rut_empresa);
      payload.arrendatario_giro = arrendatario.giro;
      payload.arrendatario_domicilio = arrendatario.domicilio_fiscal;
      payload.arrendatario_rep_legal = arrendatario.rep_legal;
      payload.arrendatario_rep_rut = formatRut(arrendatario.rep_rut);
      payload.arrendatario_telefono = arrendatario.telefono;
      payload.arrendatario_email = arrendatario.email;
      // Convenience: also expose `nombre` as the razon_social for UI parity
      payload.arrendatario_nombre = arrendatario.razon_social;
    }
    return payload;
  }

  async function handleAdvanceToPreview() {
    if (!validateStep3()) return;
    setCreateError('');
    setCreating(true);
    try {
      const payload = buildCreatePayload();
      if (!payload) throw new Error('Falta la maquinaria');
      const res = await fetch('/api/admin/contratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo crear el contrato');
      }
      const created = await res.json();
      const id = created?.id ?? created?.data?.id;
      if (!id) throw new Error('La API no retorno un id');
      setCreatedId(id);

      // Fetch rendered HTML
      const renderRes = await fetch(`/api/admin/contratos/${id}/render`);
      if (renderRes.ok) {
        const renderData = await renderRes.json();
        setPreviewHtml(renderData.html || '');
      }
      setStep(4);
    } catch (err: any) {
      setCreateError(err?.message || 'Error al crear el contrato');
    } finally {
      setCreating(false);
    }
  }

  async function saveDraftAndExit() {
    if (!createdId) return;
    setSavingDraft(true);
    setCreateError('');
    try {
      // Borrador already exists; just redirect.
      router.push(`/admin/contratos/${createdId}`);
    } finally {
      setSavingDraft(false);
    }
  }

  async function sendForSignature() {
    if (!createdId) return;
    setSendingSignature(true);
    setCreateError('');
    try {
      const res = await fetch(`/api/admin/contratos/${createdId}/send-signature`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo enviar para firma');
      }
      router.push(`/admin/contratos/${createdId}`);
    } catch (err: any) {
      setCreateError(err?.message || 'Error al enviar para firma');
    } finally {
      setSendingSignature(false);
    }
  }

  function canAdvanceFromStep(n: number): boolean {
    if (n === 1) return !!selectedMaq;
    if (n === 2) return true; // validated in handler
    if (n === 3) return true; // validated in handler
    return false;
  }

  function handleNext() {
    if (step === 1) {
      if (!selectedMaq) return;
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!validateStep2()) return;
      setStep(3);
      return;
    }
    if (step === 3) {
      handleAdvanceToPreview();
      return;
    }
  }

  function handleBack() {
    if (step > 1) setStep(step - 1);
  }

  const units = computeUnits(
    condiciones.fecha_inicio,
    condiciones.fecha_termino,
    condiciones.modalidad
  );

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/contratos"
          className="text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo Contrato</h1>
      </div>

      {/* Stepper */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 overflow-x-auto">
          {stepNames.map((name, idx) => {
            const n = idx + 1;
            const isActive = step === n;
            const isDone = step > n;
            return (
              <div key={name} className="flex items-center gap-2 shrink-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    isActive
                      ? 'text-white'
                      : isDone
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                  style={isActive ? { backgroundColor: '#0c1d3a' } : {}}
                >
                  {isDone ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    n
                  )}
                </div>
                <span
                  className={`text-sm ${
                    isActive ? 'font-semibold text-gray-900' : 'text-gray-500'
                  }`}
                >
                  {name}
                </span>
                {idx < stepNames.length - 1 && (
                  <svg
                    className="w-4 h-4 text-gray-300 mx-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 1: Maquinaria */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold text-gray-900">Seleccionar maquinaria</h2>
            <input
              type="text"
              value={maqSearch}
              onChange={(e) => setMaqSearch(e.target.value)}
              placeholder="Buscar..."
              className="px-3 py-2 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-gray-900"
            />
          </div>

          {maqError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
              {maqError}
            </div>
          )}

          {loadingMaq ? (
            <div className="flex items-center justify-center h-48">
              <div
                className="animate-spin rounded-full h-8 w-8 border-b-2"
                style={{ borderColor: '#e6b422' }}
              />
            </div>
          ) : filteredMaq.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              No hay maquinarias disponibles
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMaq.map((m) => {
                const isSelected = selectedMaq?.id === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMaq(m)}
                    className={`bg-white rounded-xl border-2 text-left overflow-hidden transition ${
                      isSelected
                        ? 'border-[#e6b422] shadow-md'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="h-36 bg-gray-100 flex items-center justify-center">
                      {m.imagen ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.imagen}
                          alt={m.nombre}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-gray-900 text-sm">{m.nombre}</div>
                          <div className="text-xs text-gray-500">{m.tipo}</div>
                        </div>
                        {isSelected && (
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                            style={{ backgroundColor: '#e6b422' }}
                          >
                            SELECCIONADA
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-sm font-bold" style={{ color: '#e6b422' }}>
                        {m.precio_dia ? formatCLP(m.precio_dia) : '—'}
                        <span className="text-xs text-gray-400 font-normal">/dia</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Arrendatario */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Datos del arrendatario</h2>

          <div className="flex gap-2">
            {(['natural', 'juridica'] as TipoArrendatario[]).map((t) => {
              const active = arrendatario.tipo === t;
              return (
                <button
                  key={t}
                  onClick={() => setArrendatario((a) => ({ ...a, tipo: t }))}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition border ${
                    active
                      ? 'text-white border-transparent'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                  style={active ? { backgroundColor: '#0c1d3a' } : {}}
                >
                  {t === 'natural' ? 'Persona natural' : 'Empresa'}
                </button>
              );
            })}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            {arrendatario.tipo === 'natural' ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Nombre completo" error={step2Errors.nombre} required>
                    <input
                      type="text"
                      value={arrendatario.nombre}
                      onChange={(e) =>
                        setArrendatario({ ...arrendatario, nombre: e.target.value })
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-sm text-gray-900"
                      placeholder="Nombre y apellido"
                    />
                  </Field>
                  <Field label="RUT" error={step2Errors.rut} required>
                    <input
                      type="text"
                      value={arrendatario.rut}
                      onChange={(e) =>
                        setArrendatario({ ...arrendatario, rut: e.target.value })
                      }
                      onBlur={(e) =>
                        setArrendatario({ ...arrendatario, rut: formatRut(e.target.value) })
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-sm text-gray-900"
                      placeholder="12.345.678-9"
                    />
                  </Field>
                </div>
                <Field label="Domicilio" error={step2Errors.domicilio} required>
                  <input
                    type="text"
                    value={arrendatario.domicilio}
                    onChange={(e) =>
                      setArrendatario({ ...arrendatario, domicilio: e.target.value })
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-sm text-gray-900"
                    placeholder="Calle, numero, comuna"
                  />
                </Field>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Telefono" error={step2Errors.telefono} required>
                    <input
                      type="tel"
                      value={arrendatario.telefono}
                      onChange={(e) =>
                        setArrendatario({ ...arrendatario, telefono: e.target.value })
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-sm text-gray-900"
                      placeholder="+56 9 ..."
                    />
                  </Field>
                  <Field label="Email" error={step2Errors.email} required>
                    <input
                      type="email"
                      value={arrendatario.email}
                      onChange={(e) =>
                        setArrendatario({ ...arrendatario, email: e.target.value })
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-sm text-gray-900"
                      placeholder="correo@ejemplo.cl"
                    />
                  </Field>
                </div>
                <Field label="Profesion u oficio (opcional)">
                  <input
                    type="text"
                    value={arrendatario.profesion}
                    onChange={(e) =>
                      setArrendatario({ ...arrendatario, profesion: e.target.value })
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-sm text-gray-900"
                    placeholder="(opcional)"
                  />
                </Field>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Razon social" error={step2Errors.razon_social} required>
                    <input
                      type="text"
                      value={arrendatario.razon_social}
                      onChange={(e) =>
                        setArrendatario({ ...arrendatario, razon_social: e.target.value })
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-sm text-gray-900"
                      placeholder="Nombre legal de la empresa"
                    />
                  </Field>
                  <Field label="RUT empresa" error={step2Errors.rut_empresa} required>
                    <input
                      type="text"
                      value={arrendatario.rut_empresa}
                      onChange={(e) =>
                        setArrendatario({ ...arrendatario, rut_empresa: e.target.value })
                      }
                      onBlur={(e) =>
                        setArrendatario({
                          ...arrendatario,
                          rut_empresa: formatRut(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-sm text-gray-900"
                      placeholder="76.123.456-7"
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Giro" error={step2Errors.giro} required>
                    <input
                      type="text"
                      value={arrendatario.giro}
                      onChange={(e) =>
                        setArrendatario({ ...arrendatario, giro: e.target.value })
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-sm text-gray-900"
                      placeholder="Giro de la empresa"
                    />
                  </Field>
                  <Field label="Domicilio fiscal" error={step2Errors.domicilio_fiscal} required>
                    <input
                      type="text"
                      value={arrendatario.domicilio_fiscal}
                      onChange={(e) =>
                        setArrendatario({ ...arrendatario, domicilio_fiscal: e.target.value })
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-sm text-gray-900"
                      placeholder="Calle, numero, comuna"
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Representante legal" error={step2Errors.rep_legal} required>
                    <input
                      type="text"
                      value={arrendatario.rep_legal}
                      onChange={(e) =>
                        setArrendatario({ ...arrendatario, rep_legal: e.target.value })
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-sm text-gray-900"
                      placeholder="Nombre del representante"
                    />
                  </Field>
                  <Field label="RUT representante" error={step2Errors.rep_rut} required>
                    <input
                      type="text"
                      value={arrendatario.rep_rut}
                      onChange={(e) =>
                        setArrendatario({ ...arrendatario, rep_rut: e.target.value })
                      }
                      onBlur={(e) =>
                        setArrendatario({
                          ...arrendatario,
                          rep_rut: formatRut(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-sm text-gray-900"
                      placeholder="12.345.678-9"
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Telefono" error={step2Errors.telefono} required>
                    <input
                      type="tel"
                      value={arrendatario.telefono}
                      onChange={(e) =>
                        setArrendatario({ ...arrendatario, telefono: e.target.value })
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-sm text-gray-900"
                      placeholder="+56 9 ..."
                    />
                  </Field>
                  <Field label="Email" error={step2Errors.email} required>
                    <input
                      type="email"
                      value={arrendatario.email}
                      onChange={(e) =>
                        setArrendatario({ ...arrendatario, email: e.target.value })
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-sm text-gray-900"
                      placeholder="correo@empresa.cl"
                    />
                  </Field>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Condiciones */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Condiciones del arriendo</h2>

          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            {/* Operador */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Con operador?
              </label>
              <div className="flex gap-2">
                {[
                  { v: true, label: 'Si' },
                  { v: false, label: 'No' },
                ].map(({ v, label }) => {
                  const active = condiciones.con_operador === v;
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() =>
                        setCondiciones({ ...condiciones, con_operador: v })
                      }
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition border ${
                        active
                          ? 'text-white border-transparent'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                      }`}
                      style={active ? { backgroundColor: '#0c1d3a' } : {}}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {condiciones.con_operador && (
                <div className="mt-3">
                  <Field label="Nombre del operador (opcional)">
                    <input
                      type="text"
                      value={condiciones.operador_nombre}
                      onChange={(e) =>
                        setCondiciones({ ...condiciones, operador_nombre: e.target.value })
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-sm text-gray-900"
                      placeholder="Se puede asignar mas tarde"
                    />
                  </Field>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Fecha inicio" error={step3Errors.fecha_inicio} required>
                <input
                  type="date"
                  value={condiciones.fecha_inicio}
                  onChange={(e) =>
                    setCondiciones({ ...condiciones, fecha_inicio: e.target.value })
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-sm text-gray-900"
                />
              </Field>
              <Field label="Fecha termino" error={step3Errors.fecha_termino} required>
                <input
                  type="date"
                  value={condiciones.fecha_termino}
                  min={condiciones.fecha_inicio || undefined}
                  onChange={(e) =>
                    setCondiciones({ ...condiciones, fecha_termino: e.target.value })
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-sm text-gray-900"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Modalidad" required>
                <select
                  value={condiciones.modalidad}
                  onChange={(e) => {
                    const modalidad = e.target.value as Modalidad;
                    const p = defaultPrice(selectedMaq, modalidad);
                    setCondiciones((c) => ({
                      ...c,
                      modalidad,
                      precio_unidad: p,
                      total_manual: false,
                    }));
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-sm text-gray-900"
                >
                  <option value="dia">Por dia</option>
                  <option value="semana">Por semana</option>
                  <option value="mes">Por mes</option>
                </select>
              </Field>
              <Field
                label={`Precio por ${condiciones.modalidad}`}
                error={step3Errors.precio_unidad}
                required
              >
                <input
                  type="number"
                  min={0}
                  value={condiciones.precio_unidad}
                  onChange={(e) =>
                    setCondiciones({
                      ...condiciones,
                      precio_unidad: Number(e.target.value) || 0,
                      total_manual: false,
                    })
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-sm text-gray-900"
                />
              </Field>
              <Field label={`Total (${units} ${condiciones.modalidad}${units === 1 ? '' : 's'})`} error={step3Errors.total}>
                <input
                  type="number"
                  min={0}
                  value={condiciones.total}
                  onChange={(e) =>
                    setCondiciones({
                      ...condiciones,
                      total: Number(e.target.value) || 0,
                      total_manual: true,
                    })
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-sm text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Auto:{' '}
                  {formatCLP(condiciones.precio_unidad * units)} ·{' '}
                  <button
                    type="button"
                    onClick={() =>
                      setCondiciones((c) => ({
                        ...c,
                        total: c.precio_unidad * units,
                        total_manual: false,
                      }))
                    }
                    className="underline hover:text-gray-700"
                  >
                    recalcular
                  </button>
                </p>
              </Field>
            </div>

            <Field label="Monto garantia (CLP)">
              <input
                type="number"
                min={0}
                value={condiciones.garantia_monto}
                onChange={(e) =>
                  setCondiciones({
                    ...condiciones,
                    garantia_monto: Number(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-sm text-gray-900"
              />
              <p className="text-xs text-gray-500 mt-1">
                Valor por defecto de la maquinaria: {formatCLP(selectedMaq?.garantia_monto || 0)}
              </p>
            </Field>

            <Field label="Direccion de entrega" error={step3Errors.direccion_entrega} required>
              <input
                type="text"
                value={condiciones.direccion_entrega}
                onChange={(e) =>
                  setCondiciones({ ...condiciones, direccion_entrega: e.target.value })
                }
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-sm text-gray-900"
                placeholder="Calle, numero, comuna"
              />
            </Field>

            <div>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={condiciones.misma_direccion}
                  onChange={(e) =>
                    setCondiciones({ ...condiciones, misma_direccion: e.target.checked })
                  }
                />
                La direccion de retiro es la misma que la de entrega
              </label>
            </div>

            {!condiciones.misma_direccion && (
              <Field label="Direccion de retiro" error={step3Errors.direccion_retiro} required>
                <input
                  type="text"
                  value={condiciones.direccion_retiro}
                  onChange={(e) =>
                    setCondiciones({ ...condiciones, direccion_retiro: e.target.value })
                  }
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-sm text-gray-900"
                  placeholder="Calle, numero, comuna"
                />
              </Field>
            )}

            <Field label="Observaciones (opcional)">
              <textarea
                value={condiciones.observaciones}
                onChange={(e) =>
                  setCondiciones({ ...condiciones, observaciones: e.target.value })
                }
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[#e6b422] focus:border-transparent outline-none text-sm text-gray-900 resize-none"
                placeholder="Notas adicionales que aparecen en el contrato"
              />
            </Field>
          </div>

          {createError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
              {createError}
            </div>
          )}
        </div>
      )}

      {/* Step 4: Preview */}
      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Vista previa del contrato</h2>

          {createError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
              {createError}
            </div>
          )}

          {creating ? (
            <div className="flex items-center justify-center h-48 bg-white rounded-xl border border-gray-200">
              <div
                className="animate-spin rounded-full h-8 w-8 border-b-2"
                style={{ borderColor: '#e6b422' }}
              />
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {previewHtml ? (
                <iframe
                  srcDoc={previewHtml}
                  title="Preview contrato"
                  className="w-full"
                  style={{ height: '70vh', border: 0 }}
                />
              ) : (
                <div className="p-8 text-center text-gray-400">
                  No se pudo cargar la vista previa.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer navigation */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3 sticky bottom-4">
        <button
          onClick={handleBack}
          disabled={step === 1 || creating}
          className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Atras
        </button>

        <div className="flex gap-2">
          {step < 4 ? (
            <button
              onClick={handleNext}
              disabled={(step === 1 && !canAdvanceFromStep(1)) || creating}
              className="px-4 py-2 text-sm font-semibold rounded-xl text-white hover:opacity-90 disabled:opacity-50 transition inline-flex items-center gap-2"
              style={{ backgroundColor: '#0c1d3a' }}
            >
              {creating && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {step === 3 ? 'Crear y previsualizar' : 'Siguiente'}
            </button>
          ) : (
            <>
              <button
                onClick={saveDraftAndExit}
                disabled={savingDraft || sendingSignature}
                className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
              >
                Guardar como borrador
              </button>
              <button
                onClick={sendForSignature}
                disabled={sendingSignature || savingDraft || !createdId}
                className="px-4 py-2 text-sm font-semibold rounded-xl text-white hover:opacity-90 disabled:opacity-50 transition inline-flex items-center gap-2"
                style={{ backgroundColor: '#ea580c' }}
              >
                {sendingSignature && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                Crear y enviar para firma
              </button>
            </>
          )}
        </div>
      </div>

    </div>
  );
}

function Field({
  label,
  children,
  error,
  required,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
