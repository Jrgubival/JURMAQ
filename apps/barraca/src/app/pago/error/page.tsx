"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { HQ } from "@jurmaq/shared/seo";

function ErrorContent() {
  const searchParams = useSearchParams();
  const externalReference = searchParams.get("external_reference");

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <div className="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
          <svg
            className="w-10 h-10 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-navy-950 mb-2">
          Hubo un Problema con tu Pago
        </h1>
        {externalReference && (
          <p className="text-lg font-semibold text-orange-600 mb-4">
            Cotización #{externalReference}
          </p>
        )}
        <p className="text-gray-600 mb-8">
          No pudimos procesar tu pago. Esto puede deberse a fondos
          insuficientes, datos incorrectos o un problema temporal. Tu
          cotización sigue activa y puedes intentar nuevamente.
        </p>
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

        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-500">
            Si el problema persiste, contactanos al{" "}
            <a
              href={`tel:${HQ.telefono}`}
              className="text-orange-600 font-semibold hover:underline"
            >
              {HQ.telefonoDisplay}
            </a>{" "}
            o a{" "}
            <a
              href="mailto:contacto@jurmaq.cl"
              className="text-orange-600 font-semibold hover:underline"
            >
              contacto@jurmaq.cl
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PagoErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto px-4 py-16 flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  );
}
