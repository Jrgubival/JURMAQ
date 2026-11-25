/**
 * Contenido editable en D1: borrador, publicado, historial de versiones,
 * restaurar, y publicación pendiente de aprobación. Recibe la D1 como
 * parámetro (en producción: `usarGestion(db => ...)`; en pruebas: la D1
 * simulada). No toca la caché de Next: eso lo hace servicio.ts.
 *
 * Reglas:
 *   - Todo valor que entra pasa por validarContenido (saneado y estricto).
 *   - Cada publicación crea una versión nueva (nunca se edita una vieja).
 *   - Términos y privacidad (META_CONTENIDO.requiereAprobacion): publicar sin
 *     `aprobacion` deja la versión "pendiente" (no se ve en la tienda) hasta
 *     que el servicio de aprobaciones llame a `aprobarPendiente`.
 *   - Cada acción queda en la auditoría de gestión (lib/gestion).
 */
import { registrarCambio } from "../gestion/auditoria.ts";
import { GestionEntradaError, type D1Like } from "../gestion/tipos.ts";
import { desdeJson } from "../gestion/util.ts";
import { validarContenido } from "./esquemas.ts";
import { sanearTextoPlano } from "./markdown.ts";
import { respaldoDe } from "./respaldo.ts";
import {
  CLAVES_CONTENIDO,
  META_CONTENIDO,
  type ClaveContenido,
  type MetaContenido,
  type UsuarioContenido,
  type ValoresContenido,
} from "./tipos.ts";

const HERRAMIENTA = "contenido";
const MAX_NOTA = 200;

export type EstadoVersion = "publicada" | "reemplazada" | "pendiente" | "descartada";

export interface ResumenVersion {
  clave: ClaveContenido;
  version: number;
  estado: EstadoVersion;
  nota: string | null;
  creadoPor: string;
  creadoEmail: string | null;
  creadoEn: number;
  publicadoEn: number | null;
  aprobadoPor: string | null;
  restauradaDe: number | null;
}

export interface EstadoContenido<K extends ClaveContenido = ClaveContenido> {
  clave: K;
  meta: MetaContenido;
  borrador: ValoresContenido[K] | null;
  borradorPor: string | null;
  borradorEn: number | null;
  publicado: ValoresContenido[K] | null;
  versionPublicada: number | null;
  publicadoEn: number | null;
  publicadoPor: string | null;
  /** Lo que ve la tienda hoy: lo publicado o, si no hay, el respaldo en código. */
  efectivo: ValoresContenido[K];
  origen: "d1" | "codigo";
  /** Última solicitud de publicación esperando aprobación, si hay. */
  pendiente: ResumenVersion | null;
}

/** Aprobación ya dada por Jorge (la entrega el servicio de aprobaciones). */
export interface AprobacionDada {
  aprobadoPor: string;
  /** Id de la solicitud de aprobación (para rastrear). */
  referencia?: string;
}

export type ResultadoPublicar =
  | { ok: true; estado: "publicada" | "pendiente"; clave: ClaveContenido; version: number }
  | { ok: false; motivo: "sin_borrador" | "invalido" | "sin_cambios"; errores?: string[] };

export type ResultadoGuardar = { ok: true; clave: ClaveContenido } | { ok: false; errores: string[] };

function validarClave(clave: string): asserts clave is ClaveContenido {
  if (!(CLAVES_CONTENIDO as readonly string[]).includes(clave)) throw new GestionEntradaError("Tipo de contenido desconocido.");
}

function notaLimpia(nota: string | undefined): string | null {
  if (!nota) return null;
  return sanearTextoPlano(nota, MAX_NOTA) || null;
}

function validarUsuario(u: UsuarioContenido) {
  if (!u?.id || typeof u.id !== "string") throw new GestionEntradaError('Falta "usuario.id".');
}

interface FilaContenido {
  clave: string;
  borrador: string | null;
  borrador_por: string | null;
  borrador_en: number | null;
  publicado: string | null;
  version_publicada: number | null;
  publicado_por: string | null;
  publicado_en: number | null;
}

interface FilaVersion {
  clave: string;
  version: number;
  estado: EstadoVersion;
  nota: string | null;
  creado_por: string;
  creado_email: string | null;
  creado_en: number;
  publicado_en: number | null;
  aprobado_por: string | null;
  restaurada_de: number | null;
}

const COLUMNAS_VERSION = "clave, version, estado, nota, creado_por, creado_email, creado_en, publicado_en, aprobado_por, restaurada_de";

