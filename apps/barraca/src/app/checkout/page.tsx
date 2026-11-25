import { pagoEnLineaDisponible } from "@/lib/pagos";
import { cuponesActivosEnCheckout } from "@/lib/cupones/pedidos";
import CheckoutClient from "./CheckoutClient";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  // Los cupones solo aparecen con el interruptor encendido; sin él (o sin la base de gestión) el checkout queda como siempre.
  const cuponesActivos = await cuponesActivosEnCheckout();
  return <CheckoutClient pagoEnLinea={pagoEnLineaDisponible()} cuponesActivos={cuponesActivos} />;
}
