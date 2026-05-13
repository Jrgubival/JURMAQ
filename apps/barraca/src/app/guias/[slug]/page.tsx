import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GUIAS, getGuia } from "@/lib/guias-seo-data";

/**
 * pSEO landing — guías informacionales (qué es X, diferencia X vs Y, etc.).
 * Genera estáticamente una página por entrada en GUIAS de guias-seo-data.ts.
 *
 * Cada guía incluye: H1, intro, secciones H2 con HTML, FAQ schema,
 * BreadcrumbList y CTA al catálogo correspondiente. El contenido único
 * (mín. 600 palabras) evita penalty de thin content (pSEO playbook).
 */

export async function generateStaticParams() {
  return GUIAS.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guia = getGuia(slug);
  if (!guia) return { title: "Guía no encontrada" };
  return {
    title: `${guia.titulo} · Barraca JURMAQ`,
    description: guia.descripcionMeta,
    openGraph: {
      title: guia.titulo,
      description: guia.descripcionMeta,
      url: `https://barraca.jurmaq.cl/guias/${guia.slug}`,
      siteName: "Barraca JURMAQ",
      locale: "es_CL",
      type: "article",
    },
    alternates: {
      canonical: `https://barraca.jurmaq.cl/guias/${guia.slug}`,
    },
  };
}

export default async function GuiaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guia = getGuia(slug);
  if (!guia) notFound();

  // Build internal links to related guides
  const relacionadas = (guia.guiasRelacionadas ?? [])
    .map((s) => GUIAS.find((g) => g.slug === s))
    .filter((g): g is NonNullable<typeof g> => !!g);

  // Fechas estables: las guías son contenido evergreen. Usamos la fecha
  // de creación del repo como datePublished (proxy razonable mientras no
  // hay tabla de versionado de guías) y la build date como dateModified
  // (refleja despliegues/cambios menores).
  const datePublished = "2026-04-15";
  const dateModified = new Date().toISOString().slice(0, 10);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `https://barraca.jurmaq.cl/guias/${guia.slug}#article`,
        headline: guia.titulo,
        description: guia.descripcionMeta,
        image: "https://jurmaq.cl/icon-512.png",
        author: { "@type": "Organization", name: "JURMAQ Barraca" },
        publisher: { "@id": "https://jurmaq.cl/#organization" },
        url: `https://barraca.jurmaq.cl/guias/${guia.slug}`,
        datePublished,
        dateModified,
        inLanguage: "es-CL",
        articleSection: guia.categoriaNombre,
      },
      {
        "@type": "FAQPage",
        mainEntity: guia.faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Barraca JURMAQ", item: "https://barraca.jurmaq.cl" },
          { "@type": "ListItem", position: 2, name: "Guías", item: "https://barraca.jurmaq.cl/guias" },
          { "@type": "ListItem", position: 3, name: guia.titulo, item: `https://barraca.jurmaq.cl/guias/${guia.slug}` },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="bg-white">
        <header className="bg-navy-950 text-white py-12">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav aria-label="Breadcrumb" className="text-sm text-gray-400 mb-4">
              <Link href="/" className="hover:text-white">Barraca JURMAQ</Link>
              <span className="mx-2">›</span>
              <Link href="/guias" className="hover:text-white">Guías</Link>
              <span className="mx-2">›</span>
              <span className="text-white">{guia.titulo}</span>
            </nav>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4">
              {guia.h1}
            </h1>
          </div>
        </header>

        <section className="py-10">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 prose prose-lg prose-navy max-w-none">
            <p className="text-lg text-gray-700">{guia.intro}</p>

            {guia.secciones.map((s, i) => (
              <div key={i} className="mt-8">
                <h2 className="text-2xl font-bold text-navy-950 mb-4">{s.h2}</h2>
                <div
                  className="text-gray-700 [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:space-y-1 [&>p]:mb-3 [&_strong]:text-navy-950"
                  dangerouslySetInnerHTML={{ __html: s.html }}
                />
              </div>
            ))}
          </div>
        </section>

        {/* FAQ visible — apoya el FAQPage schema */}
        <section className="py-12 bg-gray-50 border-t border-gray-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-navy-950 mb-8">Preguntas frecuentes</h2>
            <dl className="space-y-6">
              {guia.faq.map((f, i) => (
                <div key={i}>
                  <dt className="font-semibold text-navy-950 mb-1">{f.q}</dt>
                  <dd className="text-gray-700 text-sm">{f.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Relacionadas — internal linking entre guías (cluster topical) */}
        {relacionadas.length > 0 && (
          <section className="py-10 border-t border-gray-200">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-xl font-bold text-navy-950 mb-4">Lecturas relacionadas</h2>
              <ul className="space-y-2">
                {relacionadas.map((r) => (
                  <li key={r.slug}>
                    <Link
                      href={`/guias/${r.slug}`}
                      className="text-orange-600 hover:text-orange-700 hover:underline"
                    >
                      {r.titulo}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* CTA al catálogo */}
        <section className="py-16 bg-orange-50 border-t border-orange-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-4">
              ¿Necesitas {guia.categoriaNombre.toLowerCase()} para tu obra?
            </h2>
            <p className="text-gray-700 mb-8">
              Cotiza con barraca JURMAQ y te despachamos a todo el Maule.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                href={`/categorias/${guia.categoriaSlugRelacionada}`}
                className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-8 py-4 rounded-lg font-bold text-lg transition-colors"
              >
                Ver catálogo {guia.categoriaNombre}
              </Link>
              <Link
                href="/cotizar"
                className="inline-flex items-center gap-2 bg-white border border-gray-300 hover:border-orange-500 text-navy-950 px-8 py-4 rounded-lg font-bold text-lg transition-colors"
              >
                Súbenos tu cotización
              </Link>
            </div>
          </div>
        </section>
      </article>
    </>
  );
}
