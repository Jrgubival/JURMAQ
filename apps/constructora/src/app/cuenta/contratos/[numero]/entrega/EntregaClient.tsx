'use client';

import Link from 'next/link';
import KlapCheckoutEmbed from '@/components/cuenta/KlapCheckoutEmbed';

export default function EntregaClient({
  token,
  ya_autorizado,
  monto,
  contratoNumero,
  contratoDecodedNumero,
}: {
  token: string;
  ya_autorizado: boolean;
  monto: number;
  contratoNumero: string;
  contratoDecodedNumero: string;
}) {
  if (ya_autorizado) {
    const montoFmt = new Intl.NumberFormat('es-CL').format(monto);
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
        <h2 className="text-lg font-semibold text-green-900 mb-2">Tu garantía ya está autorizada</h2>
        <p className="text-sm text-green-800 mb-4">
          Hemos retenido ${montoFmt} en tu tarjeta para este contrato. No se requiere otra acción.
        </p>
        <Link
          href={`/cuenta/contratos/${encodeURIComponent(contratoDecodedNumero)}`}
          className="text-orange-600 hover:underline text-sm"
        >
          Ver detalles del contrato →
        </Link>
      </div>
    );
  }

  return (
    <KlapCheckoutEmbed
      token={token}
      monto={monto}
      contratoNumero={contratoNumero}
      onSuccess={() => {
        // Redirect al detail del contrato tras 3s.
        setTimeout(() => {
          window.location.href = `/cuenta/contratos/${encodeURIComponent(contratoDecodedNumero)}`;
        }, 3000);
      }}
    />
  );
}
