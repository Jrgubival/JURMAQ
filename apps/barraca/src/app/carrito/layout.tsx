import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Carrito | Barraca JURMAQ",
  description:
    "Revisa tu carrito y compra en línea en Barraca JURMAQ. Retiro en Molina o despacho en camión a Molina, Curicó, Talca y alrededores.",
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
