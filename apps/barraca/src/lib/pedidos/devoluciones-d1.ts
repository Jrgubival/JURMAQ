/**
 * Reserva EXCLUSIVA de la devolución de un pedido hecha por MCP (D1 `devoluciones_mcp`, migración 0011).
 * La clave primaria es el número de pedido: una sola fila por pedido PARA SIEMPRE. Es una de las dos guardas contra
 * una doble devolución; la otra es la del panel (`tomarReembolso` + el update condicional de `cancelar` en Supabase).
 */
import type { D1Like } from "../gestion/tipos.ts";

export type EstadoDevolucion =
  | "devolucion_reservada"
  | "devolucion_en_curso"
  | "devolucion_hecha"
  | "devolucion_rechazada"
  | "devolucion_incierta"
  | "transferencia_pendiente";

export interface FilaDevolucion {
  numero: string;
  estado: EstadoDevolucion;
  medio: "webpay" | "transferencia";
  monto: number;
  usuario_id: string;
  lote_id: string | null;
  creado_en: number;
  actualizado_en: number;
  detalle: string | null;
}

/** Estados en los que la devolución sigue «a medias»: nada más debe tocar el pedido hasta revisarlo. */
export const ESTADOS_A_MEDIAS: readonly EstadoDevolucion[] = ["devolucion_reservada", "devolucion_en_curso", "devolucion_incierta"];

export async function leerDevolucion(db: D1Like, numero: string): Promise<FilaDevolucion | null> {
  return db.prepare("SELECT * FROM devoluciones_mcp WHERE numero = ?").bind(numero).first<FilaDevolucion>();
}

/** Toma la reserva. `false` = ya existía una (de cualquier estado): NO se debe continuar. */
export async function reservarDevolucion(
  db: D1Like, d: { numero: string; medio: "webpay" | "transferencia"; monto: number; usuarioId: string; loteId?: string; ahora: number },
): Promise<boolean> {
  const r = await db
    .prepare(
      "INSERT OR IGNORE INTO devoluciones_mcp (numero, estado, medio, monto, usuario_id, lote_id, creado_en, actualizado_en) VALUES (?, 'devolucion_reservada', ?, ?, ?, ?, ?, ?)",
    )
    .bind(d.numero, d.medio, Math.round(d.monto), d.usuarioId, d.loteId ?? null, d.ahora, d.ahora)
    .run();
  return (r.meta?.changes ?? 0) > 0;
}

/**
 * Cambia el estado solo si la fila sigue en uno de `desde` (transición atómica). Devuelve true si cambió.
 */
export async function pasarDevolucion(
  db: D1Like, numero: string, desde: readonly EstadoDevolucion[], hacia: EstadoDevolucion, ahora: number, detalle?: string,
): Promise<boolean> {
  const marcas = desde.map(() => "?").join(", ");
  const r = await db
    .prepare(`UPDATE devoluciones_mcp SET estado = ?, actualizado_en = ?, detalle = COALESCE(?, detalle) WHERE numero = ? AND estado IN (${marcas})`)
    .bind(hacia, ahora, detalle ?? null, numero, ...desde)
    .run();
  return (r.meta?.changes ?? 0) > 0;
}

/** Suelta la reserva SOLO si todavía no se hizo nada (estado «reservada»): el pedido no se canceló. */
export async function soltarReserva(db: D1Like, numero: string): Promise<boolean> {
  const r = await db.prepare("DELETE FROM devoluciones_mcp WHERE numero = ? AND estado = 'devolucion_reservada'").bind(numero).run();
  return (r.meta?.changes ?? 0) > 0;
}

export const TEXTO_ESTADO_DEVOLUCION: Record<EstadoDevolucion, string> = {
  devolucion_reservada: "una devolución quedó reservada a medias (el proceso se cortó antes de cancelar)",
  devolucion_en_curso: "hay una devolución en curso (o se cortó a medias)",
  devolucion_hecha: "la devolución ya está hecha",
  devolucion_rechazada: "Webpay rechazó la devolución (no se devolvió dinero)",
  devolucion_incierta: "Webpay no confirmó si devolvió el dinero",
  transferencia_pendiente: "la devolución por transferencia está pendiente en el panel",
};
