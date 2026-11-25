/**
 * Lo que el navegador pide por /api/contenido/publico: popup, cinta superior y
 * avisos. Va aparte del HTML (con caché corta) para que publicar un aviso de
 * cierre no obligue a regenerar toda la tienda. Puro: recibe los valores y la
 * hora. Las vigencias (desde/hasta) se evalúan acá, en el servidor.
 */
import { parseFecha, vigenteEn } from "./fechas.ts";
import type { AvisoConfig, CintaConfig, LugarAviso, PopupConfig, ValoresContenido } from "./tipos.ts";

export interface PopupPublico extends Omit<PopupConfig, "desde" | "hasta"> {
  /** ms UTC (o null). El navegador compara con su reloj. */
  desdeMs: number | null;
  hastaMs: number | null;
}

export interface ContenidoPublico {
  popup: PopupPublico | null;
  cinta: CintaConfig | null;
  avisos: AvisoConfig[];
}

export function popupPublico(p: PopupConfig): PopupPublico {
  const { desde, hasta, ...resto } = p;
  return { ...resto, desdeMs: desde ? parseFecha(desde) : null, hastaMs: hasta ? parseFecha(hasta) : null };
}

/** ¿El popup debe salir en este instante? (activo y dentro de sus fechas). */
export function popupVigente(p: PopupPublico, ahoraMs: number): boolean {
  if (!p.activo) return false;
  if (p.desdeMs !== null && ahoraMs < p.desdeMs) return false;
  if (p.hastaMs !== null && ahoraMs >= p.hastaMs) return false;
  return true;
}

export function avisosVigentes(avisos: AvisoConfig[], ahoraMs: number, donde?: LugarAviso): AvisoConfig[] {
  const orden = { alerta: 0, aviso: 1, info: 2 } as const;
  return avisos
    .filter((a) => a.activo && vigenteEn(a, ahoraMs) && (!donde || a.donde.includes(donde)))
    .sort((a, b) => orden[a.severidad] - orden[b.severidad]);
}

export function cintaVigente(c: CintaConfig, ahoraMs: number): CintaConfig | null {
  return c.activa && c.texto && vigenteEn(c, ahoraMs) ? c : null;
}

export function armarPublico(v: Pick<ValoresContenido, "popup" | "cinta" | "avisos">, ahoraMs: number): ContenidoPublico {
  const popup = popupPublico(v.popup);
  return {
    // Si todavía no empieza (desde en el futuro) igual se envía: el navegador espera su hora.
    popup: popup.activo && (popup.hastaMs === null || ahoraMs < popup.hastaMs) ? popup : null,
    cinta: cintaVigente(v.cinta, ahoraMs),
    avisos: avisosVigentes(v.avisos, ahoraMs),
  };
}

/** Respaldo para el navegador si la ruta falla: el popup de código, sin cinta ni avisos. */
export function publicoVacio(): ContenidoPublico {
  return { popup: null, cinta: null, avisos: [] };
}