function aResumen(f: FilaVersion): ResumenVersion {
  return {
    clave: f.clave as ClaveContenido,
    version: f.version,
    estado: f.estado,
    nota: f.nota,
    creadoPor: f.creado_por,
    creadoEmail: f.creado_email,
    creadoEn: f.creado_en,
    publicadoEn: f.publicado_en,
    aprobadoPor: f.aprobado_por,
    restauradaDe: f.restaurada_de,
  };
}

/** Lee JSON guardado y lo vuelve a validar: si no valida (esquema cambió, dato dañado) devuelve null. */
function leerValor<K extends ClaveContenido>(clave: K, json: string | null): ValoresContenido[K] | null {
  if (json === null) return null;
  const v = validarContenido(clave, desdeJson(json));
  return v.ok ? v.valor : null;
}

// ───────── Lectura ─────────

export async function obtenerEstado<K extends ClaveContenido>(db: D1Like, clave: K): Promise<EstadoContenido<K>> {
  validarClave(clave);
  const fila = await db.prepare("SELECT * FROM contenido WHERE clave = ?").bind(clave).first<FilaContenido>();
  const pend = await db
    .prepare(`SELECT ${COLUMNAS_VERSION} FROM contenido_versiones WHERE clave = ? AND estado = 'pendiente' ORDER BY version DESC LIMIT 1`)
    .bind(clave)
    .first<FilaVersion>();
  const publicado = leerValor(clave, fila?.publicado ?? null);
  return {
    clave,
    meta: META_CONTENIDO[clave],
    borrador: leerValor(clave, fila?.borrador ?? null),
    borradorPor: fila?.borrador_por ?? null,
    borradorEn: fila?.borrador_en ?? null,
    publicado,
    versionPublicada: publicado ? (fila?.version_publicada ?? null) : null,
    publicadoEn: publicado ? (fila?.publicado_en ?? null) : null,
    publicadoPor: publicado ? (fila?.publicado_por ?? null) : null,
    efectivo: publicado ?? respaldoDe(clave),
    origen: publicado ? "d1" : "codigo",
    pendiente: pend ? aResumen(pend) : null,
  };
}

export interface ResumenContenido {
  clave: ClaveContenido;
  etiqueta: string;
  requiereAprobacion: boolean;
  origen: "d1" | "codigo";
  versionPublicada: number | null;
  publicadoEn: number | null;
  tieneBorrador: boolean;
  pendienteVersion: number | null;
}

/** Una línea por tipo de contenido: qué hay publicado, borradores y pendientes. */
export async function listarContenidos(db: D1Like): Promise<ResumenContenido[]> {
  const filas = (await db.prepare("SELECT * FROM contenido").all<FilaContenido>()).results;
  const pendientes = (
    await db.prepare("SELECT clave, MAX(version) AS version FROM contenido_versiones WHERE estado = 'pendiente' GROUP BY clave").all<{ clave: string; version: number }>()
  ).results;
  return CLAVES_CONTENIDO.map((clave) => {
    const f = filas.find((x) => x.clave === clave);
    const publicado = !!f && leerValor(clave, f.publicado) !== null;
    return {
      clave,
      etiqueta: META_CONTENIDO[clave].etiqueta,
      requiereAprobacion: META_CONTENIDO[clave].requiereAprobacion,
      origen: publicado ? "d1" : "codigo",
      versionPublicada: publicado ? (f?.version_publicada ?? null) : null,
      publicadoEn: publicado ? (f?.publicado_en ?? null) : null,
      tieneBorrador: !!f?.borrador,
      pendienteVersion: pendientes.find((p) => p.clave === clave)?.version ?? null,
    };
  });
}

export async function listarVersiones(db: D1Like, clave: ClaveContenido, limite = 30): Promise<ResumenVersion[]> {
  validarClave(clave);
  const r = await db
    .prepare(`SELECT ${COLUMNAS_VERSION} FROM contenido_versiones WHERE clave = ? ORDER BY version DESC LIMIT ?`)
    .bind(clave, Math.min(Math.max(Math.trunc(limite), 1), 100))
    .all<FilaVersion>();
  return r.results.map(aResumen);
}

export async function obtenerVersion<K extends ClaveContenido>(
  db: D1Like,
  clave: K,
  version: number,
): Promise<{ resumen: ResumenVersion; valor: ValoresContenido[K] | null } | null> {
  validarClave(clave);
  const f = await db
    .prepare(`SELECT ${COLUMNAS_VERSION}, valor FROM contenido_versiones WHERE clave = ? AND version = ?`)
    .bind(clave, version)
    .first<FilaVersion & { valor: string }>();
  return f ? { resumen: aResumen(f), valor: leerValor(clave, f.valor) } : null;
}

