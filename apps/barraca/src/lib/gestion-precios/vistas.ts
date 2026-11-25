/**
 * Mirar una vista previa SIN gastarla (para decidir si hace falta aprobación
 * antes de consumirla). El consumo real, atómico y de un solo uso, sigue siendo
 * `consumirVistaPrevia` de lib/gestion.
 */
import type { D1Like } from "../gestion/index.ts";
import { desdeJson } from "../gestion/util.ts";

const FORMATO_ID = /^[2-9A-HJKMNP-Z]{12}$/;

export type MotivoVista = "no_existe" | "expirada" | "usada" | "tipo_distinto";

export type ResultadoMirar =
  | { ok: true; id: string; payload: unknown; huella: string | null }
  | { ok: false; motivo: MotivoVista };

export async function mirarVistaPrevia(
  db: D1Like, p: { id: string; usuarioId: string; tipo: string }, ahora: number = Date.now(),
): Promise<ResultadoMirar> {
  const id = (p.id ?? "").toString().trim().toUpperCase();
  if (!FORMATO_ID.test(id) || !p.usuarioId) return { ok: false, motivo: "no_existe" };
  const v = await db
    .prepare("SELECT tipo, payload, huella, expira_en, usada_en FROM vistas_previas WHERE id = ? AND usuario_id = ?")
    .bind(id, p.usuarioId)
    .first<{ tipo: string; payload: string; huella: string | null; expira_en: number; usada_en: number | null }>();
  if (!v) return { ok: false, motivo: "no_existe" };
  if (v.usada_en !== null) return { ok: false, motivo: "usada" };
  if (v.expira_en <= ahora) return { ok: false, motivo: "expirada" };
  if (v.tipo !== p.tipo) return { ok: false, motivo: "tipo_distinto" };
  return { ok: true, id, payload: desdeJson(v.payload), huella: v.huella };
}

export const MENSAJE_VISTA: Record<MotivoVista | "huella_cambiada", string> = {
  no_existe: "No encontré esa vista previa (el id está mal escrito o es de otra persona). Genera una nueva.",
  expirada: "Esa vista previa venció. Genera una nueva.",
  usada: "Esa vista previa ya se aplicó (cada una sirve una sola vez).",
  tipo_distinto: "Ese id corresponde a otra clase de vista previa. Usa la herramienta que la creó.",
  huella_cambiada: "Los datos cambiaron desde que se hizo la vista previa (alguien los tocó). No se aplicó nada: genera una vista previa nueva.",
};
