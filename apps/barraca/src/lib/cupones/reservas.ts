import type { D1Like } from "../gestion/tipos.ts";
import { idUuid } from "../gestion/util.ts";

/**
 * Reserva atómica de usos de cupón (tabla cupon_usos, D1 de gestión).
 *
 * Por qué así: los pedidos viven en Supabase y los usos en D1, dos sistemas sin
 * transacción común. Para que dos pedidos simultáneos no pasen el tope:
 *  1. ANTES de crear el pedido se reserva el uso con UN solo INSERT ... SELECT
 *     condicionado a los topes (D1 ejecuta una sentencia a la vez: o entra o no).
 *  2. Se crea el pedido y se asigna su número a la reserva (`asignarPedido`).
 *  3. Si el pedido falla, se libera (`liberarReserva`). Si el proceso muere en
 *     medio, la reserva vence sola a los pocos minutos (vencimiento perezoso).
 *  4. Al pagarse el pedido se confirma; al cancelarse o vencer, se libera
 *     (ganchos en lib/pedidos/index.ts → ./pedidos.ts).
 * Una reserva cuenta para los topes mientras esté 'confirmada' o 'reservada' sin vencer.
 */

export const TTL_RESERVA_INICIAL_MS = 10 * 60_000;
/** Pago en línea abandonado: la reserva libera el cupo a las 2 horas. */
export const TTL_RESERVA_WEBPAY_MS = 2 * 3600_000;
/** Transferencia: el plazo es de 48 h (Términos 8.3) más los días de revisión. Los ganchos la liberan antes si se cancela o vence. */
export const TTL_RESERVA_TRANSFERENCIA_MS = 7 * 24 * 3600_000;

export interface PedidoReserva {
  cuponId: string;
  emailHash: string;
  rutHash: string | null;
  descuento: number;
  montoCompra: number;
  metodoPago: string;
  /** Tope total efectivo (ya descontando usos antiguos); null = sin tope. */
  maxTotal: number | null;
  /** Usos por cliente; 0 = sin límite. */
  maxPorCliente: number;
  ahora?: number;
}

export type ResultadoReserva =
  | { ok: true; reservaId: string }
  | { ok: false; motivo: "agotado" | "ya_usado" };

// Cuentan los usos confirmados y las reservas todavía vigentes.
const VIGENTE = `(estado = 'confirmada' OR (estado = 'reservada' AND expira_en > ?))`;

export async function reservarUsoCupon(db: D1Like, p: PedidoReserva): Promise<ResultadoReserva> {
  const ahora = p.ahora ?? Date.now();
  const id = idUuid();
  const maxTotal = p.maxTotal === null ? null : Math.max(0, Math.floor(p.maxTotal));
  const fila = await db
    .prepare(
      `INSERT INTO cupon_usos (id, cupon_id, estado, pedido_numero, email_hash, rut_hash, descuento, monto_compra, metodo_pago, creado_en, expira_en)
       SELECT ?, ?, 'reservada', NULL, ?, ?, ?, ?, ?, ?, ?
       WHERE (? IS NULL OR (SELECT COUNT(*) FROM cupon_usos WHERE cupon_id = ? AND ${VIGENTE}) < ?)
         AND (? <= 0 OR (SELECT COUNT(*) FROM cupon_usos WHERE cupon_id = ? AND ${VIGENTE}
              AND (email_hash = ? OR (? IS NOT NULL AND rut_hash = ?))) < ?)
       RETURNING id`,
    )
    .bind(
      id, p.cuponId, p.emailHash, p.rutHash, Math.round(p.descuento), Math.round(p.montoCompra), p.metodoPago, ahora, ahora + TTL_RESERVA_INICIAL_MS,
      maxTotal, p.cuponId, ahora, maxTotal,
      p.maxPorCliente, p.cuponId, ahora, p.emailHash, p.rutHash, p.rutHash, p.maxPorCliente,
    )
    .first<{ id: string }>();
  if (fila?.id) return { ok: true, reservaId: fila.id };

  // No entró: ¿fue el tope por cliente o el total? (solo para el mensaje; la decisión ya está tomada)
  const c = await contarUsos(db, p.cuponId, ahora, { emailHash: p.emailHash, rutHash: p.rutHash });
  if (p.maxPorCliente > 0 && c.cliente >= p.maxPorCliente) return { ok: false, motivo: "ya_usado" };
  return { ok: false, motivo: "agotado" };
}

