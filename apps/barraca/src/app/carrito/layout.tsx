import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mi cotización | Barraca JURMAQ",
  description:
    "Revisa los productos de tu cotización y pide tu precio con descuento en Barraca JURMAQ. Materiales de construccion con despacho en Curico, Teno, Molina y toda la Region del Maule.",
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
