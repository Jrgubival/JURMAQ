/**
 * Borradores de campañas en D1 (tablas `campanas` y `campana_versiones`, migración 0009).
 *
 * Solo hay borradores: no existe estado "enviada" ni "programada", y este módulo no importa ni llama a
 * nada que envíe correos. Cada edición crea una versión nueva (historial); borrar es una marca
 * (`borrado_en`), así que se puede deshacer. Recibe la D1 por parámetro.
 */
import { GestionEntradaError, type D1Like } from "../gestion/tipos.ts";
import { desdeJson, idCorto } from "../gestion/util.ts";
import { validarCampana, type DatosCampana } from "./contenido.ts";

export interface UsuarioCampana { id: string; email?: string | null }

export interface Campana extends DatosCampana {
  id: string;
  version: number;
  creadoPor: string;
  creadoEn: number;
  actualizadoPor: string | null;
  actualizadoEn: number;
  borradoEn: number | null;
}

interface Fila {
  id: string; asunto: string; texto: string; enlace: string | null; segmento: string | null; fecha_sugerida: string | null;
  version: number; creado_por: string; creado_en: number; actualizado_por: string | null; actualizado_en: number; borrado_en: number | null;
}

const COLUMNAS = "id, asunto, texto, enlace, segmento, fecha_sugerida, version, creado_por, creado_en, actualizado_por, actualizado_en, borrado_en";
const FORMATO_ID = /^[2-9A-HJKMNP-Z]{10}$/;
/** Tope de borradores vigentes: una IA no debe llenar la base. */
export const MAX_CAMPANAS_VIGENTES = 200;

const aCampana = (f: Fila): Campana => ({
  id: f.id, asunto: f.asunto, texto: f.texto, enlace: f.enlace, segmento: f.segmento, fecha_sugerida: f.fecha_sugerida,
  version: f.version, creadoPor: f.creado_por, creadoEn: f.creado_en, actualizadoPor: f.actualizado_por, actualizadoEn: f.actualizado_en, borradoEn: f.borrado_en,
});

export const datosDe = (c: Campana): DatosCampana => ({ asunto: c.asunto, texto: c.texto, enlace: c.enlace, segmento: c.segmento, fecha_sugerida: c.fecha_sugerida });
export const igualesCampana = (a: DatosCampana, b: DatosCampana) => a.asunto === b.asunto && a.texto === b.texto && a.enlace === b.enlace && a.segmento === b.segmento && a.fecha_sugerida === b.fecha_sugerida;

export const esIdCampana = (id: unknown): id is string => typeof id === "string" && FORMATO_ID.test(id.toUpperCase());

export async function obtenerCampana(db: D1Like, id: string): Promise<Campana | null> {
  if (!esIdCampana(id)) return null;
  const f = await db.prepare(`SELECT ${COLUMNAS} FROM campanas WHERE id = ?`).bind(id.toUpperCase()).first<Fila>();
  return f ? aCampana(f) : null;
}

export type ResultadoEscribir = { ok: true; campana: Campana; antes: DatosCampana | null } | { ok: false; errores: string[] };

export async function crearCampana(db: D1Like, datos: unknown, usuario: UsuarioCampana, ahora: number = Date.now()): Promise<ResultadoEscribir> {
  if (!usuario?.id) throw new GestionEntradaError('Falta "usuario.id".');
  const v = validarCampana(datos);
  if (!v.ok) return { ok: false, errores: v.errores };
  const n = await db.prepare("SELECT COUNT(*) AS n FROM campanas WHERE borrado_en IS NULL").first<{ n: number }>();
  if ((n?.n ?? 0) >= MAX_CAMPANAS_VIGENTES) return { ok: false, errores: [`Ya hay ${MAX_CAMPANAS_VIGENTES} borradores de campaña. Borra los que no sirvan antes de crear otro.`] };
  const id = idCorto(10);
  const d = v.valor;
  await db.batch([
    db.prepare("INSERT INTO campanas (id, asunto, texto, enlace, segmento, fecha_sugerida, version, creado_por, creado_email, creado_en, actualizado_por, actualizado_en) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)")
      .bind(id, d.asunto, d.texto, d.enlace, d.segmento, d.fecha_sugerida, usuario.id, usuario.email ?? null, ahora, usuario.id, ahora),
    db.prepare("INSERT INTO campana_versiones (campana_id, version, valor, creado_por, creado_en) VALUES (?, 1, ?, ?, ?)").bind(id, JSON.stringify(d), usuario.id, ahora),
  ]);
  const c = await obtenerCampana(db, id);
  return { ok: true, campana: c as Campana, antes: null };
}

