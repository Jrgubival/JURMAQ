/**
 * Límite de uso por ventana fija en D1 (tabla mcp_limites). Se eligió D1 y no
 * KV porque ya está enlazada (cero recursos nuevos en producción) y un UPSERT
 * es atómico; KV es eventualmente consistente y dejaría pasar ráfagas.
 */
import type { D1Like } from "../gestion/index.ts";

export interface ResultadoLimite {
  permitido: boolean;
  /** Segundos hasta que se libera la ventana. */
  reintentarEnSeg: number;
  cuenta: number;
}

export async function limitar(
  db: D1Like, clave: string, max: number, ventanaMs: number, ahora: number = Date.now(),
): Promise<ResultadoLimite> {
  const ventana = Math.floor(ahora / ventanaMs) * ventanaMs;
  const fila = await db
    .prepare(
      `INSERT INTO mcp_limites (clave, ventana, cuenta) VALUES (?, ?, 1)
       ON CONFLICT (clave, ventana) DO UPDATE SET cuenta = cuenta + 1
       RETURNING cuenta`,
    )
    .bind(clave, ventana)
    .first<{ cuenta: number }>();
  const cuenta = fila?.cuenta ?? max + 1; // sin respuesta: se niega (fail-closed)
  return {
    permitido: cuenta <= max,
    reintentarEnSeg: Math.max(1, Math.ceil((ventana + ventanaMs - ahora) / 1000)),
    cuenta,
  };
}

/** Mira el contador de la ventana SIN sumar (no escribe en D1). Fail-closed: si no responde, se considera lleno. */
export async function consultarLimite(
  db: D1Like, clave: string, max: number, ventanaMs: number, ahora: number = Date.now(),
): Promise<ResultadoLimite> {
  const ventana = Math.floor(ahora / ventanaMs) * ventanaMs;
  let cuenta = max;
  try {
    const f = await db.prepare("SELECT cuenta FROM mcp_limites WHERE clave = ? AND ventana = ?").bind(clave, ventana).first<{ cuenta: number }>();
    cuenta = f?.cuenta ?? 0;
  } catch {
    cuenta = max;
  }
  return { permitido: cuenta < max, reintentarEnSeg: Math.max(1, Math.ceil((ventana + ventanaMs - ahora) / 1000)), cuenta };
}

/** Borra ventanas viejas (llamar de vez en cuando). */
export async function limpiarLimites(db: D1Like, ahora: number = Date.now()): Promise<void> {
  await db.prepare("DELETE FROM mcp_limites WHERE ventana < ?").bind(ahora - 2 * 3600_000).run();
}
