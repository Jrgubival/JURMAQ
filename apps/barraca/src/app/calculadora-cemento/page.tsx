import type { Metadata } from "next";
import Link from "next/link";
import CalculadoraCementoClient from "./CalculadoraCementoClient";
import RelatedCalculadoras from "@/components/barraca/RelatedCalculadoras";

export const metadata: Metadata = {
  title: "Calculadora de Cemento por m² · Sacos para Radier, Contrapiso, Estuco · JURMAQ",
  description:
    "Calcula cuántos sacos de cemento necesitas para tu radier, contrapiso, estuco o sobrelosa. Dosificaciones chilenas (kg/m³). Cotiza con barraca JURMAQ y despachamos a todo el Maule.",
  keywords: [
    "calculadora cemento",
    "cuantos sacos de cemento por m2",
    "cuantos sacos de cemento para radier",
    "calculadora cemento estuco",
    "saco de cemento rinde m2",
    "dosificacion cemento radier",
    "barraca cemento Curicó",
    "comprar cemento Maule",
  ],
  openGraph: {
    title: "Calculadora de Cemento · Sacos por m² para Radier, Estuco, Contrapiso",
    description:
      "Estima los sacos de cemento que necesitas según m² y espesor. Despachamos a todo el Maule desde Molina.",
    url: "https://barraca.jurmaq.cl/calculadora-cemento",
    siteName: "Barraca JURMAQ",
    locale: "es_CL",
    type: "website",
  },
  alternates: {
    canonical: "https://barraca.jurmaq.cl/calculadora-cemento",
  },
};

/**
 * Dosificaciones típicas chilenas. Sacos de cemento de 25 kg (estándar barraca).
 * Valores referenciales para una primera estimación; el calculista define la
 * dosificación final según uso y exposición (NCh 170:2016, ACI 318).
 */
export const ELEMENTOS_CEMENTO = [
  {
    slug: "radier",
    nombre: "Radier",
    descripcion: "Piso de hormigón en contacto con el terreno. Espesor típico 8-10 cm.",
    espesorCmDefault: 10,
    sacosPorM3: 7, // ~175 kg cemento/m³ (mezcla 1:3:5)
    notas: "Mezcla 1:3:5 (cemento:arena:gravilla). Si hay tránsito vehicular sube a dosis 1:2:4 (≈9 sacos/m³).",
  },
  {
    slug: "contrapiso",
    nombre: "Contrapiso de mortero",
    descripcion: "Capa de nivelación bajo cerámica o flotante. Espesor 4-6 cm.",
    espesorCmDefault: 5,
    sacosPorM3: 12, // dosis 1:4 mortero
    notas: "Mezcla 1:4 (cemento:arena). Reforzar con malla gallinero o fibra para evitar fisuración.",
  },
  {
    slug: "sobrelosa",
    nombre: "Sobrelosa de nivelación",
    descripcion: "Capa adicional sobre losa, espesor 4-7 cm.",
    espesorCmDefault: 5,
    sacosPorM3: 10,
    notas: "Mezcla 1:3:3. Si será estructural verificar con calculista.",
  },
  {
    slug: "estuco",
    nombre: "Estuco de muros",
    descripcion: "Revestimiento de mortero sobre muros, espesor 1.5-2.5 cm.",
    espesorCmDefault: 2,
    sacosPorM3: 14,
    notas: "Mezcla 1:4 (cemento:arena fina). Aplicar en dos capas: chicoteo + terminación.",
  },
  {
    slug: "poyo",
    nombre: "Poyo / fundación menor",
    descripcion: "Cimiento menor para muros divisorios o pilares de cierro.",
    espesorCmDefault: 30,
    sacosPorM3: 7,
    notas: "Mezcla 1:3:5 con dosis estándar H20. Usar cemento alta resistencia para zonas húmedas.",
  },
] as const;

