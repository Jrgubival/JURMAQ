import type { Metadata } from "next";
import BajaCliente from "./BajaCliente";

export const metadata: Metadata = {
  title: "Dejar de recibir correos · Barraca JURMAQ",
  robots: { index: false, follow: false },
};

export default async function BajaPage({
  params,
  searchParams,
}: {
  params: Promise<{ huella: string }>;
  searchParams: Promise<{ o?: string }>;
}) {
  const { huella } = await params;
  const { o } = await searchParams;
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-navy-950 mb-3">Dejar de recibir correos</h1>
      <p className="text-gray-600 mb-6">
        No te enviaremos más novedades, ofertas ni recordatorios por correo. Los correos de tus
        pedidos (confirmación y estado) te seguirán llegando.
      </p>
      <BajaCliente huella={huella} origen={typeof o === "string" ? o : null} />
    </div>
  );
}
