import { GestionEntradaError, type D1Like, type UsuarioGestion } from "./tipos.ts";
import { aJson, desdeJson, idUuid } from "./util.ts";

/**
 * Auditoría de cambios hechos por las herramientas de gestión (tabla `auditoria`,
 * migrations-gestion/0001_base.sql). Un lote = una operación; se deshace entero.
 *
 * `antes`/`despues` son JSON con lo mínimo para revertir (p. ej. {precio: 1200}).
 * Las funciones reciben la D1 como parámetro: en producción viene de
 * `usarGestion(db => ...)` (d1.ts); en pruebas, de la D1 simulada.
 */

export interface CambioAuditado {
  herramienta: string;
  entidad: string;
  entidadId: string | number;
  antes?: unknown;
  despues?: unknown;
}

export interface EntradaAuditoria {
  id: string;
  loteId: string;
  usuarioId: string;
  usuarioEmail: string | null;
  herramienta: string;
  entidad: string;
  entidadId: string;
  antes: unknown;
  despues: unknown;
  creadoEn: number;
  deshechoEn: number | null;
  deshechoPor: string | null;
}

export interface ResumenLote {
  loteId: string;
  herramienta: string;
  usuarioId: string;
  usuarioEmail: string | null;
  creadoEn: number;
  cambios: number;
  deshechos: number;
  /** Todos los cambios del lote ya se deshicieron. */
  deshecho: boolean;
}

export function nuevoLoteId(): string {
  return idUuid();
}