/** Lo publicado de todas las claves, en UNA consulta (lo que lee la tienda). Valores sin validar. */
export async function leerPublicadosCrudos(db: D1Like): Promise<{ clave: string; json: string; version: number | null }[]> {
  const r = await db
    .prepare("SELECT clave, publicado, version_publicada FROM contenido WHERE publicado IS NOT NULL")
    .all<{ clave: string; publicado: string; version_publicada: number | null }>();
  return r.results.map((f) => ({ clave: f.clave, json: f.publicado, version: f.version_publicada }));
}

// ───────── Borrador ─────────

export async function guardarBorrador(
  db: D1Like,
  args: { clave: ClaveContenido; valor: unknown; usuario: UsuarioContenido; ahora?: number },
): Promise<ResultadoGuardar> {
  validarClave(args.clave);
  validarUsuario(args.usuario);
  const v = validarContenido(args.clave, args.valor);
  if (!v.ok) return { ok: false, errores: v.errores };
  const ahora = args.ahora ?? Date.now();
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO contenido (clave) VALUES (?)").bind(args.clave),
    db
      .prepare("UPDATE contenido SET borrador = ?, borrador_por = ?, borrador_email = ?, borrador_en = ? WHERE clave = ?")
      .bind(JSON.stringify(v.valor), args.usuario.id, args.usuario.email ?? null, ahora, args.clave),
  ]);
  await registrarCambio(db, args.usuario, { herramienta: `${HERRAMIENTA}.guardar_borrador`, entidad: HERRAMIENTA, entidadId: args.clave }, { ahora });
  return { ok: true, clave: args.clave };
}

export async function descartarBorrador(
  db: D1Like,
  args: { clave: ClaveContenido; usuario: UsuarioContenido; ahora?: number },
): Promise<boolean> {
  validarClave(args.clave);
  validarUsuario(args.usuario);
  const r = await db
    .prepare("UPDATE contenido SET borrador = NULL, borrador_por = NULL, borrador_email = NULL, borrador_en = NULL WHERE clave = ? AND borrador IS NOT NULL")
    .bind(args.clave)
    .run();
  const hubo = (r.meta?.changes ?? 0) > 0;
  if (hubo) await registrarCambio(db, args.usuario, { herramienta: `${HERRAMIENTA}.descartar_borrador`, entidad: HERRAMIENTA, entidadId: args.clave }, { ahora: args.ahora });
  return hubo;
}

// ───────── Publicar ─────────

async function versionActual(db: D1Like, clave: string): Promise<number | null> {
  const f = await db.prepare("SELECT version_publicada FROM contenido WHERE clave = ?").bind(clave).first<{ version_publicada: number | null }>();
  return f?.version_publicada ?? null;
}

async function ultimaVersion(db: D1Like, clave: string): Promise<number> {
  const f = await db.prepare("SELECT MAX(version) AS v FROM contenido_versiones WHERE clave = ?").bind(clave).first<{ v: number | null }>();
  return f?.v ?? 0;
}

/**
 * Publica el borrador (o `valor`, si se pasa). Para tipos que requieren
 * aprobación y sin `aprobacion`, deja la versión "pendiente" y la tienda NO
 * cambia hasta `aprobarPendiente`.
 */
