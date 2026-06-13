import type { Metadata } from "next";
import Link from "next/link";
import CalculadoraZincalumClient from "./CalculadoraZincalumClient";
import RelatedCalculadoras from "@/components/barraca/RelatedCalculadoras";
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';

export const metadata: Metadata = {
  title: "Calculadora de Planchas Zincalum · Cuántas Planchas para tu Techumbre · JURMAQ",
  description:
    "Calcula cuántas planchas de zincalum (ondulada o trapezoidal) necesitas para tu techumbre. Largos 2.0 a 6.0 m, espesores 0.35-0.6 mm. Tornillería incluida en el cálculo. Despachamos a todo el Maule.",
  keywords: [
    "calculadora zincalum",
    "cuantas planchas de zincalum por m2",
    "calculadora techumbre",
    "calculadora plancha ondulada",
    "calculadora zincalum trapezoidal",
    "barraca zincalum Curicó",
    "comprar zincalum Maule",
    "tornillos para zincalum",
  ],
  openGraph: {
    title: "Calculadora de Planchas Zincalum por m² · Ondulada y Trapezoidal",
    description:
      "Estima planchas zincalum + tornillos para tu techumbre. Despachamos a todo el Maule desde Molina.",
    url: "https://barraca.jurmaq.cl/calculadora-zincalum",
    siteName: "Barraca JURMAQ",
    locale: "es_CL",
    type: "website",
  },
  alternates: {
    canonical: "https://barraca.jurmaq.cl/calculadora-zincalum",
  },
};

/**
 * Tipos de plancha más vendidos en Chile. Anchos útiles (después de
 * traslapes laterales). Largos comerciales típicos: 2.0, 2.5, 3.0, 3.66
 * (12 pies) y 6.0 m. Tomamos largo de 3.66 m como referencia para el
 * cálculo (es el más frecuente en barraca).
 */
export const TIPOS_PLANCHA = [
  {
    slug: "ondulada",
    nombre: "Ondulada",
    descripcion: "Onda sinusoidal. Económica, residencial, anexos.",
    anchoUtilM: 0.84,
    largoEstandarM: 3.66,
    notas: "Después de descontar traslape lateral (~5 cm). Inclinación mínima 14°.",
  },
  {
    slug: "trapezoidal-5v",
    nombre: "Trapezoidal 5V",
    descripcion: "5 trapecios. Más rígida que ondulada, residencial e industrial.",
    anchoUtilM: 0.89,
    largoEstandarM: 3.66,
    notas: "Inclinación mínima 8°. Perfila el agua mejor que ondulada.",
  },
  {
    slug: "trapezoidal-7v",
    nombre: "Trapezoidal 7V",
    descripcion: "7 trapecios. Industrial, naves grandes, alto viento.",
    anchoUtilM: 1.06,
    largoEstandarM: 6.0,
    notas: "Mejor relación rigidez/peso. Para galpones y techumbres extensas.",
  },
  {
    slug: "tipo-teja",
    nombre: "Tipo teja",
    descripcion: "Imita teja cerámica. Decorativa, residencial alto estándar.",
    anchoUtilM: 1.07,
    largoEstandarM: 3.66,
    notas: "Más cara que ondulada/trapezoidal. Considerar peso para estructura.",
  },
] as const;

/**
 * Tornillería: aprox 8-10 tornillos autoperforantes 6.3 mm × 35 mm por
 * plancha estándar 3.66 m, para fijación a costanera. Para 6 m subir a
 * 12-14 por plancha.
 */
const TORNILLOS_POR_PLANCHA_366 = 9;
const TORNILLOS_POR_PLANCHA_6M = 13;
const FACTOR_PERDIDA = 1.07;

