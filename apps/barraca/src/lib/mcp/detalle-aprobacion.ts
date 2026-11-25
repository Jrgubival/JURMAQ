/**
 * Detalle del cambio que Jorge ve en /aprobar/<token>. Regla: lo que se aprueba es lo que se ve, completo.
 * Nada se corta ni se resume en silencio: el detalle y los textos legales salen enteros dentro de cajas con
 * scroll, con las cifras clave arriba (cuántos productos, mayor variación, bajo costo). Si el detalle no
 * cupo al guardarlo, la página lo dice en grande.
 */
const ETIQUETAS_CIFRAS: Record<string, string> = {
  productos: "Productos que cambian", fichas: "Fichas que cambian", mayorVariacionPct: "Mayor variación de precio (%)",
  bajoCosto: "Productos bajo el costo", menos15: "Productos con menos de 15 % sobre el costo", sinCosto: "Productos sin costo cargado",
};

const CAJA = "max-height:60vh;overflow:auto;white-space:pre-wrap;word-break:break-word;";

export interface PartesDetalle {
  cifras: Array<[string, number]>;
  /** Texto completo (textos legales, borrador de contacto…). */
  texto: string | null;
  resto: unknown;
  incompleto: boolean;
}

export function partesDetalle(d: unknown): PartesDetalle {
  if (!d || typeof d !== "object" || Array.isArray(d)) return { cifras: [], texto: null, resto: d ?? null, incompleto: false };
  const { cifras, textoCompleto, detalleIncompleto, ...resto } = d as Record<string, unknown>;
  const lista = cifras && typeof cifras === "object" && !Array.isArray(cifras)
    ? Object.entries(cifras as Record<string, unknown>).filter((e): e is [string, number] => typeof e[1] === "number")
    : [];
  return {
    cifras: lista, texto: typeof textoCompleto === "string" ? textoCompleto : null,
    resto: Object.keys(resto).length ? resto : null, incompleto: detalleIncompleto === true,
  };
}

export function detalleTexto(d: unknown): string {
  if (d === null || d === undefined) return "";
  return typeof d === "string" ? d : JSON.stringify(d, null, 2);
}

/** HTML del detalle. `escapar` es el escapado de la página (todo dato dinámico pasa por él). */
export function htmlDetalleAprobacion(d: unknown, escapar: (s: string) => string): string {
  const p = partesDetalle(d);
  const detalle = detalleTexto(p.resto);
  const partes: string[] = [];
  if (p.incompleto) partes.push(`<div class="aviso"><b>El detalle completo era demasiado grande y no se guardó.</b> No apruebes sin revisar el cambio completo con Claude.</div>`);
  if (p.cifras.length) {
    partes.push(`<h2>Datos clave</h2><table class="cifras">${p.cifras.map(([k, n]) => `<tr><td>${escapar(ETIQUETAS_CIFRAS[k] ?? k)}</td><td><b>${escapar(String(n))}</b></td></tr>`).join("")}</table>`);
  }
  if (p.texto !== null) {
    partes.push(`<h2>Texto completo que se publicaría</h2><div class="dato" tabindex="0" style="${CAJA}">${escapar(p.texto)}</div><p><small>${escapar(String(p.texto.length))} caracteres, completos (usa el scroll).</small></p>`);
  }
  if (detalle) {
    partes.push(`<h2>Detalle completo</h2><div class="dato" tabindex="0" style="${CAJA}"><pre style="white-space:pre-wrap;margin:0">${escapar(detalle)}</pre></div><p><small>${escapar(String(detalle.length))} caracteres, completos (usa el scroll).</small></p>`);
  }
  return partes.join("\n");
}
