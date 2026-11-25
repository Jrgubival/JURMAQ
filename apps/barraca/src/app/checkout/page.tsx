import { pagoEnLineaDisponible } from "@/lib/pagos";
import { cuponesActivosEnCheckout } from "@/lib/cupones/pedidos";
import { pctTransferenciaActual } from "@/lib/pagos/descuento-config";
import CheckoutClient from "./CheckoutClient";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  // Los cupones solo aparecen con el interruptor encendido; sin él (o sin la base de gestión) el checkout queda como siempre.
  const cuponesActivos = await cuponesActivosEnCheckout();
  // El % de transferencia sale de la misma función que usa el servidor al cobrar (respaldo: 2%).
  const pctTransferencia = await pctTransferenciaActual();
  return <CheckoutClient pagoEnLinea={pagoEnLineaDisponible()} cuponesActivos={cuponesActivos} pctTransferencia={pctTransferencia} />;
}
