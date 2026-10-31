"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatCLP } from "@jurmaq/shared/format";
import { CLAVE_ZONA, EVENTO_ZONA, type ZonaDespacho } from "@/lib/despacho/zonas";
import { useZonas, zonaEn } from "@/lib/despacho/zonas-cliente";

/**
 * "Despacho a: Molina ▾" en el header. Abre una lista corta con las zonas del
 * camión y su tarifa; la elección se guarda en el navegador y el checkout la
 * usa como comuna por defecto. Nunca se abre sola: sin popups al entrar.
 */

function leerId(): string | null {
  try {
    return localStorage.getItem(CLAVE_ZONA);
  } catch {
    return null;
  }
}

/** Zona elegida, sincronizada entre el header, la ficha y otras pestañas. */
export function useZonaDespacho(): [ZonaDespacho | null, (z: ZonaDespacho) => void] {
  const zonas = useZonas();
  const [id, setId] = useState<string | null>(null);
  const zona = zonaEn(zonas, id);
  useEffect(() => {
    setId(leerId());
    const sync = () => setId(leerId());
    window.addEventListener(EVENTO_ZONA, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENTO_ZONA, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const elegir = (z: ZonaDespacho) => {
    try {
      localStorage.setItem(CLAVE_ZONA, z.id);
    } catch { /* modo privado: vale sólo para esta vista */ }
    setId(z.id);
    window.dispatchEvent(new Event(EVENTO_ZONA));
  };
  return [zona, elegir];
}

/** Aviso entre menús del header: el que se abre cierra a los demás. */
export const EVENTO_MENU = "barraca:menu-abierto";

export function resumenZona(z: ZonaDespacho): string {
  if (z.costo === 0) return "Gratis";
  return z.gratisDesde != null
    ? `${formatCLP(z.costo)} · gratis desde ${formatCLP(z.gratisDesde)}`
    : formatCLP(z.costo);
}

const Pin = ({ className }: { className: string }) => (
  <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M10 18s-6-5.3-6-10a6 6 0 1112 0c0 4.7-6 10-6 10zm0-7.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" clipRule="evenodd" />
  </svg>
);
const Flecha = ({ abierto }: { abierto: boolean }) => (
  <svg className={`w-3 h-3 shrink-0 transition-transform duration-150 ${abierto ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
  </svg>
);

export default function SelectorZona({ variante }: { variante: "escritorio" | "celular" }) {
  const [zona, elegir] = useZonaDespacho();
  const zonas = useZonas();
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const idLista = useId();

  useEffect(() => {
    if (abierto) window.dispatchEvent(new CustomEvent(EVENTO_MENU, { detail: idLista }));
    const otro = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== idLista) setAbierto(false);
    };
    window.addEventListener(EVENTO_MENU, otro);
    return () => window.removeEventListener(EVENTO_MENU, otro);
  }, [abierto, idLista]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto]);

  const boton =
    variante === "escritorio" ? (
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        aria-controls={idLista}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-white/90 hover:text-white hover:bg-white/10 transition-colors duration-150"
      >
        <Pin className="w-4 h-4 shrink-0 text-white/60" />
        <span className="leading-tight">
          <span className="block text-[11px] text-white/60">Despacho a</span>
          <span className="flex items-center gap-1 text-[13px] font-semibold whitespace-nowrap">
            {zona ? zona.nombre : "Elige tu zona"}
            <Flecha abierto={abierto} />
          </span>
        </span>
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        aria-controls={idLista}
        className="flex items-center gap-1.5 min-h-[32px] max-w-full text-[12px] text-white/75 hover:text-white"
      >
        <Pin className="w-3.5 h-3.5 shrink-0 text-white/55" />
        <span className="truncate">
          {zona ? (
            <>
              Despacho a <strong className="font-semibold text-white">{zona.nombre}</strong>
              <span className="text-white/60"> · {resumenZona(zona)}</span>
            </>
          ) : (
            "¿Dónde despachamos? Elige tu zona"
          )}
        </span>
        <Flecha abierto={abierto} />
      </button>
    );

  return (
    <div ref={raiz} className="relative">
      {boton}
      {abierto && (
        <div
          id={idLista}
          className={`absolute top-full mt-2 z-50 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden origin-top menu-aparecer ${
            variante === "escritorio" ? "left-0 w-80" : "left-0 right-0 w-[min(100vw-2rem,22rem)]"
          }`}
        >
          <div className="px-4 pt-3 pb-2 border-b border-gray-100">
            <p className="text-sm font-semibold text-navy-950">Despacho a domicilio</p>
            <p className="text-xs text-gray-500 mt-0.5">Elige tu zona para ver cuánto cuesta. Te llamamos para coordinar el día.</p>
          </div>
          <ul role="listbox" aria-label="Zona de despacho" className="max-h-[min(60vh,22rem)] overflow-y-auto py-1">
            {zonas.map((z) => {
              const actual = zona?.id === z.id;
              return (
                <li key={z.id} role="option" aria-selected={actual}>
                  <button
                    type="button"
                    onClick={() => {
                      elegir(z);
                      setAbierto(false);
                    }}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-1.5 min-h-[44px] text-sm text-left transition-colors duration-100 ${
                      actual ? "bg-gray-50 font-semibold text-navy-950" : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-4 text-marca-600 ${actual ? "" : "invisible"}`} aria-hidden="true">✓</span>
                      {z.nombre}
                    </span>
                    <span className="text-right leading-tight tabular-nums">
                      <span className={`block text-xs ${z.costo === 0 ? "text-[#2F7F4E] font-medium" : "text-gray-600"}`}>{z.costo === 0 ? "Gratis" : formatCLP(z.costo)}</span>
                      {z.costo > 0 && z.gratisDesde != null && <span className="block text-[11px] text-gray-400">gratis desde {formatCLP(z.gratisDesde)}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="px-4 py-2.5 border-t border-gray-100 text-xs text-gray-500">
            ¿Otra comuna? Retira gratis en Molina o cotiza por WhatsApp.
          </p>
        </div>
      )}
    </div>
  );
}

/** Línea discreta en la ficha: el costo a la zona elegida, si ya eligió una. */
export function DespachoZonaFicha() {
  const [zona] = useZonaDespacho();
  if (!zona) return null;
  return (
    <>
      <br />
      <span className="text-navy-950 tabular-nums">Despacho a {zona.nombre} {resumenZona(zona)}</span>
    </>
  );
}