const SQL_INSERT = `INSERT INTO auditoria
  (id, lote_id, usuario_id, usuario_email, herramienta, entidad, entidad_id, antes, despues, creado_en)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

function validarTexto(valor: string, campo: string): void {
  if (!valor || typeof valor !== "string") throw new GestionEntradaError(`Falta "${campo}".`);
}

/** Registra un lote completo de forma atómica. Devuelve los ids de las entradas. */
export async function registrarLote(
  db: D1Like,
  loteId: string,
  usuario: UsuarioGestion,
  cambios: CambioAuditado[],
  ahora: number = Date.now(),
): Promise<string[]> {
  validarTexto(loteId, "loteId");
  validarTexto(usuario?.id, "usuario.id");
  if (cambios.length === 0) return [];
  const ids: string[] = [];
  const sentencias = cambios.map((c) => {
    validarTexto(c.herramienta, "herramienta");
    validarTexto(c.entidad, "entidad");
    const id = idUuid();
    ids.push(id);
    return db
      .prepare(SQL_INSERT)
      .bind(
        id, loteId, usuario.id, usuario.email ?? null, c.herramienta, c.entidad, String(c.entidadId),
        aJson(c.antes, "antes"), aJson(c.despues, "despues"), ahora,
      );
  });
  // D1 limita las sentencias por batch; se parte en tandas (cada tanda es atómica).
  for (let i = 0; i < sentencias.length; i += 90) await db.batch(sentencias.slice(i, i + 90));
  return ids;
}

/** Registra un solo cambio (crea un lote de uno si no se da `loteId`). */
export async function registrarCambio(
  db: D1Like,
  usuario: UsuarioGestion,
  cambio: CambioAuditado,
  opciones: { loteId?: string; ahora?: number } = {},
): Promise<{ id: string; loteId: string }> {
  const loteId = opciones.loteId ?? nuevoLoteId();
  const [id] = await registrarLote(db, loteId, usuario, [cambio], opciones.ahora);
  return { id, loteId };
}

interface FilaAuditoria {
  id: string; lote_id: string; usuario_id: string; usuario_email: string | null; herramienta: string;
  entidad: string; entidad_id: string; antes: string | null; despues: string | null;
  creado_en: number; deshecho_en: number | null; deshecho_por: string | null;
}

function aEntrada(f: FilaAuditoria): EntradaAuditoria {
  return {
    id: f.id, loteId: f.lote_id, usuarioId: f.usuario_id, usuarioEmail: f.usuario_email,
    herramienta: f.herramienta, entidad: f.entidad, entidadId: f.entidad_id,
    antes: desdeJson(f.antes), despues: desdeJson(f.despues),
    creadoEn: f.creado_en, deshechoEn: f.deshecho_en, deshechoPor: f.deshecho_por,
  };
}

/** Entradas de un lote en el orden en que se hicieron. */
export async function obtenerLote(db: D1Like, loteId: string): Promise<EntradaAuditoria[]> {
  const r = await db
    .prepare("SELECT * FROM auditoria WHERE lote_id = ? ORDER BY creado_en ASC, rowid ASC")
    .bind(loteId)
    .all<FilaAuditoria>();
  return r.results.map(aEntrada);
}

/**
 * Lotes recientes, el más nuevo primero. `antesDe` (ms) pagina: pasa el
 * `creadoEn` del último lote recibido.
 */
export async function listarLotes(
  db: D1Like,
  opciones: { limite?: number; antesDe?: number; usuarioId?: string; soloVigentes?: boolean } = {},
): Promise<ResumenLote[]> {
  const limite = Math.min(Math.max(Math.trunc(opciones.limite ?? 20), 1), 100);
  const donde: string[] = [];
  const params: unknown[] = [];
  if (opciones.usuarioId) { donde.push("usuario_id = ?"); params.push(opciones.usuarioId); }
  const having: string[] = [];
  if (opciones.antesDe !== undefined) { having.push("MIN(creado_en) < ?"); params.push(opciones.antesDe); }
  if (opciones.soloVigentes) having.push("SUM(CASE WHEN deshecho_en IS NULL THEN 1 ELSE 0 END) > 0");
  const sql = `SELECT lote_id, MIN(herramienta) AS herramienta, MIN(usuario_id) AS usuario_id,
      MIN(usuario_email) AS usuario_email, MIN(creado_en) AS creado_en, COUNT(*) AS cambios,
      SUM(CASE WHEN deshecho_en IS NOT NULL THEN 1 ELSE 0 END) AS deshechos
    FROM auditoria ${donde.length ? "WHERE " + donde.join(" AND ") : ""}
    GROUP BY lote_id ${having.length ? "HAVING " + having.join(" AND ") : ""}
    ORDER BY MIN(creado_en) DESC, lote_id DESC LIMIT ?`;
  const r = await db.prepare(sql).bind(...params, limite).all<{
    lote_id: string; herramienta: string; usuario_id: string; usuario_email: string | null;
    creado_en: number; cambios: number; deshechos: number;
  }>();
  return r.results.map((f) => ({
    loteId: f.lote_id, herramienta: f.herramienta, usuarioId: f.usuario_id, usuarioEmail: f.usuario_email,
    creadoEn: f.creado_en, cambios: f.cambios, deshechos: f.deshechos, deshecho: f.deshechos >= f.cambios,
  }));
}

/** Historial de una entidad (p. ej. un producto), lo más nuevo primero. */
export async function historialDeEntidad(
  db: D1Like, entidad: string, entidadId: string | number, limite = 50,
): Promise<EntradaAuditoria[]> {
  const r = await db
    .prepare("SELECT * FROM auditoria WHERE entidad = ? AND entidad_id = ? ORDER BY creado_en DESC, rowid DESC LIMIT ?")
    .bind(entidad, String(entidadId), Math.min(Math.max(Math.trunc(limite), 1), 200))
    .all<FilaAuditoria>();
  return r.results.map(aEntrada);
}

/**
 * Marca un lote como deshecho (solo las entradas aún vigentes). Devuelve
 * cuántas entradas marcó: 0 = ya estaba deshecho o no existe, así que
 * deshacer dos veces no repite nada. Aplicar la reversión real a Supabase es
 * trabajo del llamador, que debe llamar a esto SOLO si la reversión salió bien
 * (o marcar por entrada con `marcarEntradaDeshecha`).
 */
export async function marcarDeshecho(
  db: D1Like, loteId: string, usuarioId: string, ahora: number = Date.now(),
): Promise<number> {
  validarTexto(usuarioId, "usuarioId");
  const r = await db
    .prepare("UPDATE auditoria SET deshecho_en = ?, deshecho_por = ? WHERE lote_id = ? AND deshecho_en IS NULL")
    .bind(ahora, usuarioId, loteId)
    .run();
  return r.meta?.changes ?? 0;
}

/** Igual que marcarDeshecho pero para una sola entrada (reversión parcial). */
export async function marcarEntradaDeshecha(
  db: D1Like, entradaId: string, usuarioId: string, ahora: number = Date.now(),
): Promise<boolean> {
  validarTexto(usuarioId, "usuarioId");
  const r = await db
    .prepare("UPDATE auditoria SET deshecho_en = ?, deshecho_por = ? WHERE id = ? AND deshecho_en IS NULL")
    .bind(ahora, usuarioId, entradaId)
    .run();
  return (r.meta?.changes ?? 0) > 0;
}