export async function publicar(
  db: D1Like,
  args: {
    clave: ClaveContenido;
    usuario: UsuarioContenido;
    nota?: string;
    /** Si se omite, se publica el borrador guardado. */
    valor?: unknown;
    aprobacion?: AprobacionDada;
    restauradaDe?: number;
    ahora?: number;
  },
): Promise<ResultadoPublicar> {
  const { clave, usuario } = args;
  validarClave(clave);
  validarUsuario(usuario);
  const ahora = args.ahora ?? Date.now();
  const desdeBorrador = args.valor === undefined;
  let crudo = args.valor;
  if (desdeBorrador) {
    const f = await db.prepare("SELECT borrador FROM contenido WHERE clave = ?").bind(clave).first<{ borrador: string | null }>();
    if (!f?.borrador) return { ok: false, motivo: "sin_borrador" };
    crudo = desdeJson(f.borrador);
  }
  const v = validarContenido(clave, crudo);
  if (!v.ok) return { ok: false, motivo: "invalido", errores: v.errores };
  const json = JSON.stringify(v.valor);

  const actual = await db.prepare("SELECT publicado FROM contenido WHERE clave = ?").bind(clave).first<{ publicado: string | null }>();
  if (actual?.publicado && JSON.stringify(leerValor(clave, actual.publicado)) === json && !args.restauradaDe) {
    return { ok: false, motivo: "sin_cambios" };
  }

  const pideAprobacion = META_CONTENIDO[clave].requiereAprobacion && !args.aprobacion;
  const nota = notaLimpia(args.nota);
  const aprobadoPor = args.aprobacion?.aprobadoPor ?? null;
  const previa = await versionActual(db, clave);

  const insertar = (estado: "publicada" | "pendiente") =>
    db
      .prepare(
        `INSERT INTO contenido_versiones (clave, version, valor, estado, nota, creado_por, creado_email, creado_en, publicado_en, aprobado_por, restaurada_de)
         SELECT ?, COALESCE(MAX(version), 0) + 1, ?, ?, ?, ?, ?, ?, ?, ?, ? FROM contenido_versiones WHERE clave = ?`,
      )
      .bind(clave, json, estado, nota, usuario.id, usuario.email ?? null, ahora, estado === "publicada" ? ahora : null, aprobadoPor, args.restauradaDe ?? null, clave);

  if (pideAprobacion) {
    await db.batch([
      db.prepare("INSERT OR IGNORE INTO contenido (clave) VALUES (?)").bind(clave),
      db.prepare("UPDATE contenido_versiones SET estado = 'descartada' WHERE clave = ? AND estado = 'pendiente'").bind(clave),
      insertar("pendiente"),
    ]);
    const version = await ultimaVersion(db, clave);
    await registrarCambio(
      db,
      usuario,
      { herramienta: `${HERRAMIENTA}.solicitar_publicacion`, entidad: HERRAMIENTA, entidadId: clave, antes: { version: previa }, despues: { version, estado: "pendiente" } },
      { ahora },
    );
    return { ok: true, estado: "pendiente", clave, version };
  }

  const limpiaBorrador = desdeBorrador ? ", borrador = NULL, borrador_por = NULL, borrador_email = NULL, borrador_en = NULL" : "";
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO contenido (clave) VALUES (?)").bind(clave),
    db.prepare("UPDATE contenido_versiones SET estado = 'reemplazada' WHERE clave = ? AND estado = 'publicada'").bind(clave),
    db.prepare("UPDATE contenido_versiones SET estado = 'descartada' WHERE clave = ? AND estado = 'pendiente'").bind(clave),
    insertar("publicada"),
    db
      .prepare(
        `UPDATE contenido SET publicado = ?, version_publicada = (SELECT MAX(version) FROM contenido_versiones WHERE clave = ?),
           publicado_por = ?, publicado_email = ?, publicado_en = ?${limpiaBorrador} WHERE clave = ?`,
      )
      .bind(json, clave, usuario.id, usuario.email ?? null, ahora, clave),
  ]);
  const version = (await versionActual(db, clave)) ?? 0;
  await registrarCambio(
    db,
    usuario,
    {
      herramienta: args.restauradaDe ? `${HERRAMIENTA}.restaurar` : `${HERRAMIENTA}.publicar`,
      entidad: HERRAMIENTA,
      entidadId: clave,
      antes: { version: previa },
      despues: { version, ...(aprobadoPor ? { aprobadoPor } : {}), ...(args.restauradaDe ? { restauradaDe: args.restauradaDe } : {}) },
    },
    { ahora },
  );
  return { ok: true, estado: "publicada", clave, version };
}

// ───────── Aprobaciones ─────────

export type ResultadoAprobar = { ok: true; clave: ClaveContenido; version: number } | { ok: false; motivo: "no_pendiente" | "invalido" };

