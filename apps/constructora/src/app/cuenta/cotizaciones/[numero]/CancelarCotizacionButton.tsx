"use client"

import { useState } from 'react';
import { useConfirmDialog } from '@jurmaq/shared/ui/useConfirmDialog';

export default function CancelarCotizacionButton({
  cotizacionId,
  estado,
  fechaServicio,
}: {
  cotizacionId: number;
  estado: string;
  fechaServicio: string | null;
}) {
  const { confirm, ConfirmDialogPortal } = useConfirmDialog();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ ok: boolean; msg: string } | null>(null);

  // Reglas de visibilidad cliente-side (la API valida igual).
  const puedeCancelar =
    ['enviada', 'aceptada'].includes(estado) &&
    fechaServicio &&
    new Date(fechaServicio).getTime() > Date.now() + 24 * 60 * 60 * 1000;

  if (!puedeCancelar) return null;
  if (done?.ok) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800">
        ✓ Cotización cancelada. {done.msg}
      </div>
    );
  }

  async function cancelar() {
    const ok = await confirm({
      title: '¿Cancelar esta cotización?',
      message: 'No se podrá deshacer. Si más adelante quieres arrendar igual, deberás cotizar de nuevo.',
      confirmLabel: 'Sí, cancelar',
      cancelLabel: 'No, mantener',
      variant: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/cuenta/cotizaciones/${cotizacionId}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: 'Cancelada por el cliente desde portal' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDone({ ok: false, msg: data.error || 'Error' });
      } else {
        setDone({ ok: true, msg: 'Te enviamos email de confirmación.' });
        setTimeout(() => window.location.reload(), 1200);
      }
    } catch (err) {
      setDone({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {done && !done.ok && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800 mb-2">
          {done.msg}
        </div>
      )}
      <button
        onClick={cancelar}
        disabled={busy}
        className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-sm rounded-xl disabled:opacity-50"
      >
        {busy ? 'Cancelando…' : 'Cancelar esta cotización'}
      </button>
      <ConfirmDialogPortal />
    </>
  );
}
