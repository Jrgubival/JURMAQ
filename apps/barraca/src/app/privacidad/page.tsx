import { metaPaginaDefecto } from "@/lib/seo-editable/defecto";
import { metaConSeo } from "@/lib/seo-editable/lectura";
import type { Metadata } from "next";
import DocumentoLegal, { leerDocumento, tieneMarcas } from "@/components/barraca/DocumentoLegal";

// Texto de los abogados: el publicado en D1 o, si no hay, src/content/legal/privacidad.md
// (embebido en código). Se regenera cada 5 minutos y al publicar contenido: así un
// deploy nuevo no deja mucho tiempo un texto viejo. Sigue siendo una página estática en caché.
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const borrador = tieneMarcas(await leerDocumento("privacidad"));
  const textos = metaPaginaDefecto("privacidad");
  return metaConSeo<Metadata>("pagina", "privacidad", {
    title: textos.titulo,
    description: textos.descripcion,
    alternates: { canonical: "https://barraca.jurmaq.cl/privacidad" },
    // Mientras sea borrador (con datos por completar) no se indexa.
    robots: borrador ? { index: false, follow: true } : undefined,
  });
}

export default function Page() {
  return <DocumentoLegal nombre="privacidad" />;
}
