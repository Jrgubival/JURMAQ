"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function PendienteContent() {
  const searchParams = useSearchParams();
  const externalReference = searchParams.get("external_reference");

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <div className="w-20 h-20 mx-auto mb-6 bg-yellow-100 rounded-full flex items-center justify-center">
          <svg
            className="w-10 h-10 text-yellow-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-navy-950 mb-2">
          Tu Pago esta Siendo Procesado
        </h1>
        {externalReference && (
          <p className="text-lg font-semibold text-orange-600 mb-4">
            Cotizacion #{externalReference}
          </p>
        )}
        <p className="text-gray-600 mb-4">
          Tu pago esta pendiente de confirmacion. Esto puede tomar unos
          minutos dependiendo del medio de pago seleccionado.
        </p>
        <p className="text-gray-500 text-sm mb-8">
          Te enviaremos una notificacion por correo cuando el pago sea
          confirmado. No es necesario que realices el pago nuevamente.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors"
          >
            Volver al Inicio
          </Link>
          <Link
            href="/catalogo"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-lg transition-colors"
          >
            Seguir Comprando
          </Link>
        </div>

        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            Si pagas con transferencia bancaria o efectivo, recuerda completar
            el pago en el plazo indicado por MercadoPago para que no se cancele.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PagoPendientePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto px-4 py-16 flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <PendienteContent />
    </Suspense>
  );
}
