'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { formatCLP } from '@jurmaq/shared/format';
import { trackEvents } from '@/lib/analytics';

interface MaquinariaCatalog {
  id: number;
  nombre: string;
  tipo: string;
  imagen: string | null;
  tarifa_neta: number;
  unidad_tarifa: 'hora' | 'dia';
  minimo_unidades: number;
  requiere_traslado: boolean;
}

interface Desglose {
  unidades_aplicadas: number;
  km_total: number;
  precio_uso: number;
  traslado_combustible: number;
  traslado_carga: number;
  traslado_operario: number;
  peajes: number;
  subtotal_neto: number;
  iva: number;
  total: number;
}

const STEPS = ['Máquina', 'Servicio', 'Detalles', 'Confirmar'] as const;

export interface WizardPrefill {
  /** ID máquina pre-seleccionada (también acepta preselectId para back-compat) */
  maquinariaId?: number | null;
  ubicacion?: string;
  unidades?: number;
  km?: number;
  peajes?: number;
  operarios?: number;
  horasOp?: number;
  /** Datos del cliente (Fast checkout C4) */
  cliente?: { nombre?: string; email?: string; telefono?: string; rut?: string; empresa?: string };
}

export default function WizardClient({
  maquinarias,
  preselectId = null,
  prefill,
}: {
  maquinarias: MaquinariaCatalog[];
  preselectId?: number | null;
  prefill?: WizardPrefill;
}) {
  const effectivePreselect = prefill?.maquinariaId ?? preselectId;
  const initialPreselect = useMemo(
    () => (effectivePreselect ? maquinarias.find((m) => m.id === effectivePreselect) ?? null : null),
    [effectivePreselect, maquinarias],
  );
  const [step, setStep] = useState<number>(initialPreselect ? 1 : 0);
  const [selectedMaq, setSelectedMaq] = useState<MaquinariaCatalog | null>(initialPreselect);
  const [unidades, setUnidades] = useState<number>(prefill?.unidades ?? 0);
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');
  const [ubicacion, setUbicacion] = useState<string>(prefill?.ubicacion ?? '');
  const [km, setKm] = useState<number>(prefill?.km ?? 0);
  const [peajes, setPeajes] = useState<number>(prefill?.peajes ?? 0);
  const [operarios, setOperarios] = useState<number>(prefill?.operarios ?? 1);
  const [horasOp, setHorasOp] = useState<number>(prefill?.horasOp ?? 0);
  const [cliente, setCliente] = useState({
    nombre: prefill?.cliente?.nombre ?? '',
    email: prefill?.cliente?.email ?? '',
    telefono: prefill?.cliente?.telefono ?? '',
    rut: prefill?.cliente?.rut ?? '',
    empresa: prefill?.cliente?.empresa ?? '',
  });
  const [notas, setNotas] = useState<string>('');
  const [desglose, setDesglose] = useState<Desglose | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ numero: string; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedMaq && unidades < selectedMaq.minimo_unidades) {
      setUnidades(selectedMaq.minimo_unidades);
    }
  }, [selectedMaq]);

  useEffect(() => {
    if (step < 2 || !selectedMaq) {
      setDesglose(null);
      return;
    }
    const params = new URLSearchParams({
      maquinariaId: String(selectedMaq.id),
      unidades: String(unidades),
      km: String(km),
      peajes: String(peajes),
      operarios: String(operarios),
      horasOperario: String(horasOp),
    });
    setLoading(true);
    fetch(`/api/cotizar-arriendo?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.desglose) setDesglose(data.desglose);
        if (data.error) setError(data.error);
      })
      .finally(() => setLoading(false));
  }, [step, selectedMaq, unidades, km, peajes, operarios, horasOp]);

  // Note: previously animated step-3 summary with gsap.fromTo, but the package
  // isn't a constructora dep (lived in barraca only) so we drop the animation
  // rather than ship a runtime require failure. CSS transitions handle the
  // visual cue well enough; if we want polished motion again add gsap to
  // apps/constructora/package.json.

  // Tier 7 G2: wizard_start tracking (1 vez por mount, no por re-render).
  const startTrackedRef = useRef(false);
  useEffect(() => {
    if (startTrackedRef.current) return;
    startTrackedRef.current = true;
    trackEvents.arriendoWizardStart(
      effectivePreselect ?? null,
      prefill?.cliente?.email
        ? 'fast_checkout'
        : effectivePreselect
        ? 'preselect'
        : 'catalogo',
    );
  }, [effectivePreselect, prefill?.cliente?.email]);

  const canAdvance = useMemo(() => {
    if (step === 0) return !!selectedMaq;
    if (step === 1) return !!fechaInicio && !!ubicacion && unidades > 0;
    if (step === 2) return !!cliente.nombre && !!cliente.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cliente.email);
    return false;
  }, [step, selectedMaq, fechaInicio, ubicacion, unidades, cliente]);

  async function submit() {
    if (!selectedMaq) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/cotizar-arriendo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maquinariaId: selectedMaq.id,
          unidades_solicitadas: unidades,
          distancia_km: km,
          peajes,
          operarios,
          horas_operario_estimadas: horasOp,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin || fechaInicio,
          ubicacion_servicio: ubicacion,
          cliente_nombre: cliente.nombre,
          cliente_email: cliente.email,
          cliente_telefono: cliente.telefono || undefined,
          cliente_rut: cliente.rut || undefined,
          cliente_empresa: cliente.empresa || undefined,
          notas_cliente: notas || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al crear cotización');
      } else {
        setSuccess({ numero: data.numero, total: data.desglose.total });
        // Tier 7 G2: conversion event + generate_lead para Google Ads.
        trackEvents.arriendoCotizacionSubmitted({
          numero: data.numero,
          total: data.desglose.total,
          maquinariaId: selectedMaq.id,
          maquinariaNombre: selectedMaq.nombre,
          ubicacion,
          duracionUnidades: unidades,
          fechaInicio,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="bg-white rounded-[16px] hairline p-10 text-center">
        {/* Emoji ✅ reemplazado por CheckCircle SVG — emoji banned por design skills */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#EDF3EC] text-[#346538] mb-5">
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-navy-950 mb-2">¡Cotización enviada!</h2>
        <p className="text-gray-600 mb-4">
          Tu número de cotización: <strong className="text-navy-950">{success.numero}</strong>
        </p>
        <p className="text-gray-600 mb-6">
          Total con IVA: <strong className="text-orange-600">{formatCLP(success.total)}</strong>
        </p>
        <p className="text-sm text-gray-500 mb-6">
          Te enviamos el desglose a <strong>{cliente.email}</strong>. Revisa tu spam si no aparece en
          5 minutos.
        </p>
        <a
          href="/maquinarias"
          className="inline-block bg-navy-950 text-white px-6 py-3 rounded-lg font-semibold hover:bg-navy-800"
        >
          Volver al catálogo
        </a>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="bg-navy-950 text-white px-6 py-4">
        <div className="flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                  i <= step ? 'bg-orange-500' : 'bg-gray-600'
                }`}
              >
                {i + 1}
              </div>
              <span className={`text-sm ${i === step ? 'font-bold' : 'text-gray-300'}`}>{label}</span>
              {i < STEPS.length - 1 && <div className="flex-1 h-0.5 bg-gray-600" />}
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 md:p-8">
        {step === 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4 text-navy-950">Elige la máquina</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {maquinarias.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMaq(m)}
                  className={`text-left border rounded-lg p-4 hover:border-orange-500 transition-colors ${
                    selectedMaq?.id === m.id ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-navy-950">{m.nombre}</h3>
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">{m.tipo}</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Desde <strong>{formatCLP(m.tarifa_neta)}</strong> /{m.unidad_tarifa}
                    <span className="text-xs text-gray-500">
                      {' '}
                      (mínimo {m.minimo_unidades} {m.unidad_tarifa}
                      {m.minimo_unidades !== 1 ? 's' : ''})
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">+ IVA, traslado incluido si aplica</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && selectedMaq && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-4 text-navy-950">Detalles del servicio</h2>
            <div className="bg-blue-50 border border-blue-200 p-3 rounded text-sm">
              <strong>{selectedMaq.nombre}</strong> · {formatCLP(selectedMaq.tarifa_neta)}/{selectedMaq.unidad_tarifa} (mín {selectedMaq.minimo_unidades})
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold mb-1">Fecha inicio *</label>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Fecha fin</label>
                <input
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  min={fechaInicio || new Date().toISOString().split('T')[0]}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Ubicación del servicio *</label>
              <input
                type="text"
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
                placeholder="Ej: Av. España 123, Curicó"
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">
                ¿Cuántas {selectedMaq.unidad_tarifa}s? * (mínimo {selectedMaq.minimo_unidades})
              </label>
              <input
                type="number"
                value={unidades}
                onChange={(e) => setUnidades(Number(e.target.value))}
                min={selectedMaq.minimo_unidades}
                step={1}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            {selectedMaq.requiere_traslado && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">Distancia (km, una vía)</label>
                  <input
                    type="number"
                    value={km}
                    onChange={(e) => setKm(Number(e.target.value))}
                    min={0}
                    step={0.5}
                    className="w-full border rounded px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">Se calcula ida + vuelta</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Peajes (CLP)</label>
                  <input
                    type="number"
                    value={peajes}
                    onChange={(e) => setPeajes(Number(e.target.value))}
                    min={0}
                    step={500}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && selectedMaq && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold mb-4 text-navy-950">Tus datos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold mb-1">Nombre completo *</label>
                <input
                  type="text"
                  value={cliente.nombre}
                  onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Email *</label>
                <input
                  type="email"
                  value={cliente.email}
                  onChange={(e) => setCliente({ ...cliente, email: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Teléfono</label>
                <input
                  type="tel"
                  value={cliente.telefono}
                  onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })}
                  placeholder="+56 9 XXXX XXXX"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">RUT (para factura)</label>
                <input
                  type="text"
                  value={cliente.rut}
                  onChange={(e) => setCliente({ ...cliente, rut: e.target.value })}
                  placeholder="12.345.678-9"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-1">Empresa (opcional)</label>
                <input
                  type="text"
                  value={cliente.empresa}
                  onChange={(e) => setCliente({ ...cliente, empresa: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-1">Cantidad de operarios</label>
                <input
                  type="number"
                  value={operarios}
                  onChange={(e) => setOperarios(Math.max(1, Math.min(10, Number(e.target.value))))}
                  min={1}
                  max={10}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-1">Notas adicionales</label>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={3}
                  placeholder="Ej: necesito el operador con experiencia en zanjeo profundo"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && selectedMaq && desglose && (
          <div ref={summaryRef}>
            <h2 className="text-xl font-bold mb-4 text-navy-950">Confirma tu cotización</h2>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="font-bold text-navy-950">{selectedMaq.nombre}</p>
              <p className="text-sm text-gray-600">
                {fechaInicio}{fechaFin ? ` → ${fechaFin}` : ''} en {ubicacion} · {desglose.unidades_aplicadas} {selectedMaq.unidad_tarifa}
                {desglose.unidades_aplicadas !== 1 ? 's' : ''}
              </p>
            </div>

            <table className="w-full text-sm mb-6">
              <tbody>
                <tr>
                  <td className="py-2 border-b text-gray-600">Uso máquina ({desglose.unidades_aplicadas} {selectedMaq.unidad_tarifa})</td>
                  <td className="py-2 border-b text-right font-semibold">{formatCLP(desglose.precio_uso)}</td>
                </tr>
                {desglose.traslado_combustible > 0 && (
                  <tr>
                    <td className="py-2 border-b text-gray-600">Traslado ({desglose.km_total} km ida+vuelta)</td>
                    <td className="py-2 border-b text-right">{formatCLP(desglose.traslado_combustible)}</td>
                  </tr>
                )}
                {desglose.traslado_carga > 0 && (
                  <tr>
                    <td className="py-2 border-b text-gray-600">Carga y descarga</td>
                    <td className="py-2 border-b text-right">{formatCLP(desglose.traslado_carga)}</td>
                  </tr>
                )}
                {desglose.traslado_operario > 0 && (
                  <tr>
                    <td className="py-2 border-b text-gray-600">Operario ({horasOp}h × {operarios} pers.)</td>
                    <td className="py-2 border-b text-right">{formatCLP(desglose.traslado_operario)}</td>
                  </tr>
                )}
                {desglose.peajes > 0 && (
                  <tr>
                    <td className="py-2 border-b text-gray-600">Peajes</td>
                    <td className="py-2 border-b text-right">{formatCLP(desglose.peajes)}</td>
                  </tr>
                )}
                <tr>
                  <td className="py-2 border-b font-semibold">Subtotal neto</td>
                  <td className="py-2 border-b text-right font-semibold">{formatCLP(desglose.subtotal_neto)}</td>
                </tr>
                <tr>
                  <td className="py-2 border-b text-gray-600">IVA 19%</td>
                  <td className="py-2 border-b text-right">{formatCLP(desglose.iva)}</td>
                </tr>
                <tr>
                  <td className="py-3 font-bold text-lg">Total con IVA</td>
                  <td className="py-3 text-right font-bold text-lg text-orange-600">{formatCLP(desglose.total)}</td>
                </tr>
              </tbody>
            </table>

            <div className="bg-blue-50 border border-blue-200 p-3 rounded text-sm mb-4">
              Al confirmar te enviamos la cotización a <strong>{cliente.email}</strong>.
              No te cobramos nada todavía. Solo cuando aceptes y firmemos el contrato.
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded text-sm">
            {error}
          </div>
        )}

        <div className="mt-8 flex justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="px-5 py-2 border rounded font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Atrás
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={() => {
                // Tier 7 G2: track conversion funnel.
                trackEvents.arriendoWizardStepCompleted(
                  step,
                  STEPS[step],
                  selectedMaq?.id ?? null,
                );
                setStep(step + 1);
              }}
              disabled={!canAdvance}
              className="px-5 py-2 bg-orange-500 text-white rounded font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={submitting || !desglose}
              className="px-5 py-2 bg-orange-500 text-white rounded font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Enviando...' : 'Confirmar y enviar cotización'}
            </button>
          )}
        </div>

        {loading && step >= 2 && (
          <p className="text-xs text-gray-500 mt-2 text-center">Calculando…</p>
        )}
      </div>
    </div>
  );
}
