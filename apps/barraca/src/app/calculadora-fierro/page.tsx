import type { Metadata } from "next";
import Link from "next/link";
import CalculadoraFierroClient from "./CalculadoraFierroClient";
import RelatedCalculadoras from "@/components/barraca/RelatedCalculadoras";
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';

/**
 * pSEO landing — calculadora de quintales de fierro para losa, sobrelosa,
 * muros y radier. Captura busquedas informacionales como "cuanto fierro
 * lleva una losa de 100 m2", "cuantos quintales de fierro por m2", etc.
 *
 * Diseño: HowTo schema + FAQPage + tabla de cuantias tipicas (chilenas) +
 * calculadora interactiva. La calculadora client-side hace el calculo;
 * el contenido server-rendered da el SEO.
 */

export const metadata: Metadata = {
  title: "Calculadora de Fierro para Losa, Muros y Radier · JURMAQ Barraca",
  description:
    "Calcula cuántos quintales de fierro necesitas para tu obra: losa, sobrelosa, muros de hormigón armado, radier. Cuantías típicas chilenas (kg/m²). Cotiza en barraca.jurmaq.cl con despacho a todo el Maule.",
  keywords: [
    "calculadora fierro",
    "cuantos quintales de fierro por m2",
    "cuantos kilos de fierro por m2",
    "calculadora cuantia fierro losa",
    "cuanto fierro lleva una losa",
    "cuanto fierro lleva un muro hormigón armado",
    "calculadora fierro radier",
    "calculadora hormigón armado",
    "barraca de fierros Curicó",
    "comprar fierro Maule",
  ],
  openGraph: {
    title: "Calculadora de Fierro para Construcción · Quintales por m²",
    description:
      "Calcula los quintales de fierro que necesitas para tu losa, muro o radier. Cotiza con barraca JURMAQ y te despachamos a todo el Maule.",
    url: "https://barraca.jurmaq.cl/calculadora-fierro",
    siteName: "Barraca JURMAQ",
    locale: "es_CL",
    type: "website",
  },
  alternates: {
    canonical: "https://barraca.jurmaq.cl/calculadora-fierro",
  },
};

/**
 * Cuantías típicas chilenas (kg de fierro por m² o m³ de hormigón).
 * Source: NCh 433/2009 (sismorresistencia) + NCh 430 + tablas DOM
 * habituales para vivienda 1-2 pisos. Los valores son aproximaciones
 * para una primera estimación — el cálculo definitivo SIEMPRE lo hace
 * el calculista estructural del proyecto.
 *
 * Conversion: 1 quintal = 46 kg.
 */
export const ELEMENTOS_FIERRO = [
  {
    slug: "losa",
    nombre: "Losa de hormigón armado",
    descripcion:
      "Losa estructural de entrepiso o cubierta de hormigón armado, espesor típico 12-15 cm.",
    cuantiaKgPorM2: 12, // kg/m² para losa de 12 cm
    notas: "Cuantía típica para losa de 12 cm (vivienda 1-2 pisos). Para losas de 15 cm sube a ~16 kg/m².",
  },
  {
    slug: "sobrelosa",
    nombre: "Sobrelosa",
    descripcion: "Capa adicional de hormigón sobre losa existente, refuerzo o nivelación.",
    cuantiaKgPorM2: 5,
    notas: "Refuerzo malla #4 a 15×15 cm aprox. Verificar con calculista si la sobrelosa es estructural.",
  },
  {
    slug: "radier",
    nombre: "Radier",
    descripcion: "Piso de hormigón en contacto directo con el terreno, 8-10 cm de espesor.",
    cuantiaKgPorM2: 4,
    notas: "Generalmente lleva malla Acma C92 o C188. Si hay tránsito vehicular, sube cuantía a ~7 kg/m².",
  },
  {
    slug: "muro-hormigon-armado",
    nombre: "Muro de hormigón armado",
    descripcion: "Muro estructural perimetral o medianera de hormigón armado, espesor 15-20 cm.",
    cuantiaKgPorM2: 18,
    notas: "Para muro de 15 cm. Muros de subterráneo o gran altura pueden requerir cuantía 25-35 kg/m².",
  },
  {
    slug: "fundacion-corrida",
    nombre: "Fundación corrida",
    descripcion: "Cimiento corrido bajo muros perimetrales, sección 30×40 cm típica.",
    cuantiaKgPorM2: 8, // por metro lineal (aprox)
    notas: "Calculado por metro lineal de fundación, no m². 4 fierros longitudinales Ø10 + estribos Ø8 a 20 cm.",
  },
  {
    slug: "viga",
    nombre: "Viga de hormigón armado",
    descripcion: "Viga de amarre o estructural, sección típica 20×30 cm.",
    cuantiaKgPorM2: 10, // por metro lineal aprox
    notas: "Calculado por metro lineal. Cuantía depende de luz libre y carga.",
  },
] as const;

