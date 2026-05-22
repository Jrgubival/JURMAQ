'use client';

import { useEffect, useState } from 'react';

/**
 * Modal de envío de email manual desde admin arriendo.
 *
 * Flow:
 *   1) Lista los 8 kinds disponibles con su descripción
 *   2) Al elegir kind, llena defaults desde props y muestra preview live
 *   3) Admin puede agregar customMessage destacado
 *   4) "Enviar" llama POST /api/admin/email-manual y cierra
 *
 * Después del envío, registra en admin_emails_log con (kind, to, sent_by,
 * cotizacion_arriendo_id) para tracking + evitar reenvíos espurios.
 *
 * Uso:
 *   <SendManualEmailModal
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     defaultTo="cliente@ejemplo.cl"
 *     defaultVars={{ nombre, numero_cotizacion, maquinaria, fecha, ubicacion }}
 *     cotizacionArriendoId={cot.id}
 *     onSent={() => mostrarToast()}
 *   />
 */

interface KindMeta {
  kind: string;
  label: string;
  description: string;
  requires: string[];
  optional: string[];
  customMessageRequired: boolean;
}

// Sync manual con ADMIN_MANUAL_EMAIL_KINDS del shared. Hardcode acá para
// evitar bundling de templates server-only en el cliente.
const KINDS: KindMeta[] = [
  {
    kind: 'follow_up',
    label: '📞 Intentamos contactarte',
    description: 'Cliente no contesta. Pide detalles del proyecto para terminar la cotización.',
    requires: ['nombre'],
    optional: ['numero_cotizacion'],
    customMessageRequired: false,
  },
  {
    kind: 'need_info',
    label: 'ℹ️ Necesitamos más info',
    description: 'Pide fecha exacta, dirección, acceso, operador, combustible.',
    requires: ['nombre'],
    optional: ['numero_cotizacion', 'maquinaria'],
    customMessageRequired: false,
  },
  {
    kind: 'quote_reminder',
    label: '🔄 Recordatorio cotización',
    description: 'Cliente recibió cotización y no respondió. Sigue vigente.',
    requires: ['nombre', 'numero_cotizacion'],
    optional: ['maquinaria'],
    customMessageRequired: false,
  },
  {
    kind: 'reservation_pending',
    label: '💰 Falta reservar',
    description: 'Cliente aceptó pero no pagó el 30% inicial. La máquina no está bloqueada aún.',
    requires: ['nombre'],
    optional: ['numero_cotizacion', 'maquinaria', 'monto_reserva'],
    customMessageRequired: false,
  },
  {
    kind: 'delivery_schedule',
    label: '🚚 Coordinar entrega',
    description: 'Pide fecha, hora, contacto en sitio, acceso para camión.',
    requires: ['nombre'],
    optional: ['numero_cotizacion', 'maquinaria', 'fecha', 'ubicacion'],
    customMessageRequired: false,
  },
  {
    kind: 'return_schedule',
    label: '↩️ Coordinar retiro',
    description: 'Fin del arriendo. Definir día, estado de la máquina, oportunidad renovar.',
    requires: ['nombre'],
    optional: ['numero_cotizacion', 'maquinaria', 'fecha'],
    customMessageRequired: false,
  },
  {
    kind: 'thank_you',
    label: '🙏 Agradecimiento post-arriendo',
    description: 'Cliente terminó el arriendo. Pedir feedback + retención.',
    requires: ['nombre'],
    optional: ['numero_cotizacion', 'maquinaria'],
    customMessageRequired: false,
  },
  {
    kind: 'custom',
    label: '✏️ Mensaje personalizado',
    description: 'Texto libre dentro del wrapper visual JURMAQ. Solo escribe el mensaje.',
    requires: ['nombre'],
    optional: ['numero_cotizacion'],
    customMessageRequired: true,
  },
];

interface ManualEmailVars {
  nombre: string;
  numero_cotizacion?: string;
  maquinaria?: string;
  fecha?: string;
  ubicacion?: string;
  monto_reserva?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  defaultTo: string;
  defaultVars: ManualEmailVars;
  cotizacionArriendoId?: number;
  solicitudId?: number;
  contratoId?: number;
  onSent?: (asunto: string) => void;
}

