/**
 * Armado de los textos de un correo al cliente (puro). El HTML solo sale de acá y del código de
 * lib/pedidos/correos.ts: el texto editable se ESCAPA entero y de formato solo admite negrita (**).
 */
import { escapeHtml } from "@jurmaq/shared/mail/utils";
import { PLANTILLAS, VARIABLES, esCampoHtml, textosPorDefecto, type ClaveCorreo, type TipoCampo, type VariablesCorreo } from "./plantillas.ts";
import { trocear, validarPlantilla } from "./validar.ts";

/** Quita control, invisibles y saltos de línea de un valor que va en un asunto o resumen. */
function valorPlano(v: string): string {
  return v.replace(/[\u0000-\u001f\u007f​-‏‪-‮⁠-⁩﻿]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

/** Texto plano (asunto, título, resumen): variables reemplazadas, sin HTML. */
export function renderPlano(texto: string, vars: VariablesCorreo): string {
  let out = "";
  for (const t of trocear(texto)) {
    if (t.t === "txt") out += t.v;
    else if (t.t === "var") out += valorPlano(vars[t.v] ?? "");
    else throw new Error("negrita en texto plano");
  }
  return out;
}

/** HTML de un párrafo: todo escapado; ** abre y cierra negrita; \n pasa a <br>. */
export function renderHtml(texto: string, vars: VariablesCorreo): string {
  let out = "";
  let abierta = false;
  for (const t of trocear(texto)) {
    if (t.t === "neg") {
      out += abierta ? "</strong>" : "<strong>";
      abierta = !abierta;
    } else {
      const crudo = t.t === "txt" ? t.v : (vars[t.v] ?? "");
      out += escapeHtml(crudo).replace(/\n/g, "<br>");
    }
  }
  if (abierta) throw new Error("negrita sin cerrar");
  return out;
}

export interface TextosCorreo {
  /** De dónde salieron: lo publicado o el texto del código. */
  origen: "publicado" | "codigo";
  /** asunto, título y resumen en texto plano; saludo, párrafos y despedida en HTML escapado (despedida "" si no hay). */
  campos: Record<string, string>;
}

function renderCampos(clave: ClaveCorreo, textos: Record<string, string>, vars: VariablesCorreo): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of PLANTILLAS[clave].campos) {
    const t = textos[c.clave] ?? "";
    out[c.clave] = t === "" ? "" : esCampoHtml(c.tipo as TipoCampo) ? renderHtml(t, vars) : renderPlano(t, vars);
  }
  return out;
}

/**
 * Textos de un correo: usa la plantilla PUBLICADA si valida y se arma sin fallar; si no (no hay, está
 * dañada, tiene una variable que ya no existe, falla al armarse) usa EXACTAMENTE el texto del código.
 * Nunca lanza.
 */
export function resolverTextos(clave: ClaveCorreo, publicado: unknown, vars: VariablesCorreo): TextosCorreo {
  if (publicado !== null && publicado !== undefined) {
    try {
      const v = validarPlantilla(clave, publicado);
      if (v.ok) return { origen: "publicado", campos: renderCampos(clave, v.valor, vars) };
    } catch {
      // cae al texto del código
    }
  }
  try {
    return { origen: "codigo", campos: renderCampos(clave, textosPorDefecto(clave), vars) };
  } catch {
    // Imposible con los textos del código (hay prueba), pero el correo nunca debe dejar de salir.
    return { origen: "codigo", campos: Object.fromEntries(PLANTILLAS[clave].campos.map((c) => [c.clave, c.defecto])) };
  }
}

/** Variables de ejemplo para la vista previa (los datos de la tienda pueden venir reales). */
export function variablesEjemplo(clave: ClaveCorreo, tienda?: Partial<Record<string, string>>): VariablesCorreo {
  const out: VariablesCorreo = {};
  for (const v of PLANTILLAS[clave].variables) out[v] = tienda?.[v] ?? VARIABLES[v].ejemplo;
  return out;
}

const quitarNegrita = (html: string) => html.replace(/<\/?strong>/g, "**").replace(/<br>/g, "\n");
const desescapar = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'").replace(/&amp;/g, "&");

/**
 * Vista previa en texto de cómo queda el correo con datos de ejemplo: los campos editables ya
 * reemplazados y, en su lugar, una línea [FIJO] por cada bloque que arma la tienda.
 */
export function vistaPreviaTexto(clave: ClaveCorreo, textos: Record<string, string>, vars: VariablesCorreo): string {
  const r = renderCampos(clave, textos, vars);
  const def = PLANTILLAS[clave];
  const lineas: string[] = [`ASUNTO: ${r.asunto}`];
  for (const c of def.campos) if (c.tipo === "preheader") lineas.push(`RESUMEN EN LA BANDEJA${c.cuando ? ` (${c.cuando.toLowerCase()})` : ""}: ${r[c.clave]}`);
  lineas.push(`TÍTULO: ${r.titulo}`, "");
  for (const p of def.estructura) {
    if ("fijo" in p) lineas.push(`[FIJO, lo arma la tienda: ${p.fijo}]`);
    else {
      const c = def.campos.find((x) => x.clave === p.campo);
      const texto = r[p.campo];
      if (!c) continue;
      if (c.clave === "despedida" && !texto) { lineas.push("(sin despedida)"); continue; }
      lineas.push(`${c.cuando ? `(${c.cuando}) ` : ""}${desescapar(quitarNegrita(texto))}`);
    }
  }
  return lineas.join("\n");
}

/** Un campo ya armado, en texto (sin HTML ni negritas), para mostrarlo en una vista previa o a quien aprueba. */
export function campoComoTexto(clave: ClaveCorreo, textos: Record<string, string>, vars: VariablesCorreo, campo: string): string {
  const def = PLANTILLAS[clave].campos.find((c) => c.clave === campo);
  const r = renderCampos(clave, textos, vars)[campo] ?? "";
  return def && esCampoHtml(def.tipo as TipoCampo) ? desescapar(quitarNegrita(r)).replace(/\*\*/g, "") : r;
}