export interface ConteoUsos {
  total: number;
  cliente: number;
}

export async function contarUsos(
  db: D1Like,
  cuponId: string,
  ahora: number,
  cliente?: { emailHash: string; rutHash: string | null },
): Promise<ConteoUsos> {
  const t = await db
    .prepare(`SELECT COUNT(*) AS n FROM cupon_usos WHERE cupon_id = ? AND ${VIGENTE}`)
    .bind(cuponId, ahora)
    .first<{ n: number }>();
  let c = 0;
  if (cliente) {
    const r = await db
      .prepare(
        `SELECT COUNT(*) AS n FROM cupon_usos WHERE cupon_id = ? AND ${VIGENTE} AND (email_hash = ? OR (? IS NOT NULL AND rut_hash = ?))`,
      )
      .bind(cuponId, ahora, cliente.emailHash, cliente.rutHash, cliente.rutHash)
      .first<{ n: number }>();
    c = Number(r?.n ?? 0);
  }
  return { total: Number(t?.n ?? 0), cliente: c };
}

/** Asigna el número del pedido a la reserva y fija su vencimiento según el método de pago. */
export async function asignarPedido(
  db: D1Like,
  reservaId: string,
  numero: string,
  metodoPago: string,
  ahora = Date.now(),
): Promise<boolean> {
  const ttl = metodoPago === "transferencia" ? TTL_RESERVA_TRANSFERENCIA_MS : TTL_RESERVA_WEBPAY_MS;
  const r = await db
    .prepare("UPDATE cupon_usos SET pedido_numero = ?, expira_en = ?, metodo_pago = ? WHERE id = ? AND estado = 'reservada'")
    .bind(numero, ahora + ttl, metodoPago, reservaId)
    .run();
  return (r.meta?.changes ?? 0) === 1;
}

/** El pedido se pagó: el uso queda confirmado (aunque la reserva ya hubiera vencido: el cliente pagó con el descuento). */
export async function confirmarUsoDePedido(db: D1Like, numero: string, ahora = Date.now()): Promise<boolean> {
  const r = await db
    .prepare("UPDATE cupon_usos SET estado = 'confirmada', confirmado_en = ? WHERE pedido_numero = ? AND estado = 'reservada'")
    .bind(ahora, numero)
    .run();
  return (r.meta?.changes ?? 0) > 0;
}

/** El pedido se canceló, venció o fue rechazado: el uso deja de contar. Idempotente. */
export async function liberarUsoDePedido(db: D1Like, numero: string, motivo: string, ahora = Date.now()): Promise<boolean> {
  const r = await db
    .prepare("UPDATE cupon_usos SET estado = 'liberada', liberado_en = ?, motivo_liberacion = ? WHERE pedido_numero = ? AND estado != 'liberada'")
    .bind(ahora, motivo, numero)
    .run();
  return (r.meta?.changes ?? 0) > 0;
}

/** El pedido no se pudo crear: se suelta la reserva. */
export async function liberarReserva(db: D1Like, reservaId: string, motivo: string, ahora = Date.now()): Promise<boolean> {
  const r = await db
    .prepare("UPDATE cupon_usos SET estado = 'liberada', liberado_en = ?, motivo_liberacion = ? WHERE id = ? AND estado = 'reservada'")
    .bind(ahora, motivo, reservaId)
    .run();
  return (r.meta?.changes ?? 0) > 0;
}