export default function SendManualEmailModal({
  open,
  onClose,
  defaultTo,
  defaultVars,
  cotizacionArriendoId,
  solicitudId,
  contratoId,
  onSent,
}: Props) {
  const [step, setStep] = useState<'select' | 'compose'>('select');
  const [kind, setKind] = useState<KindMeta | null>(null);
  const [to, setTo] = useState(defaultTo);
  const [vars, setVars] = useState<ManualEmailVars>(defaultVars);
  const [customMessage, setCustomMessage] = useState('');
  const [preview, setPreview] = useState<{ asunto: string; html: string } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset al abrir.
  useEffect(() => {
    if (open) {
      setStep('select');
      setKind(null);
      setTo(defaultTo);
      setVars(defaultVars);
      setCustomMessage('');
      setPreview(null);
      setError(null);
    }
  }, [open, defaultTo, defaultVars]);

  // Refresca preview cuando cambia algo material.
  useEffect(() => {
    if (step !== 'compose' || !kind) return;
    const t = setTimeout(() => void loadPreview(), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, kind, vars, customMessage, to]);

  async function loadPreview() {
    if (!kind) return;
    setLoadingPreview(true);
    try {
      const res = await fetch('/api/admin/email-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          kind: kind.kind,
          vars,
          customMessage: customMessage || undefined,
          preview: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.preview) setPreview(data.preview);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function send() {
    if (!kind) return;
    if (kind.customMessageRequired && !customMessage.trim()) {
      setError('Este tipo requiere un mensaje personalizado');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/email-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          kind: kind.kind,
          vars,
          customMessage: customMessage || undefined,
          cotizacion_arriendo_id: cotizacionArriendoId,
          solicitud_id: solicitudId,
          contrato_id: contratoId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al enviar');
        return;
      }
      onSent?.(data.asunto);
      onClose();
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  const showField = (k: keyof ManualEmailVars) => {
    if (!kind) return false;
    return kind.requires.includes(k) || kind.optional.includes(k);
  };
  const isRequired = (k: keyof ManualEmailVars) => kind?.requires.includes(k) ?? false;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {step === 'select' ? 'Enviar email al cliente' : `Email: ${kind?.label}`}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Para: <span className="font-mono">{to}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {step === 'select' && (
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {KINDS.map((k) => (
                <button
                  key={k.kind}
                  onClick={() => {
                    setKind(k);
                    setStep('compose');
                  }}
                  className="text-left p-4 border border-gray-200 rounded-xl hover:border-orange-400 hover:bg-orange-50 transition"
                >
                  <p className="font-semibold text-gray-900 text-sm">{k.label}</p>
                  <p className="text-xs text-gray-500 mt-1">{k.description}</p>
                </button>
              ))}
            </div>
          )}

          {step === 'compose' && kind && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
              {/* Form izquierda */}
              <div className="p-6 border-r border-gray-200 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Email destinatario
                  </label>
                  <input
                    type="email"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Nombre del cliente <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={vars.nombre}
                    onChange={(e) => setVars({ ...vars, nombre: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                {showField('numero_cotizacion') && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      N° cotización {isRequired('numero_cotizacion') && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="text"
                      value={vars.numero_cotizacion || ''}
                      onChange={(e) => setVars({ ...vars, numero_cotizacion: e.target.value })}
                      placeholder="COT-20260520-0001"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                    />
                  </div>
                )}

                {showField('maquinaria') && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Máquina
                    </label>
                    <input
                      type="text"
                      value={vars.maquinaria || ''}
                      onChange={(e) => setVars({ ...vars, maquinaria: e.target.value })}
                      placeholder="Retroexcavadora CAT 420F"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                )}

                {showField('fecha') && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Fecha</label>
                    <input
                      type="text"
                      value={vars.fecha || ''}
                      onChange={(e) => setVars({ ...vars, fecha: e.target.value })}
                      placeholder="dd-mm-aaaa"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                )}

                {showField('ubicacion') && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Ubicación</label>
                    <input
                      type="text"
                      value={vars.ubicacion || ''}
                      onChange={(e) => setVars({ ...vars, ubicacion: e.target.value })}
                      placeholder="Comuna / dirección"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                )}

                {showField('monto_reserva') && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Monto reserva (CLP)
                    </label>
                    <input
                      type="number"
                      value={vars.monto_reserva || ''}
                      onChange={(e) =>
                        setVars({ ...vars, monto_reserva: Number(e.target.value) || undefined })
                      }
                      placeholder="100000"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Mensaje personalizado {kind.customMessageRequired && <span className="text-red-500">*</span>}
                  </label>
                  <textarea
                    rows={kind.kind === 'custom' ? 8 : 3}
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder={
                      kind.kind === 'custom'
                        ? 'Escribe tu mensaje completo aquí. Se mostrará destacado en el email.'
                        : 'Texto adicional opcional. Se inserta destacado en naranja.'
                    }
                    maxLength={2000}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">{customMessage.length} / 2000</p>
                </div>

                {error && (
                  <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {error}
                  </div>
                )}
              </div>

              {/* Preview derecha */}
              <div className="bg-gray-50 p-4 overflow-y-auto max-h-[60vh] md:max-h-none">
                <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">
                  Preview {loadingPreview && '· Actualizando…'}
                </p>
                {preview ? (
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-gray-100 border-b border-gray-200">
                      <p className="text-xs text-gray-500">Asunto:</p>
                      <p className="text-sm font-semibold text-gray-900">{preview.asunto}</p>
                    </div>
                    <iframe
                      srcDoc={preview.html}
                      className="w-full h-[400px] bg-white"
                      sandbox=""
                      title="Email preview"
                    />
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-12">
                    El preview aparecerá acá cuando completes los datos.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          {step === 'compose' ? (
            <button
              onClick={() => setStep('select')}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              ← Elegir otro tipo
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancelar
            </button>
            {step === 'compose' && (
              <button
                onClick={send}
                disabled={sending || !to || !vars.nombre}
                className="px-5 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg"
              >
                {sending ? 'Enviando…' : '📧 Enviar email'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
