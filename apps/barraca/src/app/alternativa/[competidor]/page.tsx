import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  COMPETIDORES_DATA,
  getCompetidor,
  getAllCompetidorSlugs,
} from "@/lib/competidores-data";
import TrustSignals, { COMPARACION_KPIS } from "@/components/TrustSignals";

/**
 * Comparison landing programática: /barraca/alternativa/[competidor].
 *
 * Estrategia SEO: capturar búsquedas de alta intención comercial donde el
 * usuario YA está evaluando comprar y compara opciones. El contenido es
 * honesto (no ataca al competidor) y enfatiza los diferenciales reales:
 * despacho local, mejor precio garantizado contra cotización, atención
 * por WhatsApp directo.
 *
 * IMPORTANT: ningún competidor real "patrocina" esta página. Las menciones
 * son comparativas de mercado, similar a "alternativa a X" landing pages
 * usadas en SaaS.
 */

export async function generateStaticParams() {
  return getAllCompetidorSlugs().map((competidor) => ({ competidor }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ competidor: string }>;
}): Promise<Metadata> {
  const { competidor } = await params;
  const data = getCompetidor(competidor);
  if (!data) return { title: "Alternativa no encontrada" };

  const url = `https://barraca.jurmaq.cl/alternativa/${data.slug}`;
  return {
    title: `Alternativa a ${data.nombre} en Curicó · Barraca JURMAQ Maule`,
    description: `¿Buscas una alternativa a ${data.nombre} para tu obra en el Maule? JURMAQ Barraca: despacho local desde Molina, mejor precio garantizado vs cotización, atención por WhatsApp directo. Curicó · Talca · Linares.`,
    keywords: [
      `alternativa a ${data.nombre.toLowerCase()}`,
      `como ${data.nombre.toLowerCase()} en Curicó`,
      `barraca tipo ${data.nombre.toLowerCase()} Maule`,
      `comprar mas barato que ${data.nombre.toLowerCase()}`,
      `${data.nombre.toLowerCase()} curico alternativa`,
      `barraca de fierros Curicó`,
      `materiales construccion Maule`,
    ],
    openGraph: {
      title: `Alternativa a ${data.nombre} en el Maule · JURMAQ Barraca`,
      description: `Despacho local desde Molina, mejor precio contra cotización, atención WhatsApp directa. Compara JURMAQ vs ${data.nombre}.`,
      url,
      siteName: "Barraca JURMAQ",
      locale: "es_CL",
      type: "article",
    },
    alternates: { canonical: url },
    robots: { index: true, follow: true },
  };
}

