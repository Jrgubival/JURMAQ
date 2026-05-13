import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Iniciar sesión | Barraca JURMAQ",
  description:
    "Inicia sesión en tu cuenta de Barraca JURMAQ para gestionar tus cotizaciones y pedidos.",
  robots: { index: false, follow: false },
  alternates: {
    canonical: "https://barraca.jurmaq.cl/cuenta/login",
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
