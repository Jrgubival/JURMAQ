/**
 * Plantillas de correos al cliente en D1: borrador (libre), publicado (lo que usa el envío), historial
 * de versiones y restaurar. Recibe la D1 como parámetro (producción: `usarGestion`; pruebas: D1 simulada).
 *
 * Este módulo NO decide si se puede publicar: publicar SIEMPRE necesita la aprobación de Jorge y eso lo
 * exige la herramienta (lib/mcp/tools/correos.ts) con `exigirAprobacion`, antes de llamar a
 * `publicarBorrador`. Aquí solo se escribe, validando cada texto, y la publicación es condicional a que
 * nada haya cambiado entre medio.
 *
 * Nada de lo que hay acá envía correos.
 */
import { GestionEntradaError, type D1Like } from "../gestion/tipos.ts";
import { desdeJson, jsonEstable } from "../gestion/util.ts";
import { CLAVES_CORREO, PLANTILLAS, esClaveCorreo, textosPorDefecto, type ClaveCorreo } from "./plantillas.ts";
import { validarPlantilla } from "./validar.ts";

export type Textos = Record<string, string>;
export interface UsuarioCorreo { id: string; email?: string | null }

export interface EstadoCorreo {
  clave: ClaveCorreo;
  /** Borrador en edición (puede ser igual a lo publicado) o null. */
  borrador: Textos | null;
  borradorPor: string | null;
  borradorEn: number | null;
  /** Lo publicado en D1 (validado) o null si el correo sale con el texto del código. */
  publicado: Textos | null;
  /** 0 = texto original del código. */
  versionPublicada: number;
  publicadoEn: number | null;
  publicadoPor: string | null;
  /** Lo que usa el envío hoy: lo publicado o el texto del código. */
  efectivo: Textos;
  origen: "d1" | "codigo";
  /** Hay un borrador distinto de lo que se envía hoy. */
  borradorSinPublicar: boolean;
  /** Lo publicado existe pero ya no valida: el correo sale con el texto del código. */
  publicadoDanado: boolean;
}

export interface ResumenVersionCorreo {
  clave: ClaveCorreo;
  version: number;
  nota: string | null;
  creadoPor: string;
  creadoEn: number;
  aprobacionId: string | null;
  vigente: boolean;
}

function exigirClave(clave: string): asserts clave is ClaveCorreo {
  if (!esClaveCorreo(clave)) throw new GestionEntradaError("Ese correo no existe.");
}

const MAX_NOTA = 200;
const notaLimpia = (n?: string) => (n ? n.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_NOTA) || null : null);

interface Fila {
  borrador: string | null; borrador_por: string | null; borrador_en: number | null;
  publicado: string | null; version_publicada: number | null; publicado_por: string | null; publicado_en: number | null;
}

/** Lee JSON y lo vuelve a validar. Si ya no valida (cambió la plantilla en código), null. */
function leerTextos(clave: ClaveCorreo, json: string | null): Textos | null {
  if (json === null) return null;
  const v = validarPlantilla(clave, desdeJson(json));
  return v.ok ? v.valor : null;
}

export const igualesTextos = (a: Textos | null, b: Textos | null) => jsonEstable(a) === jsonEstable(b);

export async function estadoCorreo(db: D1Like, clave: string): Promise<EstadoCorreo> {
  exigirClave(clave);
  const f = await db.prepare("SELECT borrador, borrador_por, borrador_en, publicado, version_publicada, publicado_por, publicado_en FROM correo_plantillas WHERE clave = ?").bind(clave).first<Fila>();
  const borrador = leerTextos(clave, f?.borrador ?? null);
  const publicado = leerTextos(clave, f?.publicado ?? null);
  const defecto = textosPorDefecto(clave);
  const efectivo = publicado ?? defecto;
  return {
    clave, borrador, borradorPor: f?.borrador_por ?? null, borradorEn: f?.borrador_en ?? null,
    publicado, versionPublicada: publicado ? (f?.version_publicada ?? 0) : 0, publicadoEn: f?.publicado_en ?? null, publicadoPor: f?.publicado_por ?? null,
    efectivo, origen: publicado ? "d1" : "codigo",
    borradorSinPublicar: borrador !== null && !igualesTextos(borrador, efectivo),
    publicadoDanado: !!f?.publicado && publicado === null,
  };
}