/** Lo llama el servicio de aprobaciones cuando Jorge aprueba: la versión pendiente pasa a publicada. */
export async function aprobarPendiente(
  db: D1Like,
  args: { clave: ClaveContenido; version: number; aprobadoPor: string; referencia?: string; ahora?: number },
): Promise<ResultadoAprobar> {
  validarClave(args.clave);
  if (!args.aprobadoPor) throw new GestionEntradaError('Falta "aprobadoPor".');
  const ahora = args.ahora ?? Date.now();
  const v = await obtenerVersion(db, args.clave, args.version);
  if (!v || v.resumen.estado !== "pendiente") return { ok: false, motivo: "no_pendiente" };
  if (!v.valor) return { ok: false, motivo: "invalido" };
  const previa = await versionActual(db, args.clave);
  const json = JSON.stringify(v.valor);
  const res = await db.batch([
    db.prepare("INSERT OR IGNORE INTO contenido (clave) VALUES (?)").bind(args.clave),
    db
      .prepare(
        `UPDATE contenido_versiones SET estado = 'reemplazada'
         WHERE clave = ? AND estado = 'publicada' AND EXISTS (SELECT 1 FROM contenido_versiones WHERE clave = ? AND version = ? AND estado = 'pendiente')`,
      )
      .bind(args.clave, args.clave, args.version),
    db
      .prepare("UPDATE contenido_versiones SET estado = 'publicada', publicado_en = ?, aprobado_por = ? WHERE clave = ? AND version = ? AND estado = 'pendiente'")
      .bind(ahora, args.aprobadoPor, args.clave, args.version),
    db
      .prepare(
        `UPDATE contenido SET publicado = ?, version_publicada = ?, publicado_por = ?, publicado_email = ?, publicado_en = ?
         WHERE clave = ? AND EXISTS (SELECT 1 FROM contenido_versiones WHERE clave = ? AND version = ? AND estado = 'publicada' AND publicado_en = ?)`,
      )
      .bind(json, args.version, v.resumen.creadoPor, v.resumen.creadoEmail, ahora, args.clave, args.clave, args.version, ahora),
  ]);
  const cambios = (res[2] as { meta?: { changes?: number } } | undefined)?.meta?.changes ?? 0;
  if (cambios === 0) return { ok: false, motivo: "no_pendiente" };
  await registrarCambio(
    db,
    { id: args.aprobadoPor },
    {
      herramienta: `${HERRAMIENTA}.aprobar`,
      entidad: HERRAMIENTA,
      entidadId: args.clave,
      antes: { version: previa },
      despues: { version: args.version, ...(args.referencia ? { referencia: args.referencia } : {}) },
    },
    { ahora },
  );
  return { ok: true, clave: args.clave, version: args.version };
}

export async function rechazarPendiente(
  db: D1Like,
  args: { clave: ClaveContenido; version: number; rechazadoPor: string; ahora?: number },
): Promise<boolean> {
  validarClave(args.clave);
  const r = await db
    .prepare("UPDATE contenido_versiones SET estado = 'descartada' WHERE clave = ? AND version = ? AND estado = 'pendiente'")
    .bind(args.clave, args.version)
    .run();
  const hubo = (r.meta?.changes ?? 0) > 0;
  if (hubo) {
    await registrarCambio(db, { id: args.rechazadoPor }, { herramienta: `${HERRAMIENTA}.rechazar`, entidad: HERRAMIENTA, entidadId: args.clave, despues: { version: args.version } }, { ahora: args.ahora });
  }
  return hubo;
}

export async function listarPendientes(db: D1Like): Promise<ResumenVersion[]> {
  const r = await db
    .prepare(`SELECT ${COLUMNAS_VERSION} FROM contenido_versiones WHERE estado = 'pendiente' ORDER BY creado_en DESC`)
    .all<FilaVersion>();
  return r.results.map(aResumen);
}

// ───────── Restaurar ─────────

export type ResultadoRestaurar =
  | ResultadoPublicar
  | { ok: true; estado: "borrador"; clave: ClaveContenido }
  | { ok: false; motivo: "no_existe" | "no_restaurable" };

/**
 * Vuelve a una versión anterior. `destino` es obligatorio a propósito:
 *   "borrador"  → la deja como borrador para revisarla antes de publicar.
 *   "publicado" → publica una versión NUEVA con ese contenido (el historial no se borra).
 */
export async function restaurarVersion(
  db: D1Like,
  args: {
    clave: ClaveContenido;
    version: number;
    usuario: UsuarioContenido;
    destino: "borrador" | "publicado";
    nota?: string;
    aprobacion?: AprobacionDada;
    ahora?: number;
  },
): Promise<ResultadoRestaurar> {
  validarClave(args.clave);
  const v = await obtenerVersion(db, args.clave, args.version);
  if (!v) return { ok: false, motivo: "no_existe" };
  if (v.resumen.estado === "pendiente" || v.resumen.estado === "descartada" || !v.valor) return { ok: false, motivo: "no_restaurable" };
  if (args.destino === "borrador") {
    const g = await guardarBorrador(db, { clave: args.clave, valor: v.valor, usuario: args.usuario, ahora: args.ahora });
    return g.ok ? { ok: true, estado: "borrador", clave: args.clave } : { ok: false, motivo: "no_restaurable" };
  }
  return publicar(db, {
    clave: args.clave,
    usuario: args.usuario,
    valor: v.valor,
    nota: args.nota ?? `Restaurada la versión ${args.version}`,
    aprobacion: args.aprobacion,
    restauradaDe: args.version,
    ahora: args.ahora,
  });
}
