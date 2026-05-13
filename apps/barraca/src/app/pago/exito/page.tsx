"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

type EstadoServer = 'cargando' | 'pagada' | 'pendiente' | 'no_confirmada' | 'error';

function ExitoContent() {
  const searchParams = useSearchParams();
  const externalReference = searchParams.get("external_reference");
  const paymentId = searchParams.get("payment_id");

  // Audit M2: NO confiar en query string de MercadoPago. Consultamos el server
  // para ver el estado REAL de la cotizacion (solo el webhook firmado lo cambia).
  const [estado, setEstado] = useState<EstadoServer>('cargando');
  // Ref evita stale closure: el while loop captura el setter y necesitamos
  // saber si vimos algun estado intermedio para no pisarlo con no_confirmada.
  const lastSeenRef = useRef<EstadoServer>('cargando');

  useEffect(() => {
    if (!externalReference) {
      setEstado('error');
      return;
    }
    let cancelled = false;
    const maxAttempts = 12; // ~60s con polling cada 5s
    async function poll() {
      for (let attempts = 0; attempts < maxAttempts && !cancelled; attempts++) {
        try {
          const res = await fetch(
            `/api/cotizaciones/by-numero/${encodeURIComponent(externalReference!)}`
          );
          if (res.ok) {
            const data = await res.json();
            const e = String(data?.estado || '');
            if (cancelled) return;
            if (e === 'pagada') {
              lastSeenRef.current = 'pagada';
              setEstado('pagada');
              // Conversion GA4 — sólo se envía una vez por transaction_id
              // (dedup en analytics.ts vía sessionStorage). Se llama acá
              // y no en el webhook porque GA4 mide client-side.
              try {
                const { trackEvents } = await import('@/lib/analytics');
                const total = Number(data?.total ?? 0);
                const rawItems = Array.isArray(data?.items)
                  ? data.items
                  : typeof data?.items === 'string'
                    ? JSON.parse(data.items || '[]')
                    : [];
                const items = (rawItems as Array<{ nombre?: string; precio?: number; cantidad?: number; id?: number | string }>).map((it) => ({
                  id: it.id ?? it.nombre ?? '',
                  nombre: String(it.nombre ?? ''),
                  precio: Number(it.precio ?? 0),
                  cantidad: Number(it.cantidad ?? 1),
                }));
                trackEvents.purchase(externalReference!, total, items);
              } catch { /* analytics no debe romper UX */ }
              return;
            }
            if (e === 'pago_pendiente' || e === 'pendiente') {
              lastSeenRef.current = 'pendiente';
              setEstado('pendiente');
            } else if (e === 'pago_rechazado' || e === 'cancelada') {
              lastSeenRef.current = 'error';
              setEstado('error');
              return;
            }
          }
        } catch { /* ignore */ }
        if (attempts < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
      // Solo bajamos a no_confirmada si nunca vimos pendiente — si ya estaba
      // pendiente, ese estado es mas informativo y lo respetamos.
      if (!cancelled && lastSeenRef.current !== 'pendiente') {
        setEstado('no_confirmada');
      }
    }
    poll();
    return () => { cancelled = true; };
  }, [externalReference]);

  const titulo = estado === 'pagada'
    ? 'Pago Confirmado'
    : estado === 'cargando' || estado === 'pendiente'
      ? 'Procesando tu pago'
      : estado === 'no_confirmada'
        ? 'Pago aun sin confirmar'
        : 'Pago Recibido';

  const detalle = estado === 'pagada'
    ? 'Tu pago fue confirmado por MercadoPago. Nos comunicaremos contigo para coordinar la entrega.'
    : estado === 'pendiente' || estado === 'cargando'
      ? 'Estamos esperando la confirmacion de MercadoPago. Esto puede tardar unos minutos. No cierres esta pagina; te enviaremos un email apenas se confirme.'
      : estado === 'no_confirmada'
        ? 'Aun no hemos recibido la confirmacion del pago desde MercadoPago. Si pagaste correctamente, recibiras un email apenas se procese. No es necesario que pagues de nuevo.'
        : 'Hubo un problema al confirmar el estado del pago. Te enviaremos un email apenas se aclare.';

  const colorBadge = estado === 'pagada'
    ? 'bg-green-100 text-green-600'
    : estado === 'cargando' || estado === 'pendiente'
      ? 'bg-yellow-100 text-yellow-600'
      : 'bg-gray-100 text-gray-500';

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <div className={`w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center ${colorBadge}`}>
          {estado === 'cargando' || estado === 'pendiente' ? (
            <div className="w-8 h-8 border-3 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <h1 className="text-2xl font-bold text-navy-950 mb-2">{titulo}</h1>
        {externalReference && (
          <p className="text-lg font-semibold text-orange-600 mb-4">
            Cotizacion #{externalReference}
          </p>
        )}
        {paymentId && (
          <p className="text-sm text-gray-500 mb-4">
            ID de pago: {paymentId}
          </p>
        )}
        <p className="text-gray-600 mb-8">{detalle}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors"
          >
            Volver al Inicio
          </Link>
          <Link
            href="/categorias"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-lg transition-colors"
          >
            Seguir Comprando
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PagoExitoPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto px-4 py-16 flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ExitoContent />
    </Suspense>
  );
}
