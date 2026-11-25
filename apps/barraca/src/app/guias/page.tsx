import { metaPaginaDefecto } from "@/lib/seo-editable/defecto";
import { metaConSeo } from "@/lib/seo-editable/lectura";
import type { Metadata } from "next";
import Link from "@/components/barraca/Enlace";
import { leerGuiasEfectivas } from "@/lib/seo-editable/lectura";
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';

/**
 * Hub /barraca/guias — index de las guías programáticas. Internal linking
 * desde y hacia cada /guias/[slug]. Aparece en sitemap automáticamente.
 */

// El texto de título y descripción puede venir de D1 (SEO editable): se regenera cada hora y al publicar.
export const revalidate = 3600;

const metadataCodigo: Metadata = {
  title: metaPaginaDefecto("guias").titulo,
  description: metaPaginaDefecto("guias").descripcion,
  alternates: {
    canonical: "https://barraca.jurmaq.cl/guias",
  },
};

// El texto propio guardado (si lo hay) reemplaza título y descripción; sin él, idéntico a siempre.
export async function generateMetadata(): Promise<Metadata> {
  return metaConSeo<Metadata>("pagina", "guias", metadataCodigo);
}

export default async function GuiasIndexPage() {
  // Guías de código con las publicadas desde la gestión encima (sin nada publicado: las de siempre).
  const GUIAS = await leerGuiasEfectivas();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: "Guías de Construcción JURMAQ",
        description: "Guías técnicas sobre materiales de construcción para tu obra.",
        url: "https://barraca.jurmaq.cl/guias",
        hasPart: GUIAS.map((g) => ({
          "@type": "Article",
          headline: g.titulo,
          url: `https://barraca.jurmaq.cl/guias/${g.slug}`,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Barraca JURMAQ", item: "https://barraca.jurmaq.cl" },
          { "@type": "ListItem", position: 2, name: "Guías", item: "https://barraca.jurmaq.cl/guias" },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <article className="bg-white">
        <header className="bg-navy-950 text-white py-12">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav aria-label="Breadcrumb" className="text-sm text-gray-500 mb-4">
              <Link href="/" className="hover:text-white">Barraca JURMAQ</Link>
              <span className="mx-2">›</span>
              <span className="text-white">Guías</span>
            </nav>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4">
              Guías de Construcción
            </h1>
            <p className="text-lg text-gray-200 max-w-3xl">
              Información técnica sobre materiales de construcción para tu obra:
              fierros, mallas, cementos y más. Escrito por nuestro equipo de barraca.
            </p>
          </div>
        </header>

        <section className="py-12">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {GUIAS.map((g) => (
                <li key={g.slug}>
                  <Link
                    href={`/guias/${g.slug}`}
                    className="block p-6 bg-white border border-gray-200 hover:border-marca-500 rounded-xl transition-colors"
                  >
                    <h2 className="text-lg font-bold text-navy-950 mb-2">{g.titulo}</h2>
                    <p className="text-sm text-gray-600 line-clamp-3">{g.descripcionMeta}</p>
                    <span className="inline-block mt-3 text-sm font-semibold text-marca-600">
                      Leer guía →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </article>
    </>
  );
}