export default async function AlternativaPage({
  params,
}: {
  params: Promise<{ competidor: string }>;
}) {
  const { competidor } = await params;
  const data = getCompetidor(competidor);
  if (!data) notFound();

  const otrasAlternativas = COMPETIDORES_DATA.filter((c) => c.slug !== data.slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "FAQPage",
        mainEntity: data.faq.map((f) => ({
          "@type": "Question",
          name: f.pregunta,
          acceptedAnswer: { "@type": "Answer", text: f.respuesta },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Barraca JURMAQ", item: "https://barraca.jurmaq.cl" },
          { "@type": "ListItem", position: 2, name: "Alternativas", item: "https://barraca.jurmaq.cl/alternativa" },
          { "@type": "ListItem", position: 3, name: `Alternativa a ${data.nombre}`, item: `https://barraca.jurmaq.cl/alternativa/${data.slug}` },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="bg-white">
        <header className="bg-navy-950 text-white py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav aria-label="Breadcrumb" className="text-sm text-gray-500 mb-4">
              <Link href="/" className="hover:text-white">Barraca JURMAQ</Link>
              <span className="mx-2">›</span>
              <span className="text-white">Alternativa a {data.nombre}</span>
            </nav>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4">
              Alternativa a {data.nombre} en el Maule
            </h1>
            <p className="text-lg text-gray-200 max-w-3xl">
              ¿Buscas una alternativa a {data.nombre} para tu obra en Curicó, Talca o el Maule?
              JURMAQ Barraca: despacho local desde Molina, mejor precio garantizado contra
              cotización, atención por WhatsApp directo. Te explicamos las diferencias.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/cotizar"
                className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 px-6 py-3 rounded-lg font-bold transition-colors"
              >
                Cotizar mi pedido
              </Link>
              <Link
                href="/te-mejoramos-el-precio"
                className="inline-flex items-center gap-2 bg-transparent border-2 border-white hover:bg-white hover:text-navy-950 px-6 py-3 rounded-lg font-bold transition-colors"
              >
                Mejor precio garantizado
              </Link>
            </div>
          </div>
        </header>

        <TrustSignals variant="light" items={COMPARACION_KPIS} />

        <section className="py-12 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-navy-950 mb-4">¿Por qué considerar JURMAQ?</h2>
            <p className="text-gray-700 mb-6">
              {data.nombre} es una opción válida para tu obra: {data.descripcionCompetidor.toLowerCase()}{" "}
              JURMAQ Barraca es una alternativa local del Maule, especializada en materiales
              de obra, con despacho desde Molina y atención directa con la persona que arma
              tu cotización.
            </p>
            <p className="text-sm text-gray-500 italic">
              Esta comparación es honesta: cada operador tiene fortalezas. Lo siguiente describe
              dónde JURMAQ entrega más valor para una obra en el Maule.
            </p>
          </div>
        </section>

        <section className="py-12 bg-gray-50 border-t border-gray-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-navy-950 mb-8">
              JURMAQ vs {data.nombre}: comparación honesta
            </h2>
            <div className="space-y-6">
              {data.ventajas.map((v, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 bg-navy-950 text-white">
                    <h3 className="font-bold">{v.titulo}</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
                    <div className="p-6">
                      <div className="text-xs uppercase tracking-wider text-gray-500 mb-2 font-semibold">
                        {data.nombre}
                      </div>
                      <p className="text-sm text-gray-700">{v.competidor}</p>
                    </div>
                    <div className="p-6 bg-orange-50">
                      <div className="text-xs uppercase tracking-wider text-orange-700 mb-2 font-semibold">
                        JURMAQ Barraca
                      </div>
                      <p className="text-sm text-gray-800">{v.jurmaq}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 bg-white border-t border-gray-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-navy-950 mb-6">
              Productos más buscados donde somos competitivos
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.categoriasFuertes.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/categorias/${cat.slug}`}
                  className="flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-orange-50 hover:border-orange-300 border border-gray-200 rounded-lg transition-colors group"
                >
                  <span className="font-medium text-navy-950 group-hover:text-orange-700">
                    {cat.nombre}
                  </span>
                  <svg className="w-4 h-4 text-gray-500 group-hover:text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 bg-gray-50 border-t border-gray-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-navy-950 mb-8">Preguntas frecuentes</h2>
            <dl className="space-y-6">
              {data.faq.map((f, i) => (
                <div key={i}>
                  <dt className="font-semibold text-navy-950 mb-1">{f.pregunta}</dt>
                  <dd className="text-gray-700 text-sm">{f.respuesta}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="py-16 bg-orange-50 border-t border-orange-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-4">
              Compara con tu cotización de {data.nombre}
            </h2>
            <p className="text-gray-700 mb-8">
              ¿Tienes cotización de {data.nombre}? Súbela en menos de 1 minuto y te
              respondemos con un mejor precio en menos de 2 horas.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                href="/te-mejoramos-el-precio"
                className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-8 py-4 rounded-lg font-bold text-lg transition-colors"
              >
                Te mejoramos el precio
              </Link>
              <Link
                href="/cotizar"
                className="inline-flex items-center gap-2 bg-white border border-gray-300 hover:border-orange-500 text-navy-950 px-8 py-4 rounded-lg font-bold text-lg transition-colors"
              >
                Cotizar nuevo pedido
              </Link>
            </div>
          </div>
        </section>

        {otrasAlternativas.length > 0 && (
          <section className="py-12 bg-white border-t border-gray-200">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-xl font-bold text-navy-950 mb-4">Compara con otras opciones</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {otrasAlternativas.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/alternativa/${c.slug}`}
                    className="px-4 py-3 text-center bg-gray-50 hover:bg-orange-50 border border-gray-200 hover:border-orange-300 rounded-lg text-sm font-medium text-gray-700 hover:text-orange-700 transition-colors"
                  >
                    Alternativa a {c.nombre}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </article>
    </>
  );
}
