import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Solicitar Cotización | Barraca JURMAQ",
  description:
    "Completa tus datos y solicita una cotización sin compromiso en Barraca JURMAQ. Despacho de materiales de construcción en Curicó, Teno, Molina y toda la Región del Maule.",
  robots: { index: false, follow: true },
  alternates: {
    canonical: "https://barraca.jurmaq.cl/cotizar",
  },
};

export default function CotizarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
