'use client';

import { useState } from 'react';

/**
 * KlapCheckoutEmbed — UI para que el cliente autorice la garantía.
 *
 * Fase A (actual): UI mock con selección de brand. Genera token sintético
 * vía /api/public/contratos/entrega/[token]/preauth con body `{ brand }`.
 *
 * Fase B (cuando llegue cuenta Klap): reemplazar este componente por el
 * iframe oficial de Klap Checkout Transparente. El cliente ingresa PAN/CVV
 * dentro del iframe (NO en JURMAQ), Klap devuelve un network_token, el
 * componente lo postea al mismo endpoint.
 */

export default function KlapCheckoutEmbed({
  token,
  monto,
  onSuccess,
  contratoNumero,
}: {
  token: string;
  monto: number;
  onSuccess?: (data: { hold_id: string; last4: string; brand: string }) => void;
  contratoNumero?: string;
}) {
  const [brand, setBrand] = useState<'VISA' | 'MASTERCARD' | 'AMEX'>('VISA');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ hold_id: string; last4: string; brand: string } | null>(null);

  const isProdMode = process.env.NEXT_PUBLIC_KLAP_MODE === 'production';
  const montoFmt = new Intl.NumberFormat('es-CL').format(monto);

  async function autorizar() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/contratos/entrega/${encodeURIComponent(token)}/preauth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Error ${res.status}`);
        return;
      }
      const success = { hold_id: data.hold_id, last4: data.last4, brand: data.brand };
      setDone(success);
      if (onSuccess) onSuccess(success);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-green-900 mb-2">✓ Garantía pre-autorizada</h3>
        <p className="text-sm text-green-800 mb-3">
          Hemos retenido <strong>${montoFmt}</strong> en tu tarjeta {done.brand} •••• {done.last4}.
        </p>
        <p className="text-sm text-green-800">
          <strong>Importante</strong>: el monto NO ha sido cobrado. Se libera automáticamente cuando
          devuelvas la máquina sin daños.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-1">Autoriza la garantía</h3>
      <p className="text-sm text-gray-600 mb-1">
        Contrato {contratoNumero ? <strong>{contratoNumero}</strong> : 'de arriendo'} — monto a retener:{' '}
        <strong>${montoFmt}</strong>
      </p>
      <p className="text-xs text-gray-500 mb-5">
        Este monto se <strong>retiene</strong>, no se cobra. Se libera automáticamente al devolver la
        máquina sin daños. Si hay daños, sólo se cobra el monto del daño y se libera el resto.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-sm mb-4">
          {error}
        </div>
      )}

      {!isProdMode && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 text-xs mb-4">
          <strong>Modo demostración:</strong> Klap está en sandbox. La autorización es simulada — no se
          toca tu tarjeta real. Cuando JURMAQ active el sistema en producción esto se reemplaza por
          un formulario seguro de Klap (PCI-compliant).
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de tarjeta (simulación)</label>
        <div className="flex gap-2">
          {(['VISA', 'MASTERCARD', 'AMEX'] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBrand(b)}
              className={`flex-1 py-2 text-sm font-semibold rounded-xl border ${
                brand === b
                  ? 'bg-orange-600 text-white border-orange-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        Al autorizar aceptas que JURMAQ retenga el monto indicado y, en caso de daños, capture el
        monto correspondiente o realice cargos por daños descubiertos dentro de los 90 días
        posteriores a la devolución. Más info en{' '}
        <a href="/privacidad" className="text-orange-600 underline">
          nuestra política de privacidad
        </a>
        .
      </p>

      <button
        onClick={autorizar}
        disabled={loading}
        className="w-full py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl"
      >
        {loading ? 'Procesando…' : `Autorizar $${montoFmt}`}
      </button>
    </div>
  );
}