/** Cambia campos de un borrador (mezcla sobre lo que hay). Crea una versión nueva. No revive uno borrado. */
export async function editarCampana(db: D1Like, id: string, cambios: Partial<DatosCampana>, usuario: UsuarioCampana, ahora: number = Date.now()): Promise<ResultadoEscribir | { ok: false; errores: string[]; noExiste: true }> {
  const actual = await obtenerCampana(db, id);
  if (!actual || actual.borradoEn !== null) return { ok: false, errores: ["No encontré ese borrador de campaña."], noExiste: true };
  const mezcla = { ...datosDe(actual), ...Object.fromEntries(Object.entries(cambios).filter(([, v]) => v !== undefined)) };
  const v = validarCampana(mezcla);
  if (!v.ok) return { ok: false, errores: v.errores };
  if (igualesCampana(v.valor, datosDe(actual))) return { ok: true, campana: actual, antes: datosDe(actual) };
  const d = v.valor;
  const nueva = actual.version + 1;
  try {
    await db.batch([
      db.prepare("UPDATE campanas SET asunto = ?, texto = ?, enlace = ?, segmento = ?, fecha_sugerida = ?, version = ?, actualizado_por = ?, actualizado_en = ? WHERE id = ? AND version = ? AND borrado_en IS NULL")
        .bind(d.asunto, d.texto, d.enlace, d.segmento, d.fecha_sugerida, nueva, usuario.id, ahora, actual.id, actual.version),
      db.prepare("INSERT INTO campana_versiones (campana_id, version, valor, creado_por, creado_en) SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM campanas WHERE id = ? AND version = ?)")
        .bind(actual.id, nueva, JSON.stringify(d), usuario.id, ahora, actual.id, nueva),
    ]);
  } catch {
    return { ok: false, errores: ["Alguien editó el borrador al mismo tiempo. Mira cómo quedó y vuelve a intentar."] };
  }
  const c = await obtenerCampana(db, actual.id);
  if (!c || c.version !== nueva) return { ok: false, errores: ["Alguien editó el borrador al mismo tiempo. Mira cómo quedó y vuelve a intentar."] };
  return { ok: true, campana: c, antes: datosDe(actual) };
}

export async function listarCampanas(db: D1Like, opc: { limite?: number; incluirBorradas?: boolean } = {}): Promise<Campana[]> {
  const limite = Math.max(1, Math.min(50, opc.limite ?? 25));
  const r = await db.prepare(`SELECT ${COLUMNAS} FROM campanas ${opc.incluirBorradas ? "" : "WHERE borrado_en IS NULL"} ORDER BY actualizado_en DESC LIMIT ?`).bind(limite).all<Fila>();
  return r.results.map(aCampana);
}

export async function versionesDeCampana(db: D1Like, id: string, limite = 20): Promise<Array<{ version: number; creadoPor: string; creadoEn: number }>> {
  const r = await db.prepare("SELECT version, creado_por, creado_en FROM campana_versiones WHERE campana_id = ? ORDER BY version DESC LIMIT ?").bind(id, Math.max(1, Math.min(50, limite))).all<{ version: number; creado_por: string; creado_en: number }>();
  return r.results.map((f) => ({ version: f.version, creadoPor: f.creado_por, creadoEn: f.creado_en }));
}

export async function leerVersionCampana(db: D1Like, id: string, version: number): Promise<DatosCampana | null> {
  const f = await db.prepare("SELECT valor FROM campana_versiones WHERE campana_id = ? AND version = ?").bind(id, version).first<{ valor: string }>();
  const v = validarCampana(desdeJson(f?.valor ?? null));
  return v.ok ? v.valor : null;
}

/** Borra el borrador (marca; se puede deshacer). Devuelve false si no existía o ya estaba borrado. */
export async function borrarCampana(db: D1Like, id: string, usuario: UsuarioCampana, ahora: number = Date.now()): Promise<Campana | null> {
  const c = await obtenerCampana(db, id);
  if (!c || c.borradoEn !== null) return null;
  await db.prepare("UPDATE campanas SET borrado_en = ?, borrado_por = ? WHERE id = ? AND borrado_en IS NULL").bind(ahora, usuario.id, c.id).run();
  return c;
}

/** Deshacer de un borrado: el borrador vuelve tal cual. */
export async function recuperarCampana(db: D1Like, id: string): Promise<"hecho" | "ya_estaba" | "no_existe"> {
  const c = await obtenerCampana(db, id);
  if (!c) return "no_existe";
  if (c.borradoEn === null) return "ya_estaba";
  await db.prepare("UPDATE campanas SET borrado_en = NULL, borrado_por = NULL WHERE id = ?").bind(c.id).run();
  return "hecho";
}

/** Deshacer de una creación: se borra (marca). */
export const deshacerCreacion = borrarCampana;

/** Vuelve un borrador a `datos` solo si sigue en la versión `desdeVersion` (si alguien lo editó después, no lo pisa). */
export async function volverCampana(db: D1Like, id: string, desdeVersion: number, datos: DatosCampana, usuario: UsuarioCampana, ahora: number = Date.now()): Promise<"hecho" | "ya_estaba" | "cambio_ajeno" | "no_existe"> {
  const c = await obtenerCampana(db, id);
  if (!c || c.borradoEn !== null) return "no_existe";
  if (igualesCampana(datosDe(c), datos)) return "ya_estaba";
  if (c.version !== desdeVersion) return "cambio_ajeno";
  const r = await editarCampana(db, id, datos, usuario, ahora);
  return r.ok ? "hecho" : "cambio_ajeno";
}
