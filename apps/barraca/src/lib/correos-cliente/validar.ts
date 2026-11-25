/**
 * Validación de los textos editables de los correos al cliente. Pura.
 *
 * Reglas duras (un texto que las rompe NO se guarda y, si llegara roto a la publicada, el correo sale
 * con el texto del código):
 *  - Solo texto: nada de HTML (`<` y `>` se rechazan; igual todo se escapa al armar el correo).
 *  - Variables solo de la lista blanca de ese correo, escritas {así}; llaves sueltas o variables
 *    desconocidas invalidan el texto.
 *  - Sin teléfonos, correos ni enlaces fuera de jurmaq.cl (los enlaces del correo los pone el código).
 *  - Sin datos bancarios ni de pago: nombres de banco, tipos de cuenta, Webpay, RUT, números largos.
 *  - Sin montos escritos a mano ($ y cifra): el total y los precios son del pedido.
 *  - Sin caracteres de control ni de dirección invisibles.
 */
import { extraerEnlaces } from "../contenido/desvio.ts";
import { PLANTILLAS, campoDe, esCampoHtml, esClaveCorreo, variablesDeCampo, type ClaveCorreo, type DefCampo } from "./plantillas.ts";

export const RE_VARIABLE = /\{([^{}]*)\}/g;

export const RE_CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f​-‏‪-‮⁠-⁩﻿]/;
const RE_BANCARIO = /\bbanco\b|bancoestado|banco\s?estado|cuenta\s+(?:corriente|vista|rut|de\s+ahorro|bancaria)|\bn[°º.]?\s*de\s+cuenta|\bn[úu]mero\s+de\s+cuenta|\bcta\b|\bcuenta\s+n|\biban\b|\bswift\b|webpay|transbank|link\s+de\s+pago|enlace\s+de\s+pago|paga\s+aqu[ií]|mercado\s?pago|\bkhipu\b|\bflow\.cl\b/i;
export const RE_RUT = /\b\d{1,2}\.?\d{3}\.?\d{3}\s?-\s?[\dkK]\b/;
const RE_MONTO = /\$\s*\d|\d\s*(?:pesos|clp)\b/i;
export const RE_NUMERO_LARGO = /\d[\d .-]{6,}\d/;

export type ErroresTexto = string[];

/** Pasos de un texto: literal, variable o marca de negrita (**). */
export type Trozo = { t: "txt"; v: string } | { t: "var"; v: string } | { t: "neg" };

/** Parte un texto en trozos. Lanza si hay una variable mal escrita o llaves sueltas (usa `validarTexto` antes). */
export function trocear(texto: string): Trozo[] {
  const out: Trozo[] = [];
  const porNegrita = texto.split("**");
  porNegrita.forEach((seg, i) => {
    if (i > 0) out.push({ t: "neg" });
    let ultimo = 0;
    for (const m of seg.matchAll(RE_VARIABLE)) {
      const antes = seg.slice(ultimo, m.index);
      if (antes) out.push({ t: "txt", v: antes });
      out.push({ t: "var", v: m[1] });
      ultimo = (m.index ?? 0) + m[0].length;
    }
    const resto = seg.slice(ultimo);
    if (resto) out.push({ t: "txt", v: resto });
  });
  return out;
}

