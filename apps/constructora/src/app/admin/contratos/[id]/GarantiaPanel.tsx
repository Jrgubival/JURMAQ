'use client';

import { useEffect, useState } from 'react';
import { formatCLP } from '@jurmaq/shared/format';
import { useConfirmDialog } from '@jurmaq/shared/ui/useConfirmDialog';

type Metodo = 'klap_hold' | 'cheque' | 'deposito_efectivo' | 'transferencia' | 'pagare';
type EstadoContrato = string;

interface HoldInfo {
  id: string;
  monto: number;
  estado: string;
  autorizado_at: string;
  expira_at: string;
  renovaciones_count: number;
  capturado_monto: number | null;
}

interface CardInfo {
  id: string;
  card_brand: string;
  card_last4: string;
  card_exp_month: number;
  card_exp_year: number;
  activa: boolean;
}

/**
 * Panel de garantía para el admin del contrato.
 *
 * Combina dos "tabs lógicos" en un solo panel:
 *   1. Configuración del método de garantía (klap_hold / cheque / etc).
 *   2. Operaciones según método elegido + estado del contrato:
 *      - Klap: registrar entrega → ver hold → inspeccionar devolución → cargar tardío
 *      - Tradicional: marcar recibida → marcar devuelta
 */
export default function GarantiaPanel({
  contratoId,
  estado,
  garantiaMetodo,
  garantiaMonto,
  arrendatarioTelefono,
  onChange,
}: {
  contratoId: number;
  estado: EstadoContrato;
  garantiaMetodo: Metodo | null;
  garantiaMonto: number | null;
  arrendatarioTelefono?: string | null;
  onChange?: () => void;
}) {
  const { confirm, ConfirmDialogPortal } = useConfirmDialog();
  const [metodo, setMetodo] = useState<Metodo>((garantiaMetodo as Metodo) || 'klap_hold');
  const [hold, setHold] = useState<HoldInfo | null>(null);
  const [card, setCard] = useState<CardInfo | null>(null);
  const [tradicional, setTradicional] = useState<{ recibido_at: string | null; devuelto_at: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);

  // Form devolución (cuando estado='en_devolucion')
  const [inspectMode, setInspectMode] = useState<'sin_danos' | 'con_danos' | null>(null);
  const [montoDano, setMontoDano] = useState(0);
  const [descDano, setDescDano] = useState('');

  // Form cargo tardío (cuando finalizado)
  const [cargoTardioForm, setCargoTardioForm] = useState<{ open: boolean; monto: number; motivo: string }>({
    open: false,
    monto: 0,
    motivo: '',
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        // Cargar estado de garantía (hold + card + tradicional) — endpoint admin/garantias
        // como no lo tenemos, hacemos calls a las tablas vía RPC genérica no expuesta.
        // Por ahora hardcoded: usamos el detalle del contrato + queries simples.
        // Para Fase A esto se ve mejor con un endpoint dedicado, lo dejamos como TODO.
        const res = await fetch(`/api/admin/garantias?contrato_id=${contratoId}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setHold(data.hold ?? null);
            setCard(data.card ?? null);
            setTradicional(data.tradicional ?? null);
          }
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [contratoId]);

  async function saveMetodo() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/contratos/${contratoId}/garantia/metodo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metodo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: 'err', text: data.error || 'Error' });
        return;
      }
      setMsg({ kind: 'ok', text: 'Método de garantía actualizado' });
      onChange?.();
    } finally {
      setBusy(false);
    }
  }

  async function iniciarEntrega() {
    const ok = await confirm({
      title: 'Iniciar entrega',
      message:
        metodo === 'klap_hold'
          ? 'Se enviará un email al cliente con el link para autorizar la garantía en su tarjeta.'
          : 'El contrato pasará a estado "en entrega". Asegúrate de haber recibido la garantía tradicional.',
      confirmLabel: 'Iniciar entrega',
    });
    if (!ok) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/contratos/${contratoId}/entrega/iniciar`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: 'err', text: data.error || 'Error' });
        return;
      }
      setMsg({ kind: 'ok', text: 'Entrega registrada. Cliente notificado.' });
      onChange?.();
    } finally {
      setBusy(false);
    }
  }

  async function iniciarDevolucion() {
    const ok = await confirm({
      title: '¿Marcar como en devolución?',
      message: 'El contrato pasa a estado "en_devolucion" para que puedas inspeccionar la máquina.',
      confirmLabel: 'Iniciar devolución',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/contratos/${contratoId}/devolucion/iniciar`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: 'err', text: data.error || 'Error' });
        return;
      }
      setMsg({ kind: 'ok', text: 'Contrato en devolución. Procede a inspeccionar.' });
      onChange?.();
    } finally {
      setBusy(false);
    }
  }

  async function inspeccionar(resultado: 'sin_danos' | 'con_danos') {
    if (resultado === 'con_danos') {
      if (montoDano <= 0 || !descDano.trim()) {
        setMsg({ kind: 'err', text: 'Ingresa monto y descripción del daño' });
        return;
      }
    }
    const ok = await confirm({
      title: resultado === 'sin_danos' ? 'Confirmar devolución sin daños' : 'Confirmar captura por daños',
      message:
        resultado === 'sin_danos'
          ? '¿Confirmas que la máquina fue devuelta sin daños? Se liberará el hold completo.'
          : `¿Confirmas que se debe capturar $${montoDano.toLocaleString('es-CL')} por daños? El resto del hold se libera automáticamente.`,
      variant: resultado === 'sin_danos' ? 'primary' : 'danger',
    });
    if (!ok) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/contratos/${contratoId}/devolucion/inspeccionar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          resultado === 'sin_danos'
            ? { resultado }
            : { resultado, monto_dano: montoDano, descripcion_dano: descDano },
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: 'err', text: data.error || 'Error' });
        return;
      }
      const msgText =
        resultado === 'sin_danos'
          ? 'Devolución registrada. Garantía liberada.'
          : `Capturado $${(data.captured ?? 0).toLocaleString('es-CL')}.${
              data.excedente > 0
                ? ` Quedan $${data.excedente.toLocaleString('es-CL')} pendientes (usa "cargo tardío").`
                : ''
            }`;
      setMsg({ kind: 'ok', text: msgText });
      setInspectMode(null);
      onChange?.();
    } finally {
      setBusy(false);
    }
  }

  async function aplicarCargoTardio() {
    if (cargoTardioForm.monto <= 0 || !cargoTardioForm.motivo.trim()) {
      setMsg({ kind: 'err', text: 'Ingresa monto y motivo' });
      return;
    }
    const ok = await confirm({
      title: 'Aplicar cargo tardío',
      message: `Se cobrará $${cargoTardioForm.monto.toLocaleString('es-CL')} a la tarjeta guardada del cliente. ¿Confirmas?`,
      variant: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/contratos/${contratoId}/cargo-tardio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monto: cargoTardioForm.monto, motivo: cargoTardioForm.motivo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: 'err', text: data.error || 'Error' });
        return;
      }
      setMsg({ kind: 'ok', text: `Cargo aplicado: $${cargoTardioForm.monto.toLocaleString('es-CL')}` });
      setCargoTardioForm({ open: false, monto: 0, motivo: '' });
      onChange?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
      <h2 className="text-base font-semibold text-gray-900">🔒 Garantía</h2>

      {msg && (
        <div
          className={`px-3 py-2 rounded-xl text-sm ${
            msg.kind === 'ok'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : msg.kind === 'info'
                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Selector de método */}
      {(estado === 'borrador' || estado === 'pendiente_firma' || estado === 'firmado') && (
        <div className="border-b border-gray-100 pb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Método de garantía</label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
            {(['klap_hold', 'cheque', 'deposito_efectivo', 'transferencia', 'pagare'] as Metodo[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetodo(m)}
                className={`px-3 py-2 text-xs font-medium rounded-xl border ${
                  metodo === m
                    ? 'bg-orange-600 text-white border-orange-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {m === 'klap_hold'
                  ? 'Klap (tarjeta)'
                  : m === 'deposito_efectivo'
                    ? 'Depósito'
                    : m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
          {metodo !== (garantiaMetodo || 'klap_hold') && (
            <button
              onClick={saveMetodo}
              disabled={busy}
              className="text-sm bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-xl disabled:opacity-50"
            >
              Guardar método
            </button>
          )}
          <div className="text-xs text-gray-500 mt-2">
            Monto de garantía: {formatCLP(garantiaMonto || 0)}
          </div>
        </div>
      )}

      {/* Acción según estado */}
      {loading ? (
        <div className="text-sm text-gray-400">Cargando estado de garantía…</div>
      ) : (
        <div className="space-y-3">
          {/* FIRMADO → INICIAR ENTREGA */}
          {estado === 'firmado' && (
            <div>
              <p className="text-sm text-gray-600 mb-2">
                El contrato está firmado. Inicia la entrega para{' '}
                {metodo === 'klap_hold'
                  ? 'enviar link al cliente para autorizar la garantía en su tarjeta.'
                  : `confirmar que recibiste la garantía (${metodo}).`}
              </p>
              <button
                onClick={iniciarEntrega}
                disabled={busy}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
              >
                Iniciar entrega →
              </button>
            </div>
          )}

          {/* EN_ENTREGA + Klap → mostrar status del cliente */}
          {estado === 'en_entrega' && metodo === 'klap_hold' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900">
              {hold
                ? '✓ Cliente autorizó la garantía. Contrato listo para pasar a "vigente" manualmente (o se actualiza al entregar la máquina).'
                : 'Esperando que el cliente autorice la garantía vía el link enviado por email.'}
            </div>
          )}

          {/* EN_ENTREGA + tradicional → confirmar recibida */}
          {estado === 'en_entrega' && metodo !== 'klap_hold' && (
            <TradicionalRecibir
              contratoId={contratoId}
              monto={garantiaMonto || 0}
              metodo={metodo}
              onDone={() => onChange?.()}
            />
          )}

          {/* HOLD ACTIVO + VIGENTE/EN_ENTREGA → mostrar info */}
          {hold && (estado === 'vigente' || estado === 'en_entrega' || estado === 'en_devolucion') && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm">
              <div className="font-semibold text-blue-900 mb-1">Garantía Klap activa</div>
              <div className="text-blue-800 text-xs space-y-0.5">
                <div>Monto: {formatCLP(hold.monto)}</div>
                <div>Estado: {hold.estado}</div>
                <div>Renovaciones: {hold.renovaciones_count}</div>
                <div>Vence: {new Date(hold.expira_at).toLocaleString('es-CL')}</div>
                {card && (
                  <div>
                    Tarjeta: {card.card_brand} •••• {card.card_last4}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIGENTE → iniciar devolución */}
          {estado === 'vigente' && (
            <button
              onClick={iniciarDevolucion}
              disabled={busy}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
            >
              Iniciar devolución →
            </button>
          )}

          {/* EN_DEVOLUCION → inspeccionar */}
          {estado === 'en_devolucion' && (
            <div className="border border-amber-300 rounded-xl p-3">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Inspección de devolución</h3>
              {!inspectMode && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setInspectMode('sin_danos')}
                    className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl"
                  >
                    ✓ Sin daños
                  </button>
                  <button
                    onClick={() => setInspectMode('con_danos')}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl"
                  >
                    ⚠ Con daños
                  </button>
                </div>
              )}
              {inspectMode === 'sin_danos' && (
                <div>
                  <p className="text-sm text-gray-700 mb-3">
                    Se liberará el hold completo de la tarjeta del cliente. El cliente verá el ajuste en
                    su próximo estado de cuenta (1-7 días).
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => inspeccionar('sin_danos')}
                      disabled={busy}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
                    >
                      Confirmar sin daños
                    </button>
                    <button
                      onClick={() => setInspectMode(null)}
                      className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-xl"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
              {inspectMode === 'con_danos' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Monto del daño (CLP)</label>
                    <input
                      type="number"
                      min={0}
                      value={montoDano}
                      onChange={(e) => setMontoDano(Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Si excede el hold ({formatCLP(hold?.monto || 0)}), se captura todo y debes registrar
                      el excedente como "cargo tardío".
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Descripción del daño</label>
                    <textarea
                      rows={3}
                      value={descDano}
                      onChange={(e) => setDescDano(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                      placeholder="Ej: Brazo hidráulico abollado, falta tapa de aceite..."
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => inspeccionar('con_danos')}
                      disabled={busy || montoDano <= 0}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
                    >
                      Capturar {formatCLP(montoDano)}
                    </button>
                    <button
                      onClick={() => setInspectMode(null)}
                      className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-xl"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* FINALIZADO[_CON_CARGO] + KLAP → cargo tardío */}
          {(estado === 'finalizado' || estado === 'finalizado_con_cargo') && metodo === 'klap_hold' && card && (
            <div className="border border-gray-200 rounded-xl p-3">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Cargo tardío (hasta 90d post devolución)</h3>
              {!cargoTardioForm.open ? (
                <button
                  onClick={() => setCargoTardioForm({ ...cargoTardioForm, open: true })}
                  className="text-sm text-orange-600 hover:underline"
                >
                  + Registrar cargo tardío
                </button>
              ) : (
                <div className="space-y-2">
                  <input
                    type="number"
                    min={0}
                    placeholder="Monto CLP"
                    value={cargoTardioForm.monto || ''}
                    onChange={(e) =>
                      setCargoTardioForm({ ...cargoTardioForm, monto: Number(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                  />
                  <textarea
                    rows={2}
                    placeholder="Motivo (qué daño descubriste)"
                    value={cargoTardioForm.motivo}
                    onChange={(e) => setCargoTardioForm({ ...cargoTardioForm, motivo: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={aplicarCargoTardio}
                      disabled={busy}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
                    >
                      Aplicar cargo
                    </button>
                    <button
                      onClick={() => setCargoTardioForm({ open: false, monto: 0, motivo: '' })}
                      className="px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-xl"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Garantía tradicional registrada — mostrar estado */}
          {tradicional && metodo !== 'klap_hold' && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm">
              <div className="text-gray-900 font-medium">Garantía tradicional ({metodo})</div>
              <div className="text-xs text-gray-600 mt-1">
                Recibida:{' '}
                {tradicional.recibido_at
                  ? new Date(tradicional.recibido_at).toLocaleString('es-CL')
                  : 'pendiente'}
                {tradicional.devuelto_at && (
                  <> · Devuelta: {new Date(tradicional.devuelto_at).toLocaleString('es-CL')}</>
                )}
              </div>
              {!tradicional.devuelto_at && (estado === 'finalizado' || estado === 'finalizado_con_cargo') && (
                <button
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const res = await fetch(
                        `/api/admin/contratos/${contratoId}/garantia/tradicional/devolver`,
                        { method: 'POST' },
                      );
                      const data = await res.json();
                      if (res.ok) {
                        setMsg({ kind: 'ok', text: 'Garantía marcada como devuelta' });
                        onChange?.();
                      } else {
                        setMsg({ kind: 'err', text: data.error || 'Error' });
                      }
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="mt-2 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-xl"
                >
                  Marcar como devuelta
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {arrendatarioTelefono && (
        <p className="text-xs text-gray-400">
          Email + WhatsApp del cliente: {arrendatarioTelefono}
        </p>
      )}
      <ConfirmDialogPortal />
    </section>
  );
}

function TradicionalRecibir({
  contratoId,
  monto,
  metodo,
  onDone,
}: {
  contratoId: number;
  monto: number;
  metodo: Metodo;
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    monto: monto || 0,
    cheque_banco: '',
    cheque_numero: '',
    cheque_fecha: '',
    transferencia_referencia: '',
    notas: '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/contratos/${contratoId}/garantia/tradicional/recibir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'Error');
        return;
      }
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-amber-300 rounded-xl p-3 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Confirmar garantía recibida ({metodo})</h3>
      {err && <div className="bg-red-50 text-red-800 px-3 py-2 rounded text-xs">{err}</div>}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Monto (CLP)</label>
        <input
          type="number"
          min={0}
          value={form.monto}
          onChange={(e) => setForm({ ...form, monto: Number(e.target.value) || 0 })}
          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
        />
      </div>
      {metodo === 'cheque' && (
        <div className="grid grid-cols-3 gap-2">
          <input
            type="text"
            placeholder="Banco"
            value={form.cheque_banco}
            onChange={(e) => setForm({ ...form, cheque_banco: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-xl text-sm"
          />
          <input
            type="text"
            placeholder="Nº cheque"
            value={form.cheque_numero}
            onChange={(e) => setForm({ ...form, cheque_numero: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-xl text-sm"
          />
          <input
            type="date"
            value={form.cheque_fecha}
            onChange={(e) => setForm({ ...form, cheque_fecha: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-xl text-sm"
          />
        </div>
      )}
      {metodo === 'transferencia' && (
        <input
          type="text"
          placeholder="Referencia transferencia"
          value={form.transferencia_referencia}
          onChange={(e) => setForm({ ...form, transferencia_referencia: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
        />
      )}
      <input
        type="text"
        placeholder="Notas (opc.)"
        value={form.notas}
        onChange={(e) => setForm({ ...form, notas: e.target.value })}
        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm"
      />
      <button
        onClick={save}
        disabled={busy || form.monto <= 0}
        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
      >
        Confirmar recepción
      </button>
    </div>
  );
}
