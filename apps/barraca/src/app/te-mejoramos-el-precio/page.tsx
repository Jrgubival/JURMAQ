import type { Metadata } from "next";
import Link from "next/link";
import { CIUDADES, TOP_PRODUCTOS_BARRACA, HQ } from "@jurmaq/shared/seo";
import TrustSignals, { COMPARACION_KPIS } from "@/components/TrustSignals";

export const metadata: Metadata = {
  title: "Te mejoramos el precio en menos de 2 horas · Barraca JURMAQ",
  description:
    "¿Tienes cotización de Sodimac, Easy o Construmart? Súbela en barraca.jurmaq.cl y en menos de 2 horas te llega una contraoferta JURMAQ por correo. Sin trampa, sin letra chica, sin compromiso de compra. Despacho a Curicó, Molina, Talca y toda la Región del Maule.",
  keywords: [
    "te mejoramos el precio",
    "súbenos tu cotización",
    "mejor precio fierros Curicó",
    "mejor precio cemento Curicó",
    "mejor precio materiales construcción Curicó",
    "comparador precio Sodimac",
    "comparador precio Easy",
    "comparador precio Construmart",
    "barraca te mejoramos precio",
    "barraca JURMAQ",
    "ferretería online Maule",
  ],
  openGraph: {
    title: "Te mejoramos el precio en 2 horas · Barraca JURMAQ Curicó",
    description:
      "Súbenos tu cotización de la competencia y te respondemos con contraoferta JURMAQ en menos de 2 horas. Sin compromiso. Despacho a toda la Región del Maule.",
    url: "https://barraca.jurmaq.cl/te-mejoramos-el-precio",
    siteName: "Barraca JURMAQ",
    locale: "es_CL",
    type: "website",
    images: [{ url: "/barraca/icon-512.png", width: 512, height: 512, alt: "Te mejoramos el precio · JURMAQ" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Te mejoramos el precio en 2h · Barraca JURMAQ",
    description:
      "Súbenos tu cotización de Sodimac, Easy o Construmart y te respondemos con contraoferta JURMAQ en menos de 2 horas.",
  },
  alternates: { canonical: "https://barraca.jurmaq.cl/te-mejoramos-el-precio" },
  manifest: "/barraca/manifest.json",
};

const FAQ = [
  {
    q: "¿Cómo funciona exactamente el price-match?",
    a: "Sacas foto o PDF de tu cotización (de Sodimac, Easy, Construmart u otra barraca), la subes en la sección 'Sube tu cotización' o nos la mandas por WhatsApp. La revisamos, comparamos precios producto por producto, y te respondemos por correo con una contraoferta JURMAQ. Si te conviene, aceptas. Si no, no pasa nada.",
  },
  {
    q: "¿En cuánto tiempo me responden?",
    a: "En menos de 2 horas hábiles (Lun-Vie 8:30-18:30, Sáb 9:00-14:00). Si nos escribes fuera de horario, te contestamos a primera hora del día hábil siguiente.",
  },
  {
    q: "¿Tiene letra chica?",
    a: "No. La contraoferta es por escrito, con detalle producto por producto y total final con IVA incluido. Si igualamos o bajamos, lo hacemos sobre el mismo producto, marca y formato. Si bajamos pero cambiando una marca, te lo decimos explícitamente.",
  },
  {
    q: "¿Mejoran el precio en TODOS los productos?",
    a: "En la mayoría sí. Hay casos puntuales donde el competidor tiene un precio promocional que ni nosotros podemos igualar (ej: liquidación de stock). Si no podemos mejorar, te lo decimos honestamente y te explicamos por qué.",
  },
  {
    q: "¿Cuánto se ahorra en promedio?",
    a: "Casos del último mes: $25.000 en una compra de $850.000 (3% de ahorro), $80.000 en una de $1.200.000 (7%), $180.000 en una compra de $2.500.000 (7%). Volumen mayor = mejor margen para mejorarte el precio.",
  },
  {
    q: "¿Tengo que comprar si me responden?",
    a: "No. Es cero compromiso. La contraoferta es información para que decidas. Si te conviene, aceptas y coordinamos despacho. Si no, simplemente no haces nada.",
  },
  {
    q: "¿Despachan a mi ciudad?",
    a: `Sí, despachamos a toda la Región del Maule: ${CIUDADES.map((c) => c.nombre).join(", ")}. Tiempos varían entre 30 minutos (Molina) y 2 horas (Constitución).`,
  },
  {
    q: "¿Necesito tener cuenta para subir mi cotización?",
    a: "No. Puedes subir cotización sin cuenta, solo nos dejas tu correo y teléfono para responderte. Si tienes cuenta JURMAQ, te queda guardado el historial.",
  },
];

export default function PriceMatchPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": "https://barraca.jurmaq.cl/te-mejoramos-el-precio#service",
        name: "Te mejoramos el precio en 2 horas",
        serviceType: "Comparación y contraoferta de precios de materiales de construcción",
        description:
          "Compara tu cotización de Sodimac, Easy, Construmart u otra barraca contra los precios de JURMAQ. Te respondemos con contraoferta por correo en menos de 2 horas. Sin compromiso de compra.",
        provider: { "@id": "https://jurmaq.cl/#organization" },
        areaServed: CIUDADES.map((c) => ({ "@type": "City", name: c.nombre })),
        offers: {
          "@type": "Offer",
          priceSpecification: {
            "@type": "PriceSpecification",
            price: 0,
            priceCurrency: "CLP",
            description: "Servicio gratuito de comparación. Solo pagas si aceptas la contraoferta.",
          },
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Barraca JURMAQ", item: "https://barraca.jurmaq.cl" },
          { "@type": "ListItem", position: 2, name: "Te mejoramos el precio", item: "https://barraca.jurmaq.cl/te-mejoramos-el-precio" },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="bg-white">
        {/* Hero */}
        <header className="bg-navy-950 text-white py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 bg-orange-600 text-white text-xs font-bold uppercase tracking-wider rounded-full">
              <span>✓ Sin trampa</span>
              <span className="opacity-50">·</span>
              <span>✓ Sin letra chica</span>
              <span className="opacity-50">·</span>
              <span>✓ Sin compromiso</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-4">
              Te mejoramos el precio<br />
              <span className="text-orange-400">en menos de 2 horas</span>
            </h1>
            <p className="text-lg lg:text-xl text-gray-200 max-w-3xl mx-auto mb-8">
              Súbenos tu cotización de Sodimac, Easy, Construmart u otra barraca, y te respondemos con una contraoferta JURMAQ por correo. Si te conviene, aceptas. Si no, no pasa nada.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                href="/cotizar"
                className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 px-8 py-4 rounded-lg font-bold text-lg transition-colors"
              >
                Sube tu cotización ahora
              </Link>
              <a
                href={HQ.whatsapp + "?text=Hola%2C%20quiero%20que%20me%20mejoren%20una%20cotización"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 px-8 py-4 rounded-lg font-bold text-lg transition-colors"
              >
                Mándala por WhatsApp
              </a>
            </div>
          </div>
        </header>

        <TrustSignals variant="light" items={COMPARACION_KPIS} />

        {/* Cómo funciona en 4 pasos */}
        <section className="py-16 bg-orange-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-navy-950 text-center mb-2">
              Cómo funciona
            </h2>
            <p className="text-gray-700 text-center mb-12">4 pasos. 30 segundos para subirla. 2 horas para que te respondamos.</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { n: "1", t: "Saca foto", d: "De tu cotización en Sodimac, Easy, Construmart o donde sea." },
                { n: "2", t: "Súbela acá", d: "En la sección 'Sube tu cotización' o por WhatsApp." },
                { n: "3", t: "Respondemos", d: "En menos de 2 horas hábiles. Por correo o WhatsApp." },
                { n: "4", t: "Decides", d: "Si te conviene, aceptas y coordinamos despacho. Si no, no pasa nada." },
              ].map((p) => (
                <div key={p.n} className="bg-white p-6 rounded-xl border border-orange-200">
                  <div className="w-12 h-12 rounded-full bg-orange-600 text-white text-xl font-bold flex items-center justify-center mb-4">{p.n}</div>
                  <h3 className="font-bold text-navy-950 mb-2">{p.t}</h3>
                  <p className="text-sm text-gray-700">{p.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Casos reales */}
        <section className="py-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-navy-950 mb-2 text-center">Casos reales del último mes</h2>
            <p className="text-gray-600 text-center mb-12">Ahorros concretos en obras concretas. Datos anónimos, números reales.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  obra: "Ampliación 30m²",
                  competencia: "Sodimac",
                  ahorro: "$25.000",
                  total: "$425.000",
                  pct: "6%",
                  notas: "Cemento + áridos + fierro",
                },
                {
                  obra: "Casa nueva 80m²",
                  competencia: "Easy",
                  ahorro: "$80.000",
                  total: "$1.120.000",
                  pct: "7%",
                  notas: "Fierro estriado + malla + cemento",
                },
                {
                  obra: "Galpón industrial 200m²",
                  competencia: "Construmart",
                  ahorro: "$180.000",
                  total: "$2.320.000",
                  pct: "7%",
                  notas: "Perfiles + zinc + tornillería",
                },
              ].map((c, i) => (
                <div key={i} className="bg-gradient-to-br from-orange-50 to-white p-6 rounded-xl border-2 border-orange-200">
                  <div className="text-3xl font-extrabold text-orange-600 mb-1">{c.ahorro}</div>
                  <div className="text-sm text-gray-600 mb-4">de ahorro ({c.pct})</div>
                  <h3 className="font-bold text-navy-950 mb-1">{c.obra}</h3>
                  <p className="text-sm text-gray-700 mb-2">{c.notas}</p>
                  <div className="text-xs text-gray-500 border-t border-orange-100 pt-3 mt-3">
                    <div>Total competencia ({c.competencia}): <strong>{c.total}</strong></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Por qué podemos */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-navy-950 mb-8 text-center">¿Por qué podemos darte mejor precio?</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  t: "Menos sucursales",
                  d: "Una sola barraca en Molina, no 50 locales. Menos arriendo, menos sueldos administrativos, menos overhead que tienes que pagar tú.",
                },
                {
                  t: "Sin publicidad cara",
                  d: "No invertimos en TV, vallas, pauta digital masiva. Esa plata se queda en tus precios.",
                },
                {
                  t: "25 años con los mismos proveedores",
                  d: "Llevamos 25 años comprándole a Polpaico, Sherwin Williams, Cintac, Inchalam. Eso significa precios que la mayoría de barracas pequeñas no consigue.",
                },
              ].map((p, i) => (
                <div key={i} className="bg-white p-6 rounded-xl border border-gray-200">
                  <h3 className="font-bold text-navy-950 mb-2">{p.t}</h3>
                  <p className="text-sm text-gray-700 leading-relaxed">{p.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Materiales donde más ahorras */}
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-navy-950 mb-2 text-center">Materiales donde más ahorras</h2>
            <p className="text-gray-700 text-center mb-12">Estos son los que más diferencia hacen vs los homecenters.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {TOP_PRODUCTOS_BARRACA.map((m) => (
                <Link
                  key={m.slug}
                  href={`/categorias/${m.categoriaSlug}`}
                  className="block bg-white border-2 border-gray-200 hover:border-orange-500 rounded-xl p-4 text-center transition-colors"
                >
                  <h3 className="font-semibold text-navy-950 text-sm">{m.nombre}</h3>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-navy-950 mb-8 text-center">Preguntas frecuentes</h2>
            <div className="space-y-6">
              {FAQ.map((f, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-navy-950 mb-2">{f.q}</h3>
                  <p className="text-gray-700 leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="py-20 bg-navy-950 text-white text-center">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">¿Tienes una cotización?</h2>
            <p className="text-lg text-gray-200 mb-8">Subir toma 30 segundos. Te respondemos en menos de 2 horas hábiles.</p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                href="/cotizar"
                className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 px-8 py-4 rounded-lg font-bold text-lg transition-colors"
              >
                Sube tu cotización
              </Link>
              <a
                href={HQ.whatsapp + "?text=Hola%2C%20quiero%20que%20me%20mejoren%20una%20cotización"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 px-8 py-4 rounded-lg font-bold text-lg transition-colors"
              >
                WhatsApp +56 9 7667 3577
              </a>
            </div>
          </div>
        </section>
      </article>
    </>
  );
}
