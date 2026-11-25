"use client";
/**
 * Lectura en el navegador de popup, cinta y avisos (/api/contenido/publico).
 * Una sola petición por carga de página, compartida por todos los componentes.
 * Si falla o tarda más de `TIMEOUT_MS`, entrega `null` y cada componente usa
 * su respaldo (popup de código, sin cinta ni avisos).
 */
import { useEffect, useState } from "react";
import type { ContenidoPublico } from "./publico.ts";

const TIMEOUT_MS = 3500;
let compartida: Promise<ContenidoPublico | null> | null = null;

export function pedirContenidoPublico(): Promise<ContenidoPublico | null> {
  if (!compartida) {
    compartida = (async () => {
      try {
        const control = new AbortController();
        const t = setTimeout(() => control.abort(), TIMEOUT_MS);
        try {
          const r = await fetch("/api/contenido/publico", { signal: control.signal });
          if (!r.ok) return null;
          return (await r.json()) as ContenidoPublico;
        } finally {
          clearTimeout(t);
        }
      } catch {
        return null;
      }
    })();
    // Un fallo no se queda para siempre: la próxima carga lo reintenta.
    compartida.then((v) => {
      if (v === null) compartida = null;
    });
  }
  return compartida;
}

/** undefined = cargando; null = no se pudo (usar respaldo); objeto = listo. */
export function useContenidoPublico(): ContenidoPublico | null | undefined {
  const [valor, setValor] = useState<ContenidoPublico | null | undefined>(undefined);
  useEffect(() => {
    let vivo = true;
    pedirContenidoPublico().then((v) => {
      if (vivo) setValor(v);
    });
    return () => {
      vivo = false;
    };
  }, []);
  return valor;
}
