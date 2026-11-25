/**
 * Campañas a suscriptores: contenido de un BORRADOR (puro, sin Next ni Supabase).
 *
 * NADA en este módulo envía, programa ni dispara envíos, ni importa nada que lo haga. Una campaña aquí es
 * solo texto guardado para que Jorge lo revise y lo envíe él, desde donde corresponde (hoy
 * `scripts/enviar-campana.mjs`, por tandas, con tope diario y respetando las bajas).
 *
 * Saneamiento (igual de estricto que los correos al cliente): sin HTML, sin caracteres de control, sin
 * teléfonos ni correos, enlaces solo a jurmaq.cl y un único enlace (el botón) que se valida aparte. El
 * asunto debe decir «Publicidad» (Ley 19.496, art. 28 B), igual que exige el script de envío.
 */
import { extraerEnlaces } from "../contenido/desvio.ts";
import { RE_CONTROL, RE_NUMERO_LARGO, RE_RUT } from "../correos-cliente/validar.ts";

export interface DatosCampana {
  asunto: string;
  texto: string;
  /** Enlace del botón: https a jurmaq.cl o un subdominio. null = sin botón. */
  enlace: string | null;
  /** Para quién es, en palabras (no son correos): «Clientes que compraron fierro este año». */
  segmento: string | null;
  /** AAAA-MM-DD, solo una sugerencia: nada se programa. */
  fecha_sugerida: string | null;
}

export const LIMITES_CAMPANA = { asunto: 150, texto: 4000, enlace: 300, segmento: 200 } as const;

const DOMINIO = "jurmaq.cl";