export default function CalculadoraFierroPage() {
  // JSON-LD: HowTo + FAQPage + BreadcrumbList
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "HowTo",
        name: "Cómo calcular cuántos quintales de fierro necesitas para tu obra",
        description:
          "Pasos para estimar la cantidad de fierro corrugado en quintales para losas, muros, radier y fundaciones de hormigón armado.",
        totalTime: "PT5M",
        step: [
          {
            "@type": "HowToStep",
            position: 1,
            name: "Identifica el elemento estructural",
            text: "Define qué vas a hormigonar: losa, sobrelosa, muro, radier, fundación o viga.",
          },
          {
            "@type": "HowToStep",
            position: 2,
            name: "Mide el área (m² o metros lineales)",
            text: "Para losas y muros usa m². Para fundaciones corridas y vigas usa metros lineales.",
          },
          {
            "@type": "HowToStep",
            position: 3,
            name: "Aplica la cuantía típica",
            text: "Multiplica el área por los kg/m² del elemento (ver tabla). Ej: losa 100 m² × 12 kg/m² = 1.200 kg.",
          },
          {
            "@type": "HowToStep",
            position: 4,
            name: "Convierte a quintales",
            text: "Divide el total de kg por 46 (1 quintal = 46 kg). Ej: 1.200 kg / 46 ≈ 26 quintales.",
          },
          {
            "@type": "HowToStep",
            position: 5,
            name: "Suma 5-10% de pérdida",
            text: "Considera pérdida por traslapes, despuntes y errores de corte. Pide siempre 5-10% extra.",
          },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "¿Cuántos quintales de fierro lleva una losa de 100 m²?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Una losa de 12 cm de espesor lleva aproximadamente 12 kg/m² de fierro. Para 100 m² son 1.200 kg, equivalentes a 26 quintales (1 quintal = 46 kg). Suma 5-10% por pérdidas y traslapes.",
            },
          },
          {
            "@type": "Question",
            name: "¿Qué cuantía de fierro lleva un muro de hormigón armado?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Un muro de hormigón armado de 15 cm de espesor lleva típicamente 18 kg/m². Para muros de subterráneo o de gran altura puede subir a 25-35 kg/m². Verificar con calculista estructural.",
            },
          },
          {
            "@type": "Question",
            name: "¿Cuánto pesa un quintal de fierro?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Un quintal de fierro corrugado equivale a 46 kg. Es la unidad de venta tradicional en barracas chilenas. Por ejemplo, 10 quintales = 460 kg.",
            },
          },
          {
            "@type": "Question",
            name: "¿Qué fierro se usa para una losa?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Las losas de vivienda típicamente usan fierro estriado A630-420H Ø8 mm o Ø10 mm en doble capa, o malla Acma C92/C188. El calculista define el diámetro y separación según luz libre y cargas.",
            },
          },
          {
            "@type": "Question",
            name: "¿Despachan fierro al Maule?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Sí. JURMAQ Barraca despacha fierro estriado, perfiles, mallas Acma y +1.600 productos a todo el Maule desde Molina. Curicó en 30 min, Talca en 1h, despacho coordinado para obras grandes.",
            },
          },
        ],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Barraca JURMAQ", item: "https://barraca.jurmaq.cl" },
          { "@type": "ListItem", position: 2, name: "Calculadoras", item: "https://barraca.jurmaq.cl/calculadoras" },
          { "@type": "ListItem", position: 3, name: "Calculadora de fierro", item: "https://barraca.jurmaq.cl/calculadora-fierro" },
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
              <Link href="/calculadoras" className="hover:text-white">Calculadoras</Link>
              <span className="mx-2">›</span>
              <span className="text-white">Calculadora de fierro</span>
            </nav>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4">
              Calculadora de Fierro para Construcción
            </h1>
            <p className="text-lg text-gray-200 max-w-3xl">
              Estima los quintales de fierro corrugado que necesitas para tu losa, muro,
              radier o fundación. Cuantías típicas chilenas según NCh 430/433.
            </p>
          </div>
        </header>

        <CalculadoraFierroClient elementos={ELEMENTOS_FIERRO} />

        <section className="py-12 bg-gray-50 border-t border-gray-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-navy-950 mb-6">Cuantías típicas (kg/m²)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm bg-white border border-gray-200 rounded-lg">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Elemento</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">Cuantía típica</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {ELEMENTOS_FIERRO.map((e) => (
                    <tr key={e.slug} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-medium text-navy-950">{e.nombre}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{e.cuantiaKgPorM2} kg/m²</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{e.notas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Valores referenciales para vivienda de 1-2 pisos en zona sísmica chilena.
              El cálculo estructural definitivo lo realiza el ingeniero calculista del
              proyecto según NCh 430:2008 (Hormigón armado) y NCh 433:2009 (Diseño sísmico).
              1 quintal = 46 kg.
            </p>
          </div>
        </section>

        <section className="py-12 bg-white border-t border-gray-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-navy-950 mb-8">Preguntas frecuentes</h2>
            <dl className="space-y-6">
              <div>
                <dt className="font-semibold text-navy-950 mb-1">
                  ¿Cuántos quintales de fierro lleva una losa de 100 m²?
                </dt>
                <dd className="text-gray-700 text-sm">
                  Una losa de 12 cm de espesor lleva ~12 kg/m². Para 100 m² son 1.200 kg = 26 quintales
                  (1 quintal = 46 kg). Suma 5-10% por pérdidas y traslapes.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-navy-950 mb-1">
                  ¿Qué cuantía lleva un muro de hormigón armado?
                </dt>
                <dd className="text-gray-700 text-sm">
                  Muro de 15 cm: ~18 kg/m². Subterráneos o muros altos pueden subir a 25-35 kg/m².
                  Verificar con calculista.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-navy-950 mb-1">¿Cuánto pesa un quintal de fierro?</dt>
                <dd className="text-gray-700 text-sm">
                  46 kg. Es la unidad de venta tradicional en barracas chilenas.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-navy-950 mb-1">¿Qué fierro se usa para losa?</dt>
                <dd className="text-gray-700 text-sm">
                  Típicamente fierro estriado A630-420H Ø8/Ø10 mm en doble capa, o malla Acma C92/C188.
                  El calculista define diámetro y separación.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-navy-950 mb-1">¿Despachan fierro al Maule?</dt>
                <dd className="text-gray-700 text-sm">
                  Sí. Despachamos desde Molina a todo el Maule: Curicó (30 min), Talca (1h), Linares y
                  más. <Link href="/categorias/fierros" className="text-orange-600 hover:underline">
                    Ver catálogo de fierros
                  </Link>.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <RelatedCalculadoras currentSlug="calculadora-fierro" />

        {/* CTA final */}
        <section className="py-16 bg-orange-50 border-t border-orange-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-4">
              ¿Ya sabes cuántos quintales necesitas?
            </h2>
            <p className="text-gray-700 mb-8">
              Cotiza tu pedido con barraca JURMAQ. Te respondemos con precio y despacho coordinado a tu obra.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                href="/cotizar"
                className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-8 py-4 rounded-lg font-bold text-lg transition-colors"
              >
                Cotizar mi pedido
              </Link>
              <Link
                href="/categorias/fierros"
                className="inline-flex items-center gap-2 bg-white border border-gray-300 hover:border-orange-500 text-navy-950 px-8 py-4 rounded-lg font-bold text-lg transition-colors"
              >
                Ver catálogo
              </Link>
            </div>
          </div>
        </section>
      </article>
    </>
  );
}
