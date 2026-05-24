import type { Metadata } from "next";
import Link from "next/link";
import CalculadoraHormigonClient from "./CalculadoraHormigonClient";
import RelatedCalculadoras from "@/components/barraca/RelatedCalculadoras";

export const metadata: Metadata = {
  title: "Calculadora de Hormigón H20 / H25 / H30 · Cemento, Arena, Gravilla por m³ · JURMAQ",
  description:
    "Calcula la cantidad exacta de cemento, arena y gravilla para tu obra según m³ de hormigón. Dosificaciones H20, H25 y H30 chilenas (NCh 170). Cotiza con JURMAQ Barraca.",
  keywords: [
    "calculadora hormigon",
    "cuantos sacos por m3 de hormigon",
    "dosificacion hormigon H20",
    "dosificacion hormigon H25",
    "calculadora hormigon armado",
    "cemento arena gravilla por m3",
    "barraca aridos Curicó",
    "comprar gravilla Maule",
  ],
  openGraph: {
    title: "Calculadora de Hormigón · Sacos, Arena y Gravilla por m³",
    description:
      "Estima cemento, arena y gravilla por m³ de hormigón H20/H25/H30. Despachamos a todo el Maule.",
    url: "https://barraca.jurmaq.cl/calculadora-hormigon",
    siteName: "Barraca JURMAQ",
    locale: "es_CL",
    type: "website",
  },
  alternates: {
    canonical: "https://barraca.jurmaq.cl/calculadora-hormigon",
  },
};

/**
 * Dosificaciones aproximadas para hormigón hecho en obra (mezcla manual o
 * con betonera). Sacos de cemento de 25 kg. Valores por m³ de hormigón
 * fresco. Referencia NCh 170:2016 + tablas de dosificación residencial.
 *
 * NOTA IMPORTANTE: Para hormigón estructural certificado (losas, muros,
 * vigas), siempre usar planta dosificadora con certificado H20-H35. La
 * mezcla en obra es válida sólo para radieres, sobrelosas y elementos
 * no estructurales.
 */
export const GRADOS_HORMIGON = [
  {
    slug: "h5",
    nombre: "H5 (emplantillado)",
    descripcion: "Hormigón pobre para nivelar y apoyar moldajes. No estructural.",
    sacosPorM3: 4,
    arenaM3PorM3: 0.55,
    gravillaM3PorM3: 0.85,
    aguaLPorM3: 200,
    notas: "Mezcla 1:5:7. Sólo para emplantillado. NO usar en estructuras.",
  },
  {
    slug: "h15",
    nombre: "H15 (radier liviano)",
    descripcion: "Radier interior sin tránsito vehicular, contrapiso, sobrelosa no estructural.",
    sacosPorM3: 6,
    arenaM3PorM3: 0.5,
    gravillaM3PorM3: 0.85,
    aguaLPorM3: 185,
    notas: "Mezcla 1:4:6. Para radieres residenciales sin cargas dinámicas.",
  },
  {
    slug: "h20",
    nombre: "H20 (estándar residencial)",
    descripcion: "Radier con tránsito, fundaciones menores, poyos, vigas y sobrelosas livianas.",
    sacosPorM3: 7,
    arenaM3PorM3: 0.5,
    gravillaM3PorM3: 0.8,
    aguaLPorM3: 180,
    notas: "Mezcla 1:3:5. Para hormigón armado estructural se recomienda planta certificada.",
  },
  {
    slug: "h25",
    nombre: "H25 (estructural)",
    descripcion: "Hormigón armado para vigas, muros y losas de vivienda con calculista.",
    sacosPorM3: 9,
    arenaM3PorM3: 0.45,
    gravillaM3PorM3: 0.8,
    aguaLPorM3: 175,
    notas: "Mezcla 1:2.5:4. Para estructura armada exigir certificado de planta.",
  },
  {
    slug: "h30",
    nombre: "H30 (alta resistencia)",
    descripcion: "Hormigón armado de alta resistencia: estructuras especiales, alta exposición.",
    sacosPorM3: 11,
    arenaM3PorM3: 0.4,
    gravillaM3PorM3: 0.75,
    aguaLPorM3: 170,
    notas: "Mezcla 1:2:3.5. Siempre desde planta certificada con ensayos cilíndricos.",
  },
] as const;

