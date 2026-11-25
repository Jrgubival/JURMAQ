/**
 * Tareas programadas de la gestión (las llama el cron de 30 minutos de
 * custom-worker.ts a través de /api/cron/mantenimiento-gestion):
 *   1. ofertas con vigencia: empezar las que ya les toca y terminar las vencidas;
 *   2. limpieza: códigos y tokens de OAuth viejos, límites de uso, aprobaciones,
 *      vistas previas vencidas y ofertas viejas (una vez por hora).
 * Todo es idempotente: dos corridas a la vez o repetidas no hacen daño.
 */
import type { D1Like } from "../gestion/index.ts";
import { limpiarVistasPrevias } from "../gestion/index.ts";
import { limpiarAprobaciones } from "../mcp/aprobaciones.ts";
import { reintentarAvisos, type DepsAviso } from "../mcp/aviso-operacion.ts";
import { limpiarLimites } from "../mcp/limites.ts";
import { limpiarOauth } from "../mcp/oauth.ts";
import type { DepsGestion } from "./deps.ts";
import { type ResumenOfertas, procesarOfertas } from "./ofertas.ts";

const DIA = 86_400_000;

export interface ResumenMantenimiento {
  ofertas: ResumenOfertas | null;
  /** Avisos a Jorge (modo avisar y operaciones de dinero) reintentados en esta corrida; null si no se pasó el envío o falló. */
  avisos: { intentados: number; enviados: number; fallidos: number } | null;
  limpieza: { hecha: boolean; fallidas: string[] };
}

/** Borra ofertas terminadas hace más de 120 días (los avisos viejos ya no se muestran). */
export async function limpiarOfertas(db: D1Like, ahora: number = Date.now()): Promise<void> {
  await db
    .prepare("DELETE FROM ofertas WHERE estado IN ('terminada','cancelada','omitida') AND COALESCE(terminada_en, creado_en) < ?")
    .bind(ahora - 120 * DIA)
    .run();
}

/** Borra avisos ya enviados o cancelados de hace más de 90 días (los fallidos se dejan a la vista). */
export async function limpiarAvisos(db: D1Like, ahora: number = Date.now()): Promise<void> {
  await db.prepare("DELETE FROM avisos_operacion WHERE estado IN ('enviado','cancelado') AND creado_en < ?").bind(ahora - 90 * DIA).run();
}

export async function ejecutarMantenimiento(db: D1Like, deps: DepsGestion, ahora: number = Date.now(), avisos?: DepsAviso): Promise<ResumenMantenimiento> {
  let ofertas: ResumenOfertas | null = null;
  try {
    ofertas = await procesarOfertas(db, deps, ahora);
  } catch {
    ofertas = null;
  }
  // Cada 30 minutos: reintenta los avisos a Jorge que no salieron (fallidos, colgados o sin enviar). Si la tabla aún no existe, se ignora.
  let resumenAvisos: ResumenMantenimiento["avisos"] = null;
  if (avisos) {
    try {
      resumenAvisos = await reintentarAvisos(db, avisos, ahora);
    } catch {
      resumenAvisos = null;
    }
  }
  // La limpieza corre en la primera media hora de cada hora (el cron pasa dos veces por hora).
  const toca = new Date(ahora).getUTCMinutes() < 30;
  const fallidas: string[] = [];
  if (toca) {
    const tareas: Array<[string, () => Promise<unknown>]> = [
      ["oauth", () => limpiarOauth(db, ahora)],
      ["limites", () => limpiarLimites(db, ahora)],
      ["aprobaciones", () => limpiarAprobaciones(db, ahora)],
      ["vistas_previas", () => limpiarVistasPrevias(db, ahora)],
      ["ofertas", () => limpiarOfertas(db, ahora)],
      ["avisos", () => limpiarAvisos(db, ahora)],
    ];
    for (const [nombre, fn] of tareas) {
      try {
        await fn();
      } catch {
        fallidas.push(nombre);
      }
    }
  }
  return { ofertas, avisos: resumenAvisos, limpieza: { hecha: toca, fallidas } };
}
