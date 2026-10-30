import type { Metadata } from "next";
import DocumentoLegal, { leerDocumento, tieneMarcas } from "@/components/barraca/DocumentoLegal";

// Texto de los abogados (src/content/legal/privacidad.md). Se arma al compilar.
export const dynamic = "force-static";

export function generateMetadata(): Metadata {
  const borrador = tieneMarcas(leerDocumento("privacidad"));
  return {
    title: "Política de Privacidad · Barraca JURMAQ",
    description: "Política de Privacidad de la tienda online de Barraca de Fierros JURMAQ SpA, Molina.",
    alternates: { canonical: "https://barraca.jurmaq.cl/privacidad" },
    // Mientras sea borrador (con datos por completar) no se indexa.
    robots: borrador ? { index: false, follow: true } : undefined,
  };
}

export default function Page() {
  return <DocumentoLegal nombre="privacidad" />;
}
