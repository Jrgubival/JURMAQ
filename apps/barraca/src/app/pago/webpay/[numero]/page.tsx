import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { pedidos, PATRON_NUMERO } from "@/lib/pedidos";
import { puedeVerPedido } from "@/lib/pedidos/enlace";
import { URL_FORMULARIO, entornoWebpay } from "@/lib/pagos/webpay";
import IrAWebpay from "./IrAWebpay";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pagar con Webpay", robots: { index: false, follow: false } };

/**
 * Paso hacia Webpay: Transbank pide abrir el pago con un formulario POST que
 * lleve el token (así el token no queda en la URL ni en el historial). Sólo
 * para quien tiene la cookie del pedido y mientras siga pendiente.
 */
export default async function IrAWebpayPage({ params }: { params: Promise<{ numero: string }> }) {
  const { numero } = await params;
  if (!PATRON_NUMERO.test(numero)) notFound();
  const pedido = await pedidos().porNumero(numero);
  const jar = await cookies();
  if (!pedido || !puedeVerPedido((n) => jar.get(n)?.value, pedido)) notFound();
  if (pedido.pasarela !== "webpay" || !pedido.pasarela_referencia) redirect(`/pedido/${numero}`);
  if (pedido.estado !== "pendiente_pago" && pedido.estado !== "pago_rechazado") redirect(`/pedido/${numero}`);

  return <IrAWebpay accion={URL_FORMULARIO[entornoWebpay()]} token={pedido.pasarela_referencia} total={pedido.total} />;
}