export default function CalculadoraCementoPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "HowTo",
        name: "Cómo calcular cuántos sacos de cemento necesitas",
        description:
          "Pasos para estimar la cantidad de sacos de cemento (25 kg) para radier, contrapiso, estuco u otros elementos en construcción.",
        totalTime: "PT3M",
        step: [
          { "@type": "HowToStep", position: 1, name: "Define el elemento", text: "Identifica si es radier, contrapiso, estuco, sobrelosa o poyo." },
          { "@type": "HowToStep", position: 2, name: "Mide área y espesor", text: "Calcula los m² del paño y el espesor de la capa en cm." },
          { "@type": "HowToStep", position: 3, name: "Calcula el volumen", text: "Multiplica m² × espesor en m. Ej: 50 m² × 0.10 m = 5 m³." },
          { "@type": "HowToStep", position: 4, name: "Aplica la dosificación", text: "Multiplica el volumen por sacos/m³ del elemento (ver tabla). Ej: 5 m³ × 7 sacos/m³ = 35 sacos." },
          { "@type": "HowToStep", position: 5, name: "Suma 5-10% extra", text: "Considera pérdida por desperdicio y mezcla. Pide siempre 5-10% más." },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "¿Cuántos sacos de cemento lleva un radier de 50 m²?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Un radier de 50 m² con 10 cm de espesor son 5 m³ de hormigón. Con dosificación 1:3:5 (≈7 sacos de 25 kg por m³) son 35 sacos. Suma 5-10% por pérdidas → ~38 sacos.",
            },
          },
          {
            "@type": "Question",
            name: "¿Cuánto rinde un saco de cemento de 25 kg en estuco?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Un saco de 25 kg con dosificación 1:4 rinde aproximadamente 3.5 m² de estuco de 2 cm de espesor. Para 100 m² de estuco necesitas alrededor de 28 sacos.",
            },
          },
          {
            "@type": "Question",
            name: "¿Qué dosificación usar para un contrapiso?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Para contrapiso de mortero se usa dosis 1:4 (cemento:arena). Para contrapisos con tránsito o cargas se sube a 1:3. Reforzar con malla gallinero o fibra polipropileno evita fisuración.",
            },
          },
          {
            "@type": "Question",
            name: "¿Despachan cemento al Maule?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Sí. JURMAQ Barraca despacha cemento Polpaico, Melón y Bío-Bío a todo el Maule desde Molina. Curicó en 30 min, Talca en 1h.",
            },
          },
        ],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Barraca JURMAQ", item: "https://barraca.jurmaq.cl" },
          { "@type": "ListItem", position: 2, name: "Calculadoras", item: "https://barraca.jurmaq.cl/calculadoras" },
          { "@type": "ListItem", position: 3, name: "Calculadora de cemento", item: "https://barraca.jurmaq.cl/calculadora-cemento" },
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
              <span className="text-white">Calculadora de cemento</span>
            </nav>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4">
              Calculadora de Cemento por m²
            </h1>
            <p className="text-lg text-gray-200 max-w-3xl">
              Estima los sacos de cemento (25 kg) para tu radier, contrapiso, estuco o
              sobrelosa. Dosificaciones chilenas referenciales según NCh 170:2016.
            </p>
          </div>
        </header>

        <CalculadoraCementoClient elementos={ELEMENTOS_CEMENTO} />

        <section className="py-12 bg-gray-50 border-t border-gray-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-navy-950 mb-6">Dosificaciones típicas (sacos 25 kg/m³)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm bg-white border border-gray-200 rounded-lg">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Elemento</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">Sacos/m³</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700">Espesor típico</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {ELEMENTOS_CEMENTO.map((e) => (
                    <tr key={e.slug} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-medium text-navy-950">{e.nombre}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{e.sacosPorM3} sacos</td>
                      <td className="px-4 py-3 text-right text-gray-700">{e.espesorCmDefault} cm</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{e.notas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Sacos de cemento de 25 kg (estándar barraca). Valores referenciales según
              NCh 170:2016 (Hormigón. Requisitos generales) y prácticas de obra
              residencial. Para hormigón estructural certificado, contratar planta H30/H35.
            </p>
          </div>
        </section>

        <section className="py-12 bg-white border-t border-gray-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-navy-950 mb-8">Preguntas frecuentes</h2>
            <dl className="space-y-6">
              <div>
                <dt className="font-semibold text-navy-950 mb-1">¿Cuántos sacos de cemento lleva un radier de 50 m²?</dt>
                <dd className="text-gray-700 text-sm">
                  Radier de 10 cm: 5 m³ × 7 sacos/m³ = 35 sacos. Suma 5-10% por pérdidas → ~38 sacos.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-navy-950 mb-1">¿Cuánto rinde un saco de 25 kg en estuco?</dt>
                <dd className="text-gray-700 text-sm">
                  Aproximadamente 3.5 m² de estuco de 2 cm con dosificación 1:4. Para 100 m² → ~28 sacos.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-navy-950 mb-1">¿Qué dosificación usar para un contrapiso?</dt>
                <dd className="text-gray-700 text-sm">
                  1:4 (cemento:arena) estándar. Reforzar con malla gallinero o fibra para evitar fisuras.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-navy-950 mb-1">¿Despachan cemento al Maule?</dt>
                <dd className="text-gray-700 text-sm">
                  Sí. Polpaico, Melón y Bío-Bío con despacho desde Molina.{" "}
                  <Link href="/categorias/cemento-y-aridos" className="text-orange-600 hover:underline">
                    Ver catálogo de cemento
                  </Link>.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <RelatedCalculadoras currentSlug="calculadora-cemento" />

        <section className="py-16 bg-orange-50 border-t border-orange-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-4">
              ¿Ya sabes cuántos sacos necesitas?
            </h2>
            <p className="text-gray-700 mb-8">
              Cotiza con barraca JURMAQ y coordinamos despacho directo a tu obra.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                href="/cotizar"
                className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-8 py-4 rounded-lg font-bold text-lg transition-colors"
              >
                Cotizar mi pedido
              </Link>
              <Link
                href="/categorias/cemento-y-aridos"
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