export default function CalculadoraHormigonPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "HowTo",
        name: "Cómo calcular cemento, arena y gravilla para tu hormigón",
        description:
          "Pasos para estimar cemento, arena y gravilla en m³ de hormigón H5 a H30 chileno.",
        totalTime: "PT4M",
        step: [
          { "@type": "HowToStep", position: 1, name: "Define el grado", text: "H5 emplantillado, H15 radier liviano, H20 estándar, H25/H30 estructural." },
          { "@type": "HowToStep", position: 2, name: "Calcula el volumen", text: "Multiplica largo × ancho × espesor en metros para obtener m³." },
          { "@type": "HowToStep", position: 3, name: "Aplica la dosificación", text: "Multiplica volumen por sacos/m³, arena/m³ y gravilla/m³ del grado elegido." },
          { "@type": "HowToStep", position: 4, name: "Suma el agua", text: "Calcula litros de agua según tabla. Crucial para alcanzar la resistencia." },
          { "@type": "HowToStep", position: 5, name: "Considera 5-10% extra", text: "Suma pérdidas por desperdicio, derrames y ajustes de mezcla." },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "¿Cuántos sacos de cemento por m³ de hormigón H20?",
            acceptedAnswer: { "@type": "Answer", text: "Hormigón H20 estándar residencial requiere aproximadamente 7 sacos de cemento de 25 kg por m³, con dosificación 1:3:5 (cemento:arena:gravilla)." },
          },
          {
            "@type": "Question",
            name: "¿Qué arena y gravilla lleva 1 m³ de hormigón?",
            acceptedAnswer: { "@type": "Answer", text: "Para H20: aprox 0.5 m³ de arena y 0.8 m³ de gravilla. Las cantidades varían levemente según granulometría del árido y absorción." },
          },
          {
            "@type": "Question",
            name: "¿Hormigón hecho en obra sirve para estructura?",
            acceptedAnswer: { "@type": "Answer", text: "Sólo para elementos no estructurales menores (radieres, sobrelosas, poyos). Para vigas, muros y losas estructurales SIEMPRE usar planta certificada con ensayos H20-H35 (NCh 170)." },
          },
          {
            "@type": "Question",
            name: "¿Despachan áridos al Maule?",
            acceptedAnswer: { "@type": "Answer", text: "Sí. JURMAQ despacha cemento, arena y gravilla en sacos o granel a todo el Maule desde Molina. Camionada coordinada para obras grandes." },
          },
        ],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Barraca JURMAQ", item: "https://barraca.jurmaq.cl" },
          { "@type": "ListItem", position: 2, name: "Calculadoras", item: "https://barraca.jurmaq.cl/calculadoras" },
          { "@type": "ListItem", position: 3, name: "Calculadora de hormigón", item: "https://barraca.jurmaq.cl/calculadora-hormigon" },
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
              <Link href="/calculadoras" className="hover:text-white">Calculadoras</Link>
              <span className="mx-2">›</span>
              <span className="text-white">Calculadora de hormigón</span>
            </nav>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4">
              Calculadora de Hormigón H20, H25 y H30
            </h1>
            <p className="text-lg text-gray-200 max-w-3xl">
              Calcula cemento, arena, gravilla y agua para tu m³ de hormigón. Dosificaciones
              chilenas referenciales según NCh 170:2016.
            </p>
          </div>
        </header>

        <CalculadoraHormigonClient grados={GRADOS_HORMIGON} />

        <section className="py-12 bg-gray-50 border-t border-gray-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-navy-950 mb-6">Dosificaciones por m³ de hormigón</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm bg-white border border-gray-200 rounded-lg">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Grado</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">Cemento</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">Arena</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">Gravilla</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">Agua</th>
                  </tr>
                </thead>
                <tbody>
                  {GRADOS_HORMIGON.map((g) => (
                    <tr key={g.slug} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-medium text-navy-950">{g.nombre}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{g.sacosPorM3} sacos</td>
                      <td className="px-4 py-3 text-right text-gray-700">{g.arenaM3PorM3} m³</td>
                      <td className="px-4 py-3 text-right text-gray-700">{g.gravillaM3PorM3} m³</td>
                      <td className="px-4 py-3 text-right text-gray-700">{g.aguaLPorM3} L</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Sacos de cemento 25 kg. Valores referenciales NCh 170:2016. Para hormigón
              estructural certificado, contratar planta con ensayos H20-H35.
            </p>
          </div>
        </section>

        <section className="py-12 bg-white border-t border-gray-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-navy-950 mb-8">Preguntas frecuentes</h2>
            <dl className="space-y-6">
              <div>
                <dt className="font-semibold text-navy-950 mb-1">¿Cuántos sacos por m³ de hormigón H20?</dt>
                <dd className="text-gray-700 text-sm">~7 sacos de 25 kg por m³, dosificación 1:3:5.</dd>
              </div>
              <div>
                <dt className="font-semibold text-navy-950 mb-1">¿Cuánto árido va por m³?</dt>
                <dd className="text-gray-700 text-sm">~0.5 m³ de arena y 0.8 m³ de gravilla por m³ de hormigón H20.</dd>
              </div>
              <div>
                <dt className="font-semibold text-navy-950 mb-1">¿Hormigón en obra sirve para losa o muro?</dt>
                <dd className="text-gray-700 text-sm">
                  No para estructural. Para losas, vigas y muros usar planta certificada NCh 170. La mezcla en obra es para radieres y elementos secundarios.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-navy-950 mb-1">¿Despachan áridos al Maule?</dt>
                <dd className="text-gray-700 text-sm">
                  Sí, en sacos o granel.{" "}
                  <Link href="/categorias/cemento-y-aridos" className="text-orange-600 hover:underline">
                    Ver catálogo de áridos
                  </Link>.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <RelatedCalculadoras currentSlug="calculadora-hormigon" />

        <section className="py-16 bg-orange-50 border-t border-orange-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-4">
              ¿Listo para cotizar tu hormigón?
            </h2>
            <p className="text-gray-700 mb-8">
              Cotiza con barraca JURMAQ. Cemento, arena y gravilla con despacho coordinado a tu obra.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link href="/cotizar" className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-8 py-4 rounded-lg font-bold text-lg transition-colors">
                Cotizar mi pedido
              </Link>
              <Link href="/categorias/cemento-y-aridos" className="inline-flex items-center gap-2 bg-white border border-gray-300 hover:border-orange-500 text-navy-950 px-8 py-4 rounded-lg font-bold text-lg transition-colors">
                Ver catálogo
              </Link>
            </div>
          </div>
        </section>
      </article>
    </>
  );
}