function chequearLibre(nombre: string, t: string, max: number, multilinea: boolean): string[] {
  const e: string[] = [];
  if (t !== t.trim()) e.push(`${nombre}: no puede empezar ni terminar con espacios o saltos de línea.`);
  if (t.trim() === "") return [`${nombre}: no puede quedar vacío.`];
  if (t.length > max) e.push(`${nombre}: máximo ${max} caracteres (tiene ${t.length}).`);
  if (RE_CONTROL.test(t)) e.push(`${nombre}: tiene caracteres de control o invisibles.`);
  if (/\r/.test(t)) e.push(`${nombre}: usa solo saltos de línea simples.`);
  if (!multilinea && /\n/.test(t)) e.push(`${nombre}: tiene que ir en una sola línea.`);
  if (/\n{3,}/.test(t)) e.push(`${nombre}: máximo una línea en blanco seguida.`);
  if (/[<>]/.test(t)) e.push(`${nombre}: no se permite HTML (los símbolos < y >).`);
  if (/&[a-z#0-9]+;/i.test(t)) e.push(`${nombre}: no se permiten códigos HTML como &amp;. Escribe el símbolo directo.`);
  if (/[{}]/.test(t)) e.push(`${nombre}: no se permiten llaves { }.`);
  const enl = extraerEnlaces(t);
  if (enl.telefonos.size) e.push(`${nombre}: no se pueden escribir teléfonos. Para llevar al cliente a la tienda usa el campo «enlace».`);
  if (enl.correos.size) e.push(`${nombre}: no se pueden escribir correos.`);
  const ajenos = [...enl.hosts].filter((h) => h !== DOMINIO && !h.endsWith(`.${DOMINIO}`));
  if (ajenos.length) e.push(`${nombre}: solo se pueden nombrar direcciones de jurmaq.cl (encontré ${ajenos.slice(0, 2).join(", ")}).`);
  if (RE_RUT.test(t)) e.push(`${nombre}: no se puede escribir un RUT.`);
  if (RE_NUMERO_LARGO.test(t.replace(/\d{4}-\d{2}-\d{2}/g, " "))) e.push(`${nombre}: no se pueden escribir números largos (cuentas, teléfonos).`);
  return e;
}

/** Valida el enlace del botón. Devuelve el enlace normalizado o los errores. */
export function validarEnlaceCampana(valor: unknown): { ok: true; enlace: string | null } | { ok: false; errores: string[] } {
  if (valor === null || valor === undefined || valor === "") return { ok: true, enlace: null };
  if (typeof valor !== "string") return { ok: false, errores: ["«enlace»: tiene que ser un texto."] };
  const n = "«enlace»";
  if (valor.length > LIMITES_CAMPANA.enlace) return { ok: false, errores: [`${n}: máximo ${LIMITES_CAMPANA.enlace} caracteres.`] };
  if (RE_CONTROL.test(valor) || /\s/.test(valor) || /[<>"'`\\]/.test(valor)) return { ok: false, errores: [`${n}: tiene espacios o caracteres no permitidos.`] };
  let u: URL;
  try {
    u = new URL(valor);
  } catch {
    return { ok: false, errores: [`${n}: no es una dirección válida. Debe empezar con https://`] };
  }
  if (u.protocol !== "https:") return { ok: false, errores: [`${n}: debe ser https://`] };
  if (u.username || u.password) return { ok: false, errores: [`${n}: no puede llevar usuario ni clave.`] };
  if (u.port) return { ok: false, errores: [`${n}: no puede indicar un puerto.`] };
  const h = u.hostname.toLowerCase();
  if (h !== DOMINIO && !h.endsWith(`.${DOMINIO}`)) return { ok: false, errores: [`${n}: solo puede apuntar a jurmaq.cl o a la tienda (barraca.jurmaq.cl).`] };
  return { ok: true, enlace: u.toString() };
}

export function validarFechaSugerida(valor: unknown): { ok: true; fecha: string | null } | { ok: false; errores: string[] } {
  if (valor === null || valor === undefined || valor === "") return { ok: true, fecha: null };
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return { ok: false, errores: ["«fecha_sugerida»: usa el formato AAAA-MM-DD."] };
  const d = new Date(`${valor}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== valor) return { ok: false, errores: ["«fecha_sugerida»: no es una fecha real."] };
  return { ok: true, fecha: valor };
}

export type ResultadoCampana = { ok: true; valor: DatosCampana } | { ok: false; errores: string[] };

const CAMPOS = new Set(["asunto", "texto", "enlace", "segmento", "fecha_sugerida"]);

export function validarCampana(d: unknown): ResultadoCampana {
  if (!d || typeof d !== "object" || Array.isArray(d)) return { ok: false, errores: ["La campaña tiene que ser un objeto."] };
  const o = d as Record<string, unknown>;
  const errores: string[] = [];
  for (const k of Object.keys(o)) if (!CAMPOS.has(k)) errores.push(`El campo «${k.slice(0, 40)}» no existe en una campaña.`);
  const asunto = typeof o.asunto === "string" ? o.asunto : "";
  const texto = typeof o.texto === "string" ? o.texto : "";
  if (typeof o.asunto !== "string") errores.push("«asunto»: es obligatorio.");
  else {
    errores.push(...chequearLibre("«asunto»", asunto, LIMITES_CAMPANA.asunto, false));
    if (!/publicidad/i.test(asunto)) errores.push("«asunto»: tiene que decir «Publicidad» (Ley 19.496, art. 28 B), por ejemplo «Publicidad: catálogo de fierro».");
  }
  if (typeof o.texto !== "string") errores.push("«texto»: es obligatorio.");
  else errores.push(...chequearLibre("«texto»", texto, LIMITES_CAMPANA.texto, true));
  let segmento: string | null = null;
  if (o.segmento !== null && o.segmento !== undefined && o.segmento !== "") {
    if (typeof o.segmento !== "string") errores.push("«segmento»: tiene que ser un texto.");
    else {
      errores.push(...chequearLibre("«segmento»", o.segmento, LIMITES_CAMPANA.segmento, false));
      segmento = o.segmento;
    }
  }
  const enl = validarEnlaceCampana(o.enlace);
  if (!enl.ok) errores.push(...enl.errores);
  const fec = validarFechaSugerida(o.fecha_sugerida);
  if (!fec.ok) errores.push(...fec.errores);
  if (errores.length || !enl.ok || !fec.ok) return { ok: false, errores };
  return { ok: true, valor: { asunto, texto, enlace: enl.enlace, segmento, fecha_sugerida: fec.fecha } };
}

/** Vista previa en texto. Solo el NÚMERO de suscriptores, nunca correos. */
export function vistaPreviaCampana(d: DatosCampana, suscriptoresActivos: number | null): string {
  const parrafos = d.texto.split(/\n{2,}/).map((p) => p.replace(/\n/g, " ").trim()).filter(Boolean);
  return [
    "BORRADOR DE CAMPAÑA (nada lo envía; Jorge lo envía desde donde corresponde)",
    `ASUNTO: ${d.asunto}`,
    `PARA QUIÉN: ${d.segmento ?? "(sin segmento indicado)"}`,
    `FECHA SUGERIDA PARA ENVIAR: ${d.fecha_sugerida ?? "(sin fecha)"}`,
    `SUSCRIPTORES ACTIVOS HOY: ${suscriptoresActivos === null ? "no disponible" : suscriptoresActivos} (solo el número; el envío real además salta a quienes pidieron la baja)`,
    "",
    ...parrafos.flatMap((p) => [p, ""]),
    d.enlace ? `[BOTÓN → ${d.enlace}]` : "[sin botón]",
    "[FIJO, lo agrega el envío: dirección de la barraca y enlace para darse de baja]",
  ].join("\n");
}
