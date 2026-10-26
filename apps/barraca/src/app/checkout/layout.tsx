import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Finalizar compra | Barraca JURMAQ",
  description:
    "Datos de compra, entrega y pago en Barraca JURMAQ. Retiro en Molina o despacho a coordinar en Curicó, Talca y toda la Región del Maule.",
  robots: { index: false, follow: false },
  alternates: {
    canonical: "https://barraca.jurmaq.cl/checkout",
  },
};

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
