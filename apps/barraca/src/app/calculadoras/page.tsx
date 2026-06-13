import type { Metadata } from "next";
import Link from "next/link";
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';

export const metadata: Metadata = {
  title: "Calculadoras de Materiales · Fierro, Cemento, Hormigón, Pintura, Zincalum · JURMAQ",
  description:
    "Calculadoras gratuitas para tu obra: fierro por m², sacos de cemento, dosificación de hormigón, litros de pintura, planchas de zincalum. Cuantías y dosificaciones chilenas según NCh.",
  keywords: [
    "calculadora construccion",
    "calculadora materiales obra",
    "calculadora cuantia fierro",
    "calculadora hormigon armado",
    "calculadora pintura m2",
    "calculadora zincalum techumbre",
    "barraca herramientas Curicó",
  ],
  openGraph: {
    title: "Calculadoras de Materiales para tu Obra · JURMAQ Barraca",
    description:
      "5 calculadoras gratuitas: fierro, cemento, hormigón, pintura y zincalum. Dosificaciones chilenas NCh.",
    url: "https://barraca.jurmaq.cl/calculadoras",
    siteName: "Barraca JURMAQ",
    locale: "es_CL",
    type: "website",
  },
  alternates: {
    canonical: "https://barraca.jurmaq.cl/calculadoras",
  },
};

const CALCULADORAS = [
  {
    slug: "calculadora-fierro",
    titulo: "Calculadora de Fierro",
    descripcion: "Cuántos quintales necesitas para losa, muro, radier, fundación o viga. Cuantías NCh 430.",
    busquedasComunes: ["cuantos quintales fierro losa", "cuantia fierro m2", "kg fierro por m2"],
    color: "from-red-500 to-orange-600",
  },
  {
    slug: "calculadora-cemento",
    titulo: "Calculadora de Cemento",
    descripcion: "Sacos de 25 kg para radier, contrapiso, sobrelosa, estuco o poyo. Dosificaciones por elemento.",
    busquedasComunes: ["cuantos sacos cemento m2", "cemento por radier", "calculo estuco"],
    color: "from-gray-500 to-gray-700",
  },
  {
    slug: "calculadora-hormigon",
    titulo: "Calculadora de Hormigón",
    descripcion: "Cemento + arena + gravilla + agua para H5/H15/H20/H25/H30. Mezcla en obra para no estructural.",
    busquedasComunes: ["dosificacion hormigon H20", "sacos m3 hormigon", "arena gravilla por m3"],
    color: "from-stone-500 to-stone-700",
  },
  {
    slug: "calculadora-pintura",
    titulo: "Calculadora de Pintura",
    descripcion: "Litros de látex, esmalte u óleo según m². Rendimientos reales para fachada e interior.",
    busquedasComunes: ["litros pintura por m2", "rendimiento latex", "galones pintura fachada"],
    color: "from-blue-500 to-blue-700",
  },
  {
    slug: "calculadora-zincalum",
    titulo: "Calculadora de Zincalum",
    descripcion: "Planchas + tornillería para tu techumbre. Ondulada, Trapezoidal 5V/7V o tipo teja.",
    busquedasComunes: ["cuantas planchas zincalum m2", "tornillos por plancha", "techumbre por m2"],
    color: "from-amber-500 to-amber-700",
  },
] as const;

