import type { Metadata } from "next";
import Link from "next/link";
import CalculadoraPinturaClient from "./CalculadoraPinturaClient";
import RelatedCalculadoras from "@/components/barraca/RelatedCalculadoras";

export const metadata: Metadata = {
  title: "Calculadora de Pintura · Litros y Galones por m² · JURMAQ Barraca",
  description:
    "Calcula los litros o galones de pintura que necesitas según m² de muro o fachada. Rendimientos reales para látex, esmalte, óleo y pintura de fachada. Cotiza con JURMAQ Barraca.",
  keywords: [
    "calculadora pintura",
    "cuantos galones de pintura por m2",
    "cuantos litros de pintura por m2",
    "rendimiento pintura latex",
    "calculadora pintura fachada",
    "calculadora pintura interior",
    "barraca pintura Curicó",
    "comprar pintura Maule",
  ],
  openGraph: {
    title: "Calculadora de Pintura · Litros por m² para Muros, Fachada e Interior",
    description: "Estima los litros de pintura para tu obra según m² y tipo. Despachamos a todo el Maule.",
    url: "https://barraca.jurmaq.cl/calculadora-pintura",
    siteName: "Barraca JURMAQ",
    locale: "es_CL",
    type: "website",
  },
  alternates: {
    canonical: "https://barraca.jurmaq.cl/calculadora-pintura",
  },
};

/**
 * Rendimientos típicos en m²/L por mano según tipo de pintura y soporte.
 * Los rendimientos varían con porosidad del muro, color base y técnica de
 * aplicación. Estos valores son referencia para una primera estimación.
 */
export const TIPOS_PINTURA = [
  {
    slug: "latex-interior",
    nombre: "Látex interior",
    descripcion: "Pintura látex acrílica para muros y cielos interiores.",
    rendimientoM2PorL: 11,
    manosRecomendadas: 2,
    notas: "Para muros lisos pintados antes. En muro nuevo o cambio de color sumar mano de imprimante.",
  },
  {
    slug: "latex-exterior",
    nombre: "Látex exterior / Fachada",
    descripcion: "Látex acrílico de exterior con resistencia UV y filtros.",
    rendimientoM2PorL: 8,
    manosRecomendadas: 2,
    notas: "Sumar 1 mano de fijador en muros nuevos o muy porosos. Aplicar entre 10°C y 30°C.",
  },
  {
    slug: "esmalte-al-agua",
    nombre: "Esmalte al agua (puertas, marcos)",
    descripcion: "Esmalte sintético base agua para puertas, marcos, molduras.",
    rendimientoM2PorL: 13,
    manosRecomendadas: 2,
    notas: "Lijar entre manos. En madera nueva sumar imprimante o sellador de poros.",
  },
  {
    slug: "oleo-fierro",
    nombre: "Pintura óleo / esmalte sintético",
    descripcion: "Esmalte sintético solvente para fierro, rejas, perfiles metálicos.",
    rendimientoM2PorL: 14,
    manosRecomendadas: 2,
    notas: "Antes aplicar antióxido en metal. Diluir levemente con aguarrás si va con pistola.",
  },
  {
    slug: "techo-cielo",
    nombre: "Pintura para cielo / techumbre",
    descripcion: "Látex para cielo de yeso-cartón o estuco.",
    rendimientoM2PorL: 10,
    manosRecomendadas: 2,
    notas: "Color blanco mate típico. Para cielos amarillentos por humedad usar fijador antimancha.",
  },
] as const;