export async function listarCorreos(db: D1Like): Promise<EstadoCorreo[]> {
  const out: EstadoCorreo[] = [];
  for (const c of CLAVES_CORREO) out.push(await estadoCorreo(db, c));
  return out;
}

export type ResultadoGuardar =
  | { ok: true; antes: Textos | null; despues: Textos }
  | { ok: false; errores: string[] };

/** Guarda el borrador completo (valida cada texto). El borrador es libre: no envía ni publica nada. */
export async function guardarBorrador(db: D1Like, clave: string, valor: unknown, usuario: UsuarioCorreo, ahora: number = Date.now()): Promise<ResultadoGuardar> {
  exigirClave(clave);
  if (!usuario?.id) throw new GestionEntradaError('Falta "usuario.id".');
  const v = validarPlantilla(clave, valor);
  if (!v.ok) return { ok: false, errores: v.errores };
  const antes = (await estadoCorreo(db, clave)).borrador;
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO correo_plantillas (clave) VALUES (?)").bind(clave),
    db.prepare("UPDATE correo_plantillas SET borrador = ?, borrador_por = ?, borrador_email = ?, borrador_en = ? WHERE clave = ?").bind(JSON.stringify(v.valor), usuario.id, usuario.email ?? null, ahora, clave),
  ]);
  return { ok: true, antes, despues: v.valor };
}

/** Quita el borrador. Devuelve el que había. */
export async function descartarBorrador(db: D1Like, clave: string): Promise<Textos | null> {
  exigirClave(clave);
  const antes = (await estadoCorreo(db, clave)).borrador;
  await db.prepare("UPDATE correo_plantillas SET borrador = NULL, borrador_por = NULL, borrador_email = NULL, borrador_en = NULL WHERE clave = ?").bind(clave).run();
  return antes;
}

export async function listarVersiones(db: D1Like, clave: string, limite = 20): Promise<ResumenVersionCorreo[]> {
  exigirClave(clave);
  const est = await estadoCorreo(db, clave);
  const r = await db
    .prepare("SELECT version, nota, creado_por, creado_en, aprobacion_id FROM correo_versiones WHERE clave = ? ORDER BY version DESC LIMIT ?")
    .bind(clave, Math.max(1, Math.min(50, limite)))
    .all<{ version: number; nota: string | null; creado_por: string; creado_en: number; aprobacion_id: string | null }>();
  return r.results.map((f) => ({ clave, version: f.version, nota: f.nota, creadoPor: f.creado_por, creadoEn: f.creado_en, aprobacionId: f.aprobacion_id, vigente: est.origen === "d1" && f.version === est.versionPublicada }));
}

/** Los textos de una versión (0 = el original del código). null si no existe o ya no valida. */
export async function leerVersion(db: D1Like, clave: string, version: number): Promise<Textos | null> {
  exigirClave(clave);
  if (version === 0) return textosPorDefecto(clave);
  const f = await db.prepare("SELECT valor FROM correo_versiones WHERE clave = ? AND version = ?").bind(clave, version).first<{ valor: string }>();
  return f ? leerTextos(clave, f.valor) : null;
}

export type ResultadoPublicar =
  | { ok: true; version: number; antes: { version: number; valor: Textos | null }; valor: Textos }
  | { ok: false; motivo: "sin_borrador" | "invalido" | "sin_cambios" | "conflicto"; errores?: string[] };

/**
 * Publica el borrador como versión nueva. LLAMAR SOLO CON LA APROBACIÓN DE JORGE YA GASTADA
 * (`aprobacionId`). Es condicional: si entre medio cambió el borrador o la versión publicada, no escribe.
 * `esperado` es lo que Jorge vio y aprobó (el borrador exacto y la versión vigente).
 */
