import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Carrito de Compras | Barraca JURMAQ",
  description:
    "Revisa los productos en tu carrito y solicita tu cotizacion en Barraca JURMAQ. Materiales de construccion con despacho en Curico, Teno, Molina y toda la Region del Maule.",
  robots: { index: false, follow: true },
  alternates: {
    canonical: "https://barraca.jurmaq.cl/carrito",
  },
};

export default function CarritoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