export default function CalculadorasIndexPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ItemList",
        name: "Calculadoras de Materiales JURMAQ",
        itemListElement: CALCULADORAS.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: c.titulo,
          url: `https://barraca.jurmaq.cl/${c.slug}`,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Barraca JURMAQ", item: "https://barraca.jurmaq.cl" },
          { "@type": "ListItem", position: 2, name: "Calculadoras", item: "https://barraca.jurmaq.cl/calculadoras" },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />

      <article className="bg-white">
        <header className="bg-navy-950 text-white py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav aria-label="Breadcrumb" className="text-sm text-gray-500 mb-4">
              <Link href="/" className="hover:text-white">Barraca JURMAQ</Link>
              <span className="mx-2">›</span>
              <span className="text-white">Calculadoras</span>
            </nav>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4">
              Calculadoras de Materiales
            </h1>
            <p className="text-lg text-gray-200 max-w-3xl">
              5 calculadoras gratuitas para estimar materiales de tu obra: fierro,
              cemento, hormigón, pintura y zincalum. Cuantías y dosificaciones
              referenciales según norma chilena (NCh 170, NCh 430, NCh 433).
            </p>
          </div>
        </header>

        <section className="py-12 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CALCULADORAS.map((c) => (
                <Link
                  key={c.slug}
                  href={`/${c.slug}`}
                  className="group block bg-gray-50 hover:bg-white border border-gray-200 hover:border-orange-300 rounded-xl overflow-hidden transition-all hover:shadow-lg"
                >
                  <div className={`h-2 bg-gradient-to-r ${c.color}`} />
                  <div className="p-6">
                    <h2 className="text-xl font-bold text-navy-950 group-hover:text-orange-700 mb-2">
                      {c.titulo}
                    </h2>
                    <p className="text-sm text-gray-600 mb-4 leading-relaxed">{c.descripcion}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {c.busquedasComunes.map((b) => (
                        <span
                          key={b}
                          className="inline-flex px-2 py-0.5 text-[10px] font-medium bg-white border border-gray-200 text-gray-500 rounded"
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-orange-700 group-hover:gap-2 transition-all">
                      Abrir calculadora
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 bg-gray-50 border-t border-gray-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-xl font-bold text-navy-950 mb-4">¿Cómo se usan?</h2>
            <div className="prose prose-sm text-gray-700 max-w-none">
              <p>
                Cada calculadora pide datos básicos (m², espesor, tipo de elemento) y
                entrega una estimación con dosificaciones chilenas referenciales:
              </p>
              <ul>
                <li>
                  <strong>Fierro:</strong> NCh 430 (Hormigón armado) y NCh 433 (Diseño sísmico).
                  Cuantías típicas para vivienda 1-2 pisos.
                </li>
                <li>
                  <strong>Cemento y hormigón:</strong> NCh 170 (Hormigón. Requisitos generales).
                  Sacos de 25 kg estándar barraca chilena.
                </li>
                <li>
                  <strong>Pintura:</strong> rendimientos típicos de fabricantes chilenos
                  (Sherwin-Williams, Soquina, Tricolor) según tipo de soporte y exposición.
                </li>
                <li>
                  <strong>Zincalum:</strong> medidas comerciales chilenas (ancho útil, largo
                  estándar, perfiles ondulada/trapezoidal/teja) + tornillería 6.3 mm × 35 mm.
                </li>
              </ul>
              <p className="text-xs text-gray-500 mt-4">
                <strong>Importante:</strong> el cálculo definitivo de elementos estructurales
                (losas, vigas, muros, fundaciones) lo hace el calculista del proyecto. Estas
                herramientas son para una primera estimación de compra y planificación de obra.
              </p>
            </div>
          </div>
        </section>

        <section className="py-16 bg-orange-50 border-t border-orange-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-4">
              Cotiza con tus números
            </h2>
            <p className="text-gray-700 mb-8">
              Una vez que tengas tu estimación, súbela a nuestro formulario de cotización
              y te respondemos con precio y despacho coordinado en menos de 2 horas.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                href="/cotizar"
                className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-8 py-4 rounded-lg font-bold text-lg transition-colors"
              >
                Cotizar mi pedido
              </Link>
              <Link
                href="/categorias"
                className="inline-flex items-center gap-2 bg-white border border-gray-300 hover:border-orange-500 text-navy-950 px-8 py-4 rounded-lg font-bold text-lg transition-colors"
              >
                Ver catálogo completo
              </Link>
            </div>
          </div>
        </section>
      </article>
    </>
  );
}