/** Valida un texto de un campo. Devuelve la lista de problemas en español (vacía = válido). */
export function validarTexto(clave: ClaveCorreo, campo: DefCampo, texto: unknown): ErroresTexto {
  const e: string[] = [];
  const nombre = `«${campo.etiqueta}»`;
  if (typeof texto !== "string") return [`${nombre}: tiene que ser un texto.`];
  const html = esCampoHtml(campo.tipo);
  if (texto !== texto.trim()) e.push(`${nombre}: no puede empezar ni terminar con espacios o saltos de línea.`);
  if (texto.trim() === "") {
    if (!campo.opcional) e.push(`${nombre}: no puede quedar vacío.`);
    return e;
  }
  if (texto.length > campo.max) e.push(`${nombre}: máximo ${campo.max} caracteres (tiene ${texto.length}).`);
  if (RE_CONTROL.test(texto)) e.push(`${nombre}: tiene caracteres de control o invisibles.`);
  if (/[\r\n]/.test(texto) && !html) e.push(`${nombre}: tiene que ir en una sola línea.`);
  if (/\r/.test(texto)) e.push(`${nombre}: usa solo saltos de línea simples.`);
  if (/\n{3,}/.test(texto)) e.push(`${nombre}: máximo una línea en blanco seguida.`);
  if (/[<>]/.test(texto)) e.push(`${nombre}: no se permite HTML (los símbolos < y >).`);
  if (/&[a-z#0-9]+;/i.test(texto)) e.push(`${nombre}: no se permiten códigos HTML como &amp;. Escribe el símbolo directo.`);

  // Variables: solo las de la lista blanca de este campo, bien escritas.
  const permitidas = new Set(variablesDeCampo(clave, campo));
  const sinVariables = texto.replace(RE_VARIABLE, (_, nom: string) => {
    if (!/^[a-z_]+$/.test(nom)) e.push(`${nombre}: la variable {${nom}} está mal escrita (solo minúsculas y guion bajo).`);
    else if (!permitidas.has(nom)) e.push(`${nombre}: la variable {${nom}} no existe en este correo. Las permitidas son: ${[...permitidas].map((v) => `{${v}}`).join(", ")}.`);
    return " ";
  });
  if (/[{}]/.test(sinVariables)) e.push(`${nombre}: tiene una llave { o } suelta. Las variables van completas, por ejemplo {nombre}.`);

  // Negrita **: solo en párrafos, bien cerrada.
  const marcas = texto.split("**").length - 1;
  if (marcas > 0) {
    if (!html) e.push(`${nombre}: la negrita ** solo se puede usar en párrafos.`);
    else if (marcas % 2 !== 0) e.push(`${nombre}: la negrita ** quedó sin cerrar.`);
    else if (/\*\*\s*\*\*/.test(texto)) e.push(`${nombre}: hay una negrita vacía.`);
  }
  if (/\*\*\*/.test(texto)) e.push(`${nombre}: demasiados asteriscos seguidos.`);

  // Desvío: teléfonos, correos y enlaces ajenos (los de jurmaq.cl se dejan como texto).
  const sinNegrita = sinVariables.replace(/\*\*/g, " ");
  const enl = extraerEnlaces(sinNegrita);
  if (enl.telefonos.size) e.push(`${nombre}: no se pueden escribir teléfonos; usa la variable {whatsapp_tienda}.`);
  if (enl.correos.size) e.push(`${nombre}: no se pueden escribir correos; usa la variable {email_tienda}.`);
  const ajenos = [...enl.hosts].filter((h) => h !== "jurmaq.cl" && !h.endsWith(".jurmaq.cl"));
  if (ajenos.length) e.push(`${nombre}: solo se pueden nombrar direcciones de jurmaq.cl (encontré ${ajenos.slice(0, 2).join(", ")}). Los botones y enlaces del correo los pone la tienda.`);

  // Datos bancarios, de pago y montos: son bloques fijos del código.
  if (RE_BANCARIO.test(sinNegrita)) e.push(`${nombre}: no se pueden escribir datos bancarios ni de pago (banco, cuenta, Webpay…). Esos bloques los arma la tienda.`);
  if (RE_RUT.test(sinNegrita)) e.push(`${nombre}: no se puede escribir un RUT.`);
  if (RE_NUMERO_LARGO.test(sinNegrita.replace(/\d{4}-\d{2}-\d{2}/g, " "))) e.push(`${nombre}: no se pueden escribir números largos (cuentas, teléfonos).`);
  if (RE_MONTO.test(sinNegrita)) e.push(`${nombre}: no se pueden escribir montos en pesos; usa {total} o {monto_devolucion}.`);

  // Variables obligatorias (el número de pedido en el asunto).
  const usadas = new Set([...texto.matchAll(RE_VARIABLE)].map((m) => m[1]));
  for (const v of campo.obligatorias ?? []) if (!usadas.has(v)) e.push(`${nombre}: tiene que incluir {${v}}.`);
  return e;
}

export type ResultadoValidar = { ok: true; valor: Record<string, string> } | { ok: false; errores: string[] };

/**
 * Valida una plantilla completa: un objeto {campo: texto}. Todos los campos de la plantilla tienen que
 * venir (los opcionales pueden ir vacíos) y no puede haber campos desconocidos.
 */
export function validarPlantilla(clave: unknown, valor: unknown): ResultadoValidar {
  if (!esClaveCorreo(clave)) return { ok: false, errores: ["No existe ese correo."] };
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return { ok: false, errores: ["La plantilla tiene que ser un objeto con un texto por campo."] };
  const def = PLANTILLAS[clave];
  const v = valor as Record<string, unknown>;
  const errores: string[] = [];
  for (const k of Object.keys(v)) if (!campoDe(clave, k)) errores.push(`El campo «${k}» no existe en este correo. Los campos son: ${def.campos.map((c) => c.clave).join(", ")}.`);
  const limpio: Record<string, string> = {};
  for (const c of def.campos) {
    const t = v[c.clave];
    if (t === undefined) { errores.push(`Falta el campo «${c.clave}».`); continue; }
    errores.push(...validarTexto(clave, c, t));
    if (typeof t === "string") limpio[c.clave] = t;
  }
  return errores.length ? { ok: false, errores } : { ok: true, valor: limpio };
}
