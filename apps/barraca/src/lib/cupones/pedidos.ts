import { usarGestion } from "../gestion/d1.ts";
import { confirmarUsoDePedido, liberarUsoDePedido } from "./reservas.ts";
import { leerInterruptorCupones } from "./interruptor.ts";

/**
 * Ganchos del ciclo de vida del pedido (los llama lib/pedidos/index.ts).
 * Son "mejor esfuerzo": nunca rompen un pago ni una cancelación. Si la D1 no
 * está o falla, la reserva vence sola (vencimiento perezoso, ver reservas.ts).
 */

function avisar(donde: string, e: unknown) {
  // Sin datos personales: solo el lugar y el tipo de error.
  console.error(`[cupones-${donde}]`, e instanceof Error ? e.name : "error");
}

/** El pedido se pagó (Webpay o transferencia confirmada): el uso del cupón queda firme. */
export async function cuponPedidoPagado(numero: string): Promise<void> {
  try {
    await usarGestion((db) => confirmarUsoDePedido(db, numero));
  } catch (e) {
    avisar("confirmar", e);
  }
}

/** El pedido se canceló, venció o fue rechazado: el uso del cupón se libera. */
export async function cuponPedidoCerrado(numero: string, motivo: string): Promise<void> {
  try {
    await usarGestion((db) => liberarUsoDePedido(db, numero, motivo));
  } catch (e) {
    avisar("liberar", e);
  }
}

/** ¿Se muestran los cupones en el checkout? Cualquier fallo = no (apagado por defecto). */
export async function cuponesActivosEnCheckout(): Promise<boolean> {
  try {
    return await usarGestion((db) => leerInterruptorCupones(db));
  } catch {
    return false;
  }
}
