import type { Metadata } from "next";
import Link from "next/link";
import { RECURSOS, CATEGORIA_LABEL, type RecursoCategoria } from "@/lib/recursos-data";

/**
 * Hub /recursos — index de guías informacionales para constructora.
 *
 * Agrupa por categoría para facilitar lectura (8 items hoy, crecerá).
 * Internal linking desde y hacia cada /recursos/[slug]. Aparece en sitemap
 * automáticamente vía RECURSOS const.
 */

export const metadata: Metadata = {
  title: "Recursos JURMAQ · Guías de Construcción y Arriendo",
  description:
    "Guías técnicas sobre arriendo de maquinaria, fundaciones, excavación y construcción en la Región del Maule. Precios, comparativas y respuestas reales.",
  keywords: [
    "guías maquinaria construcción",
    "arriendo retroexcavadora chile",
    "diferencias maquinaria pesada",
    "blog construcción JURMAQ",
    "recursos arriendo maquinaria Maule",
  ],
  openGraph: {
    title: "Recursos JURMAQ · Guías de Construcción y Arriendo",
    description:
      "Guías técnicas sobre arriendo de maquinaria, fundaciones, excavación y construcción en la Región del Maule.",
    url: "https://jurmaq.cl/recursos",
    siteName: "JURMAQ",
    locale: "es_CL",
    type: "website",
  },
  alternates: {
    canonical: "https://jurmaq.cl/recursos",
  },
};

const CATEGORIA_ORDER: RecursoCategoria[] = ['arriendo', 'maquinaria', 'construccion', 'tecnico'];

const CATEGORIA_DESCRIPCION: Record<RecursoCategoria, string> = {
  arriendo: 'Precios, modalidades, seguros y cómo cotizar arriendo de maquinaria pesada.',
  maquinaria: 'Comparativas y guías de equipos: retroexcavadoras, miniexcavadoras, minicargadores e implementos.',
  construccion: 'Fundaciones, movimiento de tierras y decisiones técnicas para tu obra.',
  tecnico: 'Cálculos, fórmulas, glosarios y referencias técnicas de obra.',
};

export default function RecursosIndexPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Blog",
        "@id": "https://jurmaq.cl/recursos#blog",
        name: "Recursos JURMAQ",
        description: "Guías técnicas sobre construcción y arriendo de maquinaria en Chile.",
        url: "https://jurmaq.cl/recursos",
        publisher: { "@id": "https://jurmaq.cl/#organization" },
        inLanguage: "es-CL",
        blogPost: RECURSOS.map((r) => ({
          "@type": "BlogPosting",
          headline: r.titulo,
          description: r.descripcionMeta,
          datePublished: r.fechaPublicacion,
          dateModified: r.fechaModificacion || r.fechaPublicacion,
          url: `https://jurmaq.cl/recursos/${r.slug}`,
          author: { "@type": "Organization", name: "JURMAQ" },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "JURMAQ", item: "https://jurmaq.cl" },
          { "@type": "ListItem", position: 2, name: "Recursos", item: "https://jurmaq.cl/recursos" },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="bg-white">
        <header className="bg-navy-950 text-white py-12 lg:py-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav aria-label="Breadcrumb" className="text-sm text-gray-400 mb-4">
              <Link href="/" className="hover:text-white">JURMAQ</Link>
              <span className="mx-2">›</span>
              <span className="text-white">Recursos</span>
            </nav>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4">
              Recursos JURMAQ · Guías y Conocimiento en Construcción y Maquinaria
            </h1>
            <p className="text-lg text-gray-200 max-w-3xl">
              Información técnica sobre arriendo de maquinaria pesada, fundaciones,
              excavación y obras civiles. Escrito por nuestro equipo en terreno,
              con datos reales de la Región del Maule.
            </p>
          </div>
        </header>

        <section className="py-12 lg:py-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
            {CATEGORIA_ORDER.map((cat) => {
              const items = RECURSOS.filter((r) => r.categoria === cat);
              if (items.length === 0) return null;
              return (
                <section key={cat}>
                  <div className="mb-6">
                    <span className="inline-block text-xs uppercase tracking-widest text-gold-600 font-bold mb-2">
                      {CATEGORIA_LABEL[cat]}
                    </span>
                    <h2 className="text-2xl font-bold text-navy-950 mb-2">{CATEGORIA_LABEL[cat]}</h2>
                    <p className="text-gray-600 max-w-2xl">{CATEGORIA_DESCRIPCION[cat]}</p>
                  </div>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {items.map((r) => (
                      <li key={r.slug}>
                        <Link
                          href={`/recursos/${r.slug}`}
                          className="block h-full p-6 bg-white border border-gray-200 hover:border-gold-500 rounded-xl transition-colors group"
                        >
                          <h3 className="text-lg font-bold text-navy-950 mb-2 group-hover:text-gold-700 transition-colors">
                            {r.titulo}
                          </h3>
                          <p className="text-sm text-gray-600 line-clamp-3 mb-3">{r.resumen}</p>
                          <span className="inline-flex items-center gap-1 text-sm font-semibold text-gold-700">
                            Leer guía
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </section>

        <section className="py-12 bg-gray-50 border-t border-gray-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl font-bold text-navy-950 mb-3">¿Necesitas arrendar maquinaria?</h2>
            <p className="text-gray-700 mb-6">
              Cotiza retroexcavadoras, miniexcavadoras, minicargadores y más con respuesta en menos de 2 horas hábiles.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                href="/maquinarias"
                className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-navy-950 px-6 py-3 rounded-lg font-bold transition-colors"
              >
                Ver catálogo
              </Link>
              <Link
                href="/cotizar-arriendo"
                className="inline-flex items-center gap-2 bg-white border border-gray-300 hover:border-gold-500 text-navy-950 px-6 py-3 rounded-lg font-bold transition-colors"
              >
                Cotizar ahora
              </Link>
            </div>
          </div>
        </section>
      </article>
    </>
  );
}
