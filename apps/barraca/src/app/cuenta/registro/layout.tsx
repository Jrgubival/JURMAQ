import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Crear cuenta | Barraca JURMAQ",
  description:
    "Crea tu cuenta en Barraca JURMAQ para solicitar cotizaciones y gestionar tus pedidos de materiales de construccion.",
  robots: { index: false, follow: false },
  alternates: {
    canonical: "https://barraca.jurmaq.cl/cuenta/registro",
  },
};

export default function RegistroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
