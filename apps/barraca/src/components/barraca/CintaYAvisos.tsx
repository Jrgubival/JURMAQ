"use client";

import { usePathname } from "next/navigation";
import Link from "@/components/barraca/Enlace";
import { useContenidoPublico } from "@/lib/contenido/cliente";
import type { LugarAviso, SeveridadAviso } from "@/lib/contenido/tipos";

/**
 * Cinta superior y avisos (cierres, feriados, despacho). Los edita el equipo
 * desde la gestión (D1) y llegan por /api/contenido/publico. Por defecto no
 * hay ninguno: no se dibuja nada y no cambia el diseño. Solo informan: nunca
 * bloquean una compra.
 */

export function CintaSuperior() {
  const publico = useContenidoPublico();
  const cinta = publico?.cinta;
  if (!cinta) return null;
  return (
    <div role="status" className="bg-marca-600 px-4 py-2 text-center text-[13px] font-semibold leading-snug text-white sm:text-sm">
      {cinta.texto}
      {cinta.enlace && (
        <>
          {" "}
          <Link href={cinta.enlace.enlace} className="underline underline-offset-2 hover:text-white/90">
            {cinta.enlace.texto}
          </Link>
        </>
      )}
    </div>
  );
}

const ESTILO: Record<SeveridadAviso, string> = {
  info: "border-gray-200 bg-white text-navy-950",
  aviso: "border-amber-300 bg-amber-50 text-amber-900",
  alerta: "border-red-300 bg-red-50 text-red-900",
};

function lugarDe(pathname: string | null): LugarAviso {
  if (pathname === "/carrito" || pathname?.startsWith("/carrito/")) return "carrito";
  if (pathname === "/checkout" || pathname?.startsWith("/checkout/")) return "checkout";
  return "tienda";
}

export function AvisosTienda() {
  const pathname = usePathname();
  const publico = useContenidoPublico();
  const lugar = lugarDe(pathname);
  const avisos = (publico?.avisos ?? []).filter((a) => a.donde.includes(lugar));
  if (avisos.length === 0) return null;
  return (
    <div className="mx-auto max-w-7xl space-y-2 px-4 pt-3 sm:px-6 lg:px-8">
      {avisos.map((a) => (
        <div key={a.id} role="status" className={`rounded-lg border px-4 py-2.5 text-sm leading-snug ${ESTILO[a.severidad]}`}>
          <p className="font-semibold">{a.titulo}</p>
          {a.texto && <p className="mt-0.5 whitespace-pre-line">{a.texto}</p>}
        </div>
      ))}
    </div>
  );
}