export default function CalculadoraZincalumPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "HowTo",
        name: "Cómo calcular cuántas planchas de zincalum necesitas",
        description:
          "Pasos para estimar planchas zincalum y tornillería para techumbre residencial o industrial.",
        totalTime: "PT4M",
        step: [
          { "@type": "HowToStep", position: 1, name: "Mide el área de techumbre", text: "Calcula los m² de proyección horizontal × factor de pendiente. Para techo a dos aguas con 22° suma ~10% por la pendiente." },
          { "@type": "HowToStep", position: 2, name: "Elige el tipo de plancha", text: "Ondulada (residencial), Trapezoidal 5V/7V (industrial), tipo teja (decorativa)." },
          { "@type": "HowToStep", position: 3, name: "Calcula ancho útil", text: "Es el ancho cubierto efectivamente después de descontar traslape lateral. Ej: ondulada útil ~0.84 m." },
          { "@type": "HowToStep", position: 4, name: "Calcula planchas", text: "Divide los m² por (ancho útil × largo plancha). Suma 7% por pérdidas y traslapes longitudinales." },
          { "@type": "HowToStep", position: 5, name: "Suma tornillería", text: "9 tornillos autoperforantes 6.3 × 35 mm por plancha estándar de 3.66 m. Sube a 13 si la plancha es de 6 m." },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "¿Cuántas planchas de zincalum por m² necesito?",
            acceptedAnswer: { "@type": "Answer", text: "Aproximadamente 1 plancha por cada 3 m² de techumbre con ondulada de 3.66 m (ancho útil 0.84 m × largo 3.66 m = 3.07 m² cubiertos). Suma 7% por pérdidas y traslapes longitudinales." },
          },
          {
            "@type": "Question",
            name: "¿Cuántos tornillos van por plancha de zincalum?",
            acceptedAnswer: { "@type": "Answer", text: "Para plancha de 3.66 m: aproximadamente 9 tornillos autoperforantes 6.3 × 35 mm con golilla EPDM. Para plancha de 6 m: 12-14 tornillos. Siempre con golilla de goma para impermeabilizar la perforación." },
          },
          {
            "@type": "Question",
            name: "¿Qué espesor de plancha elegir?",
            acceptedAnswer: { "@type": "Answer", text: "0.5 mm es el estándar residencial. 0.4 mm es aceptable para anexos económicos pero suena más con la lluvia y se deforma fácil. 0.6 mm es industrial, alto viento o techumbre transitable." },
          },
          {
            "@type": "Question",
            name: "¿Cuánto traslape longitudinal va entre planchas?",
            acceptedAnswer: { "@type": "Answer", text: "Mínimo 15 cm para techumbre de pendiente moderada (14°+). En pendientes bajas (8-13°) usar trapezoidal y traslape de 20-25 cm con sellado butyl." },
          },
          {
            "@type": "Question",
            name: "¿Despachan zincalum al Maule?",
            acceptedAnswer: { "@type": "Answer", text: "Sí. JURMAQ Barraca despacha planchas zincalum (ondulada, trapezoidal, tipo teja) en largos hasta 6 m a todo el Maule desde Molina. Curicó en 30 min, Talca en 1h." },
          },
        ],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Barraca JURMAQ", item: "https://barraca.jurmaq.cl" },
          { "@type": "ListItem", position: 2, name: "Calculadoras", item: "https://barraca.jurmaq.cl/calculadoras" },
          { "@type": "ListItem", position: 3, name: "Calculadora de zincalum", item: "https://barraca.jurmaq.cl/calculadora-zincalum" },
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
              <span className="text-white">Calculadora de zincalum</span>
            </nav>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4">
              Calculadora de Planchas Zincalum
            </h1>
            <p className="text-lg text-gray-200 max-w-3xl">
              Estima planchas + tornillería para tu techumbre según m² y tipo de perfil.
              Ondulada, Trapezoidal 5V/7V o tipo teja. Largos hasta 6 m.
            </p>
          </div>
        </header>

        <CalculadoraZincalumClient
          tipos={TIPOS_PLANCHA}
          tornillos366={TORNILLOS_POR_PLANCHA_366}
          tornillos6m={TORNILLOS_POR_PLANCHA_6M}
          factorPerdida={FACTOR_PERDIDA}
        />

        <section className="py-12 bg-gray-50 border-t border-gray-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-navy-950 mb-6">Tipos de plancha más vendidos</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm bg-white border border-gray-200 rounded-lg">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Tipo</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">Ancho útil</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">Largo estándar</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {TIPOS_PLANCHA.map((p) => (
                    <tr key={p.slug} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-medium text-navy-950">{p.nombre}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{p.anchoUtilM} m</td>
                      <td className="px-4 py-3 text-right text-gray-700">{p.largoEstandarM} m</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{p.notas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Anchos útiles ya descuentan traslape lateral. Tornillería estándar:
              autoperforante 6.3 × 35 mm con golilla EPDM (impermeabiliza). 9 tornillos
              por plancha 3.66 m, 13 por plancha de 6 m.
            </p>
          </div>
        </section>

        <section className="py-12 bg-white border-t border-gray-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-navy-950 mb-8">Preguntas frecuentes</h2>
            <dl className="space-y-6">
              <div>
                <dt className="font-semibold text-navy-950 mb-1">¿Cuántas planchas por m²?</dt>
                <dd className="text-gray-700 text-sm">
                  Aproximadamente 1 cada 3 m² con ondulada 3.66 m. Suma 7% por pérdidas.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-navy-950 mb-1">¿Cuántos tornillos por plancha?</dt>
                <dd className="text-gray-700 text-sm">
                  9 para 3.66 m, 13 para 6 m. Siempre 6.3 × 35 mm con golilla EPDM.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-navy-950 mb-1">¿Qué espesor recomiendan?</dt>
                <dd className="text-gray-700 text-sm">
                  0.5 mm residencial estándar. 0.6 mm industrial. Más sobre tipos en{" "}
                  <Link href="/guias/que-es-zincalum" className="text-orange-600 hover:underline">
                    nuestra guía de zincalum
                  </Link>.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-navy-950 mb-1">¿Despachan al Maule?</dt>
                <dd className="text-gray-700 text-sm">
                  Sí. Planchas hasta 6 m a Curicó, Talca, Linares y resto del Maule.{" "}
                  <Link href="/categorias/planchas-techumbre" className="text-orange-600 hover:underline">
                    Ver catálogo de planchas
                  </Link>.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <RelatedCalculadoras currentSlug="calculadora-zincalum" />

        <section className="py-16 bg-orange-50 border-t border-orange-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-4">
              ¿Listo para techar?
            </h2>
            <p className="text-gray-700 mb-8">
              Cotiza planchas + tornillería con barraca JURMAQ. Despacho coordinado a tu obra.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link href="/cotizar" className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-8 py-4 rounded-lg font-bold text-lg transition-colors">
                Cotizar mi pedido
              </Link>
              <Link href="/categorias/planchas-techumbre" className="inline-flex items-center gap-2 bg-white border border-gray-300 hover:border-orange-500 text-navy-950 px-8 py-4 rounded-lg font-bold text-lg transition-colors">
                Ver catálogo
              </Link>
            </div>
          </div>
        </section>
      </article>
    </>
  );
}