export async function publicarBorrador(
  db: D1Like,
  args: { clave: string; usuario: UsuarioCorreo; aprobacionId: string; esperado: { borrador: Textos; versionPublicada: number }; nota?: string; ahora?: number },
): Promise<ResultadoPublicar> {
  const { clave, usuario } = args;
  exigirClave(clave);
  if (!usuario?.id) throw new GestionEntradaError('Falta "usuario.id".');
  if (!args.aprobacionId) throw new GestionEntradaError("Publicar un correo al cliente exige el id de la aprobación de Jorge.");
  const ahora = args.ahora ?? Date.now();
  const est = await estadoCorreo(db, clave);
  if (!est.borrador) return { ok: false, motivo: "sin_borrador" };
  const v = validarPlantilla(clave, est.borrador);
  if (!v.ok) return { ok: false, motivo: "invalido", errores: v.errores };
  if (!igualesTextos(est.borrador, args.esperado.borrador) || est.versionPublicada !== args.esperado.versionPublicada) return { ok: false, motivo: "conflicto" };
  if (igualesTextos(est.borrador, est.efectivo)) return { ok: false, motivo: "sin_cambios" };

  const maxV = await db.prepare("SELECT COALESCE(MAX(version), 0) AS m FROM correo_versiones WHERE clave = ?").bind(clave).first<{ m: number }>();
  const nueva = (maxV?.m ?? 0) + 1;
  const json = JSON.stringify(v.valor);
  const nota = notaLimpia(args.nota);
  try {
    await db.batch([
      db
        .prepare(
          `UPDATE correo_plantillas SET publicado = ?, version_publicada = ?, publicado_por = ?, publicado_email = ?, publicado_en = ?
           WHERE clave = ? AND COALESCE(version_publicada, 0) = ? AND borrador = ?`,
        )
        .bind(json, nueva, usuario.id, usuario.email ?? null, ahora, clave, est.origen === "d1" ? est.versionPublicada : 0, JSON.stringify(est.borrador)),
      db
        .prepare(
          `INSERT INTO correo_versiones (clave, version, valor, nota, creado_por, creado_email, creado_en, aprobacion_id)
           SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM correo_plantillas WHERE clave = ? AND version_publicada = ? AND publicado = ?)`,
        )
        .bind(clave, nueva, json, nota, usuario.id, usuario.email ?? null, ahora, args.aprobacionId, clave, nueva, json),
    ]);
  } catch {
    return { ok: false, motivo: "conflicto" };
  }
  const hecho = await db.prepare("SELECT 1 AS x FROM correo_versiones WHERE clave = ? AND version = ?").bind(clave, nueva).first();
  if (!hecho) return { ok: false, motivo: "conflicto" };
  return { ok: true, version: nueva, antes: { version: est.origen === "d1" ? est.versionPublicada : 0, valor: est.publicado }, valor: v.valor };
}

/**
 * Deshacer una publicación: deja vigente una versión ANTERIOR ya aprobada (o el texto del código con
 * `aVersion = 0`), solo si la vigente sigue siendo `desdeVersion` (si alguien publicó después, no la pisa).
 * No crea versiones: el historial queda intacto.
 */
export async function volverAVersion(
  db: D1Like,
  args: { clave: string; desdeVersion: number; aVersion: number; usuario: UsuarioCorreo; ahora?: number },
): Promise<"hecho" | "ya_estaba" | "cambio_ajeno" | "version_no_existe"> {
  const { clave } = args;
  exigirClave(clave);
  const est = await estadoCorreo(db, clave);
  const vigente = est.origen === "d1" ? est.versionPublicada : 0;
  if (vigente === args.aVersion) return "ya_estaba";
  if (vigente !== args.desdeVersion) return "cambio_ajeno";
  const ahora = args.ahora ?? Date.now();
  if (args.aVersion === 0) {
    await db.prepare("UPDATE correo_plantillas SET publicado = NULL, version_publicada = NULL, publicado_por = ?, publicado_email = ?, publicado_en = ? WHERE clave = ? AND version_publicada = ?").bind(args.usuario.id, args.usuario.email ?? null, ahora, clave, args.desdeVersion).run();
    return "hecho";
  }
  const f = await db.prepare("SELECT valor FROM correo_versiones WHERE clave = ? AND version = ?").bind(clave, args.aVersion).first<{ valor: string }>();
  if (!f || !leerTextos(clave, f.valor)) return "version_no_existe";
  await db.prepare("UPDATE correo_plantillas SET publicado = ?, version_publicada = ?, publicado_por = ?, publicado_email = ?, publicado_en = ? WHERE clave = ? AND version_publicada = ?").bind(f.valor, args.aVersion, args.usuario.id, args.usuario.email ?? null, ahora, clave, args.desdeVersion).run();
  return "hecho";
}

/** Para tests y herramientas: la definición de la plantilla. */
export const definicion = (clave: ClaveCorreo) => PLANTILLAS[clave];
