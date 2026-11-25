import type { D1Like } from "./tipos.ts";
import { GestionEntradaError } from "./tipos.ts";
import { aJson, desdeJson, idCorto } from "./util.ts";

/**
 * Vistas previas de un solo uso (tabla `vistas_previas`).
 *
 * Flujo: la herramienta calcula lo que HARÍA, guarda la vista previa y muestra
 * el id corto. Para aplicar, el usuario confirma ese id: se consume una vez,
 * solo si es suyo, no venció y los datos no cambiaron en el intertanto
 * (`huella`). Sin cripto propia: ids al azar de WebCrypto y SHA-256.
 */

export const TTL_VISTA_PREVIA_MS = 15 * 60 * 1000;
const FORMATO_ID = /^[2-9A-HJKMNP-Z]{12}$/;

export interface NuevaVistaPrevia {
  usuarioId: string;
  tipo: string;
  payload: unknown;
  /** Huella (huellaDeDatos) de los datos que se vieron. Si se da, confirmar exige la misma. */
  huella?: string | null;
  ttlMs?: number;
}

export interface VistaPreviaCreada {
  id: string;
  expiraEn: number;
}

export type MotivoRechazo =
  | "no_existe" // no hay tal id, o es de otro usuario (no se distingue a propósito)
  | "expirada"
  | "usada"
  | "tipo_distinto"
  | "huella_cambiada";

/** Con espera mínima (dinero y borrado): además «muy_pronto» = todavía no pasó la espera; NO se consume y sirve más tarde. */
export type MotivoRechazoConEspera = MotivoRechazo | "muy_pronto";
export type ResultadoConsumoConEspera =
  | Extract<ResultadoConsumo, { ok: true }>
  | { ok: false; motivo: MotivoRechazoConEspera };

export type ResultadoConsumo =
  | { ok: true; id: string; tipo: string; payload: unknown; huella: string | null }
  | { ok: false; motivo: MotivoRechazo };

export async function crearVistaPrevia(
  db: D1Like, v: NuevaVistaPrevia, ahora: number = Date.now(),
): Promise<VistaPreviaCreada> {
  if (!v.usuarioId) throw new GestionEntradaError('Falta "usuarioId".');
  if (!v.tipo) throw new GestionEntradaError('Falta "tipo".');
  const ttl = v.ttlMs ?? TTL_VISTA_PREVIA_MS;
  if (!Number.isFinite(ttl) || ttl <= 0 || ttl > 24 * 60 * 60 * 1000) {
    throw new GestionEntradaError("Duración de vista previa inválida.");
  }
  const payload = aJson(v.payload ?? {}, "payload");
  const expiraEn = ahora + Math.trunc(ttl);
  // Choque de id (≈ 2^-59): se reintenta unas pocas veces.
  for (let intento = 0; intento < 4; intento++) {
    const id = idCorto();
    try {
      await db
        .prepare("INSERT INTO vistas_previas (id, usuario_id, tipo, payload, huella, creado_en, expira_en) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(id, v.usuarioId, v.tipo, payload, v.huella ?? null, ahora, expiraEn)
        .run();
      return { id, expiraEn };
    } catch (e) {
      if (!(e instanceof Error) || !/UNIQUE|PRIMARY KEY/i.test(e.message) || intento === 3) throw e;
    }
  }
  throw new Error("unreachable");
}

/**
 * Consume la vista previa una sola vez. El UPDATE condicionado es atómico:
 * dos confirmaciones simultáneas no pueden ganar las dos.
 * `huellaActual` = huella de los datos AHORA; debe coincidir con la guardada.
 */
export async function consumirVistaPrevia(
  db: D1Like,
  p: { id: string; usuarioId: string; tipo?: string; huellaActual?: string | null },
  ahora: number = Date.now(),
): Promise<ResultadoConsumo> {
  return (await consumirVistaPreviaConEspera(db, p, ahora)) as ResultadoConsumo; // sin espera mínima nunca sale «muy_pronto»
}

/**
 * Igual que `consumirVistaPrevia`, pero exige que la vista previa tenga al menos `edadMinimaMs` de vida: así la vista previa
 * y su confirmación no pueden ir en la misma llamada ni pegadas. Si es muy pronto NO se consume (sirve unos segundos después).
 */
export async function consumirVistaPreviaConEspera(
  db: D1Like,
  p: { id: string; usuarioId: string; tipo?: string; huellaActual?: string | null; edadMinimaMs?: number },
  ahora: number = Date.now(),
): Promise<ResultadoConsumoConEspera> {
  const id = (p.id ?? "").toString().trim().toUpperCase();
  if (!FORMATO_ID.test(id) || !p.usuarioId) return { ok: false, motivo: "no_existe" };

  const fila = await db
    .prepare(
      `UPDATE vistas_previas SET usada_en = ?1
       WHERE id = ?2 AND usuario_id = ?3 AND usada_en IS NULL AND expira_en > ?1
         AND (?4 IS NULL OR tipo = ?4)
         AND (huella IS NULL OR huella = ?5)
         AND (?6 = 0 OR creado_en <= ?1 - ?6)
       RETURNING id, tipo, payload, huella`,
    )
    .bind(ahora, id, p.usuarioId, p.tipo ?? null, p.huellaActual ?? null, Math.max(0, Math.trunc(p.edadMinimaMs ?? 0)))
    .first<{ id: string; tipo: string; payload: string; huella: string | null }>();
  if (fila) return { ok: true, id: fila.id, tipo: fila.tipo, payload: desdeJson(fila.payload), huella: fila.huella };

  // No se consumió: se averigua por qué (solo de vistas del mismo usuario).
  const v = await db
    .prepare("SELECT tipo, huella, expira_en, usada_en, creado_en FROM vistas_previas WHERE id = ? AND usuario_id = ?")
    .bind(id, p.usuarioId)
    .first<{ tipo: string; huella: string | null; expira_en: number; usada_en: number | null; creado_en: number }>();
  if (!v) return { ok: false, motivo: "no_existe" };
  if (v.usada_en !== null) return { ok: false, motivo: "usada" };
  if (v.expira_en <= ahora) return { ok: false, motivo: "expirada" };
  if (p.tipo && v.tipo !== p.tipo) return { ok: false, motivo: "tipo_distinto" };
  if (v.huella !== null && v.huella !== (p.huellaActual ?? null)) return { ok: false, motivo: "huella_cambiada" };
  if (p.edadMinimaMs && v.creado_en > ahora - p.edadMinimaMs) return { ok: false, motivo: "muy_pronto" };
  return { ok: false, motivo: "huella_cambiada" };
}

/** Borra vistas vencidas o usadas hace más de `retencionMs` (por defecto 1 día). Devuelve cuántas. */
export async function limpiarVistasPrevias(
  db: D1Like, ahora: number = Date.now(), retencionMs = 24 * 60 * 60 * 1000,
): Promise<number> {
  const limite = ahora - retencionMs;
  const r = await db
    .prepare("DELETE FROM vistas_previas WHERE expira_en < ?1 OR (usada_en IS NOT NULL AND usada_en < ?1)")
    .bind(limite)
    .run();
  return r.meta?.changes ?? 0;
}
