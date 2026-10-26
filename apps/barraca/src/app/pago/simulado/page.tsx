import { notFound } from "next/navigation";
import { env } from "@jurmaq/shared/env";
import { esProduccion } from "@/lib/pedidos";
import PagoSimuladoClient from "./PagoSimuladoClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pago de prueba", robots: { index: false, follow: false } };

/** Pasarela simulada (sólo desarrollo con PAGO_PASARELA=simulado). */
export default async function PagoSimuladoPage({ searchParams }: { searchParams: Promise<{ pedido?: string }> }) {
  if (env.PAGO_PASARELA !== "simulado" || esProduccion()) notFound();
  const { pedido } = await searchParams;
  if (!pedido) notFound();
  return <PagoSimuladoClient numero={pedido} />;
}
