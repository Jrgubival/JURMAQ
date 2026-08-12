import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { whatsappCtaHome } from "@jurmaq/shared/whatsapp";
import { IconWhatsapp } from "@jurmaq/shared/icons";
import WhatsappLink from "@/components/public/WhatsappLink";
import { RECURSOS, getRecurso, CATEGORIA_LABEL } from "@/lib/recursos-data";
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';

/**
 * pSEO landing — recursos informacionales para constructora.
 *
 * Genera estáticamente una página por entrada en RECURSOS de recursos-data.ts.
 * Incluye H1, intro (resumen), secciones H2 con HTML, FAQ visible + schema,
 * BreadcrumbList y CTA al catálogo / WhatsApp.
 */

export async function generateStaticParams() {
  return RECURSOS.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const recurso = getRecurso(slug);
  if (!recurso) return { title: "Recurso no encontrado · JURMAQ" };

  return {
    title: `${recurso.titulo} · JURMAQ`,
    description: recurso.descripcionMeta,
    keywords: recurso.keywordsObjetivo,
    openGraph: {
      title: recurso.titulo,
      description: recurso.descripcionMeta,
      url: `https://jurmaq.cl/recursos/${recurso.slug}`,
      siteName: "JURMAQ",
      locale: "es_CL",
      type: "article",
      publishedTime: recurso.fechaPublicacion,
      modifiedTime: recurso.fechaModificacion || recurso.fechaPublicacion,
      authors: ["JURMAQ"],
    },
    alternates: {
      canonical: `https://jurmaq.cl/recursos/${recurso.slug}`,
    },
  };
}

export default async function RecursoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const recurso = getRecurso(slug);
  if (!recurso) notFound();

  // Build internal links to related resources
  const relacionados = (recurso.relacionados ?? [])
    .map((s) => RECURSOS.find((r) => r.slug === s))
    .filter((r): r is NonNullable<typeof r> => !!r);

  const imageUrl = recurso.imagenHero
    ? `https://jurmaq.cl${recurso.imagenHero}`
    : "https://jurmaq.cl/icon-512.png";

  const dateModified = recurso.fechaModificacion || recurso.fechaPublicacion;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `https://jurmaq.cl/recursos/${recurso.slug}#article`,
        headline: recurso.titulo,
        description: recurso.descripcionMeta,
        image: imageUrl,
        author: { "@type": "Organization", name: "JURMAQ", url: "https://jurmaq.cl" },
        publisher: { "@id": "https://jurmaq.cl/#organization" },
        url: `https://jurmaq.cl/recursos/${recurso.slug}`,
        datePublished: recurso.fechaPublicacion,
        dateModified,
        inLanguage: "es-CL",
        articleSection: CATEGORIA_LABEL[recurso.categoria],
        keywords: recurso.keywordsObjetivo.join(", "),
      },
      {
        "@type": "FAQPage",
        mainEntity: recurso.faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "JURMAQ", item: "https://jurmaq.cl" },
          { "@type": "ListItem", position: 2, name: "Recursos", item: "https://jurmaq.cl/recursos" },
          {
            "@type": "ListItem",
            position: 3,
            name: recurso.titulo,
            item: `https://jurmaq.cl/recursos/${recurso.slug}`,
          },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />

      <article className="bg-white">
        <header className="bg-navy-950 text-white py-12 lg:py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav aria-label="Breadcrumb" className="text-sm text-gray-400 mb-4">
              <Link href="/" className="hover:text-white">JURMAQ</Link>
              <span className="mx-2">›</span>
              <Link href="/recursos" className="hover:text-white">Recursos</Link>
              <span className="mx-2">›</span>
              <span className="text-white">{CATEGORIA_LABEL[recurso.categoria]}</span>
            </nav>
            <span className="inline-block text-xs uppercase tracking-widest text-gold-400 font-bold mb-3">
              {CATEGORIA_LABEL[recurso.categoria]}
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4">{recurso.h1}</h1>
            <p className="text-lg text-gray-200">{recurso.resumen}</p>
          </div>
        </header>

        <section className="py-10 lg:py-12">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            {recurso.secciones.map((s, i) => (
              <div key={i} className="mt-8 first:mt-0">
                <h2 className="text-2xl font-bold text-navy-950 mb-4">{s.h2}</h2>
                <div
                  className="text-gray-700 leading-relaxed [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:space-y-1 [&>ol]:list-decimal [&>ol]:pl-6 [&>ol]:space-y-1 [&>p]:mb-3 [&_strong]:text-navy-950 [&_table]:my-4 [&_table]:text-sm"
                  dangerouslySetInnerHTML={{ __html: s.html }}
                />
              </div>
            ))}
          </div>
        </section>

        {/* FAQ visible — refuerza el FAQPage schema */}
        <section className="py-12 bg-gray-50 border-t border-gray-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-navy-950 mb-8">Preguntas frecuentes</h2>
            <dl className="space-y-6">
              {recurso.faq.map((f, i) => (
                <div key={i}>
                  <dt className="font-semibold text-navy-950 mb-1">{f.q}</dt>
                  <dd className="text-gray-700 text-sm leading-relaxed">{f.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Relacionados — internal linking entre recursos (cluster topical) */}
        {relacionados.length > 0 && (
          <section className="py-10 border-t border-gray-200">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-xl font-bold text-navy-950 mb-4">Lecturas relacionadas</h2>
              <ul className="space-y-2">
                {relacionados.map((r) => (
                  <li key={r.slug}>
                    <Link
                      href={`/recursos/${r.slug}`}
                      className="text-gold-700 hover:text-gold-800 hover:underline"
                    >
                      {r.titulo}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* CTA final — WhatsApp + Cotizar online */}
        <section className="py-16 bg-navy-950 text-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              ¿Necesitas cotizar arriendo de maquinaria?
            </h2>
            <p className="text-gray-200 mb-8 max-w-2xl mx-auto">
              Respondemos en menos de 2 horas hábiles. Cotiza por WhatsApp con respuesta humana o usa el cotizador online del catálogo.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <WhatsappLink
                href={whatsappCtaHome()}
                source={`recurso_${recurso.slug}`}
                className="inline-flex items-center gap-2 bg-gold-500 hover:bg-gold-400 text-navy-950 px-6 py-3 rounded-lg font-bold transition-colors"
              >
                <IconWhatsapp className="w-5 h-5" />
                WhatsApp
              </WhatsappLink>
              <Link
                href="/maquinarias"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/30 text-white px-6 py-3 rounded-lg font-bold transition-colors"
              >
                Ver catálogo
              </Link>
              <Link
                href="/cotizar-arriendo"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/30 text-white px-6 py-3 rounded-lg font-bold transition-colors"
              >
                Cotizar online
              </Link>
            </div>
          </div>
        </section>
      </article>
    </>
  );
}