export default function CalculadoraPinturaPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "HowTo",
        name: "Cómo calcular cuántos litros de pintura necesitas",
        description: "Pasos para estimar litros o galones de pintura según m² y tipo.",
        totalTime: "PT3M",
        step: [
          { "@type": "HowToStep", position: 1, name: "Mide los m²", text: "Suma área de todos los muros (largo × alto). Resta puertas y ventanas grandes." },
          { "@type": "HowToStep", position: 2, name: "Elige el tipo de pintura", text: "Látex interior, exterior, esmalte al agua, óleo o cielo." },
          { "@type": "HowToStep", position: 3, name: "Aplica el rendimiento", text: "Divide los m² por el rendimiento en m²/L. Ej: 80 m² ÷ 11 m²/L = 7.3 L." },
          { "@type": "HowToStep", position: 4, name: "Multiplica por las manos", text: "Generalmente 2 manos. Ej: 7.3 L × 2 = 14.6 L." },
          { "@type": "HowToStep", position: 5, name: "Suma 10% extra", text: "Pérdida por brochazos, retoques y limpieza de herramientas." },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "¿Cuánto rinde un galón de pintura látex?",
            acceptedAnswer: { "@type": "Answer", text: "Un galón (3.78 L) de látex interior rinde aproximadamente 40 m² por mano. Si das 2 manos cubre 20 m². Para fachada el rendimiento baja a ~30 m² por mano." },
          },
          {
            "@type": "Question",
            name: "¿Cuántos litros de pintura para una pieza de 12 m²?",
            acceptedAnswer: { "@type": "Answer", text: "Una pieza de 12 m² (3×4) tiene aprox 35 m² de muro (sin descontar puertas). Con látex interior a 2 manos necesitas ~6.5 L. Recomendamos comprar 8 L para retoques." },
          },
          {
            "@type": "Question",
            name: "¿Cuántas manos de pintura aplicar?",
            acceptedAnswer: { "@type": "Answer", text: "Generalmente 2 manos. En cambio de color radical (oscuro a claro) puede requerir 3 manos o aplicar imprimante. Lijar entre manos en esmaltes." },
          },
          {
            "@type": "Question",
            name: "¿Despachan pintura al Maule?",
            acceptedAnswer: { "@type": "Answer", text: "Sí. JURMAQ despacha látex Sherwin-Williams, Soquina y otras marcas a todo el Maule desde Molina." },
          },
        ],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Barraca JURMAQ", item: "https://barraca.jurmaq.cl" },
          { "@type": "ListItem", position: 2, name: "Calculadoras", item: "https://barraca.jurmaq.cl/calculadoras" },
          { "@type": "ListItem", position: 3, name: "Calculadora de pintura", item: "https://barraca.jurmaq.cl/calculadora-pintura" },
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
            <nav aria-label="Breadcrumb" className="text-sm text-gray-400 mb-4">
              <Link href="/" className="hover:text-white">Barraca JURMAQ</Link>
              <span className="mx-2">›</span>
              <Link href="/calculadoras" className="hover:text-white">Calculadoras</Link>
              <span className="mx-2">›</span>
              <span className="text-white">Calculadora de pintura</span>
            </nav>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4">
              Calculadora de Pintura por m²
            </h1>
            <p className="text-lg text-gray-200 max-w-3xl">
              Estima los litros (o galones) de pintura para tu pieza, fachada o cielo
              según m² y tipo. Rendimientos reales para látex, esmalte y óleo.
            </p>
          </div>
        </header>

        <CalculadoraPinturaClient tipos={TIPOS_PINTURA} />

        <section className="py-12 bg-gray-50 border-t border-gray-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-navy-950 mb-6">Rendimientos típicos (m²/L por mano)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm bg-white border border-gray-200 rounded-lg">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Tipo</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">Rendimiento</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">Manos</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {TIPOS_PINTURA.map((t) => (
                    <tr key={t.slug} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-medium text-navy-950">{t.nombre}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{t.rendimientoM2PorL} m²/L</td>
                      <td className="px-4 py-3 text-right text-gray-700">{t.manosRecomendadas}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{t.notas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Rendimientos típicos según fichas técnicas de fabricantes (Sherwin, Soquina,
              Tricolor). Varían según porosidad del muro, color y técnica de aplicación.
              1 galón ≈ 3.78 litros.
            </p>
          </div>
        </section>

        <section className="py-12 bg-white border-t border-gray-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-navy-950 mb-8">Preguntas frecuentes</h2>
            <dl className="space-y-6">
              <div>
                <dt className="font-semibold text-navy-950 mb-1">¿Cuánto rinde un galón de látex?</dt>
                <dd className="text-gray-700 text-sm">
                  ~40 m² por mano interior, ~30 m² fachada. Para 2 manos divide a la mitad.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-navy-950 mb-1">¿Cuánto para una pieza de 12 m²?</dt>
                <dd className="text-gray-700 text-sm">
                  ~35 m² de muro (sin restar puertas). Látex 2 manos: ~6.5 L. Comprar 8 L para retoques.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-navy-950 mb-1">¿Cuántas manos aplicar?</dt>
                <dd className="text-gray-700 text-sm">
                  2 manos general. 3 manos o imprimante para cambio radical de color.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-navy-950 mb-1">¿Despachan pintura al Maule?</dt>
                <dd className="text-gray-700 text-sm">
                  Sí. Sherwin-Williams, Soquina y otras marcas desde Molina.{" "}
                  <Link href="/categorias/pinturas" className="text-orange-600 hover:underline">
                    Ver catálogo de pinturas
                  </Link>.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <RelatedCalculadoras currentSlug="calculadora-pintura" />

        <section className="py-16 bg-orange-50 border-t border-orange-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-4">
              ¿Listo para pintar?
            </h2>
            <p className="text-gray-700 mb-8">
              Cotiza tu pintura con barraca JURMAQ. Marcas líderes con despacho al Maule.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link href="/cotizar" className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-8 py-4 rounded-lg font-bold text-lg transition-colors">
                Cotizar mi pedido
              </Link>
              <Link href="/categorias/pinturas" className="inline-flex items-center gap-2 bg-white border border-gray-300 hover:border-orange-500 text-navy-950 px-8 py-4 rounded-lg font-bold text-lg transition-colors">
                Ver catálogo
              </Link>
            </div>
          </div>
        </section>
      </article>
    </>
  );
}
