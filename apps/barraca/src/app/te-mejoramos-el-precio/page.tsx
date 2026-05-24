import type { Metadata } from "next";
import Link from "next/link";
import { CIUDADES, TOP_PRODUCTOS_BARRACA, HQ } from "@jurmaq/shared/seo";

/**
 * Te mejoramos el precio — Editorial Luxury retrofit.
 *
 * Skills aplicadas (impeccable, design-taste-frontend, web-typography,
 * minimalist-ui, high-end-visual-design, redesign-existing-projects):
 * - Sin font-extrabold hero-metric (impeccable ban: ✗ "$25.000 / Sodimac / 6%")
 * - Sin emojis (✓) — IconCheck SVG primitive
 * - Sin bg-orange-50/bg-gradient-to-br (warm orange wash baneado)
 * - Headlines clamp() + Newsreader italic accents (no text-orange-400 chillón)
 * - Hairline dividers (border-t / border-l) en vez de cards rounded-xl
 * - py-24 lg:py-32 generous spacing
 * - Single accent color: amber #956400 sparingly
 * - Bone bg #FBFBFA + off-black #111111 + gray #5A5A57
 */

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

const STEPS = [
  { n: "01", t: "Saca foto", d: "De tu cotización en Sodimac, Easy, Construmart o donde sea." },
  { n: "02", t: "Súbela acá", d: "En la sección 'Sube tu cotización' o por WhatsApp." },
  { n: "03", t: "Respondemos", d: "En menos de 2 horas hábiles. Por correo o WhatsApp." },
  { n: "04", t: "Decides", d: "Si te conviene, aceptas y coordinamos despacho. Si no, no pasa nada." },
];

const CASOS = [
  {
    obra: "Ampliación 30 m²",
    competencia: "Sodimac",
    ahorro: "$25.000",
    total: "$425.000",
    pct: "6%",
    notas: "Cemento, áridos y fierro estriado.",
  },
  {
    obra: "Casa nueva 80 m²",
    competencia: "Easy",
    ahorro: "$80.000",
    total: "$1.120.000",
    pct: "7%",
    notas: "Fierro estriado, malla y cemento.",
  },
  {
    obra: "Galpón industrial 200 m²",
    competencia: "Construmart",
    ahorro: "$180.000",
    total: "$2.320.000",
    pct: "7%",
    notas: "Perfiles, zinc y tornillería.",
  },
];

const RAZONES = [
  {
    n: "01",
    t: "Menos sucursales",
    d: "Una sola barraca en Molina, no 50 locales. Menos arriendo, menos sueldos administrativos, menos overhead que tienes que pagar tú.",
  },
  {
    n: "02",
    t: "Sin publicidad cara",
    d: "No invertimos en TV, vallas ni pauta digital masiva. Esa plata se queda en tus precios.",
  },
  {
    n: "03",
    t: "27 años con los mismos proveedores",
    d: "Llevamos 27 años comprándole a Polpaico, Sherwin Williams, Cintac, Inchalam. Precios que la mayoría de barracas pequeñas no consigue.",
  },
];

function IconCheck({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}

function IconArrow({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

function IconWhatsapp({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" />
    </svg>
  );
}

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

      <article className="bg-[#FBFBFA]">
        {/* Hero — editorial, navy background con hairlines */}
        <header className="bg-navy-950 text-white border-b border-white/10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
            <p className="text-[10px] font-semibold text-white/55 uppercase tracking-[0.22em] mb-6">
              Servicio JURMAQ · gratis · sin compromiso
            </p>
            <h1
              className="text-white mb-8 leading-[1.05] max-w-4xl"
              style={{ fontSize: 'clamp(2.5rem, 5.5vw, 4.5rem)', fontWeight: 500, letterSpacing: '-0.015em' }}
            >
              Te mejoramos el precio
              <br />
              <span className="font-[var(--font-serif)] italic text-white/95" style={{ fontWeight: 400 }}>
                en menos de dos horas.
              </span>
            </h1>
            <p className="text-base lg:text-lg text-white/75 max-w-2xl leading-relaxed mb-10">
              Súbenos tu cotización de Sodimac, Easy, Construmart u otra barraca. La revisamos producto por producto y te respondemos por correo con una contraoferta JURMAQ. Si te conviene, aceptas. Si no, no pasa nada.
            </p>

            {/* Garantías como lista divisible, no badge shouted */}
            <ul className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-white/70 mb-12">
              <li className="inline-flex items-center gap-2">
                <IconCheck className="w-3.5 h-3.5 text-[#D4B16A]" />
                Sin trampa
              </li>
              <li className="inline-flex items-center gap-2">
                <IconCheck className="w-3.5 h-3.5 text-[#D4B16A]" />
                Sin letra chica
              </li>
              <li className="inline-flex items-center gap-2">
                <IconCheck className="w-3.5 h-3.5 text-[#D4B16A]" />
                Sin compromiso
              </li>
            </ul>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/cotizar"
                className="inline-flex items-center gap-2 bg-white text-[#111111] px-6 py-3 rounded-lg text-sm font-medium tracking-[0.02em] hover:bg-white/90 transition-colors"
              >
                Subir cotización
                <IconArrow className="w-4 h-4" />
              </Link>
              <a
                href={HQ.whatsapp + "?text=Hola%2C%20quiero%20que%20me%20mejoren%20una%20cotización"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border border-white/25 text-white px-6 py-3 rounded-lg text-sm font-medium tracking-[0.02em] hover:bg-white/10 transition-colors"
              >
                <IconWhatsapp className="w-4 h-4" />
                Mándala por WhatsApp
              </a>
            </div>
          </div>
        </header>

        {/* Cómo funciona — divided list editorial */}
        <section className="py-24 lg:py-32">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-16">
              <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-4">
                Proceso
              </p>
              <h2
                className="text-[#111111] leading-[1.1] mb-6"
                style={{ fontSize: 'clamp(1.875rem, 3.5vw, 3rem)', fontWeight: 500, letterSpacing: '-0.01em' }}
              >
                Cómo <span className="font-[var(--font-serif)] italic" style={{ fontWeight: 400 }}>funciona</span>.
              </h2>
              <p className="text-base text-[#5A5A57] leading-relaxed">
                Cuatro pasos. Treinta segundos para subirla. Dos horas para que te respondamos.
              </p>
            </div>

            <ol className="border-t border-[#EAEAEA]">
              {STEPS.map((p) => (
                <li
                  key={p.n}
                  className="grid grid-cols-[auto_1fr] lg:grid-cols-[120px_180px_1fr] gap-x-6 lg:gap-x-12 gap-y-2 py-8 lg:py-10 border-b border-[#EAEAEA]"
                >
                  <p
                    className="text-[#956400] font-[var(--font-serif)] italic text-2xl lg:text-3xl leading-none"
                    style={{ fontWeight: 400 }}
                  >
                    {p.n}
                  </p>
                  <h3 className="text-lg lg:text-xl text-[#111111] font-medium tracking-[-0.005em] col-span-2 lg:col-span-1">
                    {p.t}
                  </h3>
                  <p className="text-sm lg:text-base text-[#5A5A57] leading-relaxed col-span-2 lg:col-span-1">
                    {p.d}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Casos reales — editorial table-as-cards */}
        <section className="py-24 lg:py-32 bg-white border-y border-[#EAEAEA]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-16">
              <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-4">
                Casos del último mes
              </p>
              <h2
                className="text-[#111111] leading-[1.1] mb-6"
                style={{ fontSize: 'clamp(1.875rem, 3.5vw, 3rem)', fontWeight: 500, letterSpacing: '-0.01em' }}
              >
                Ahorros concretos en
                <br />
                <span className="font-[var(--font-serif)] italic" style={{ fontWeight: 400 }}>obras concretas</span>.
              </h2>
              <p className="text-base text-[#5A5A57] leading-relaxed">
                Datos anónimos, números reales. Comparativas producto por producto contra Sodimac, Easy y Construmart.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 border-t border-[#EAEAEA]">
              {CASOS.map((c, i) => (
                <div
                  key={i}
                  className={`py-10 lg:py-12 lg:px-10 ${i > 0 ? 'lg:border-l border-[#EAEAEA] border-t lg:border-t-0' : 'lg:pr-10'}`}
                >
                  <p
                    className="text-[#111111] font-[var(--font-serif)] italic leading-none mb-2"
                    style={{ fontSize: 'clamp(2rem, 3vw, 2.75rem)', fontWeight: 400, letterSpacing: '-0.01em' }}
                  >
                    {c.ahorro}
                  </p>
                  <p className="text-xs text-[#787774] uppercase tracking-[0.18em] mb-6">
                    {c.pct} de ahorro
                  </p>
                  <h3 className="text-base text-[#111111] font-medium mb-2">
                    {c.obra}
                  </h3>
                  <p className="text-sm text-[#5A5A57] leading-relaxed mb-4">
                    {c.notas}
                  </p>
                  <p className="text-xs text-[#787774] border-t border-[#EAEAEA] pt-3">
                    Total {c.competencia}: <span className="text-[#111111] font-medium">{c.total}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Por qué podemos — editorial divisible list */}
        <section className="py-24 lg:py-32">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-x-16 gap-y-8">
              <div>
                <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-4">
                  Por qué podemos
                </p>
                <h2
                  className="text-[#111111] leading-[1.1] mb-6"
                  style={{ fontSize: 'clamp(1.875rem, 3.5vw, 3rem)', fontWeight: 500, letterSpacing: '-0.01em' }}
                >
                  Tres razones por las que <span className="font-[var(--font-serif)] italic" style={{ fontWeight: 400 }}>te damos mejor precio</span>.
                </h2>
              </div>
              <ul className="border-t border-[#EAEAEA]">
                {RAZONES.map((r) => (
                  <li
                    key={r.n}
                    className="grid grid-cols-[60px_1fr] gap-x-6 py-8 border-b border-[#EAEAEA]"
                  >
                    <p
                      className="text-[#956400] font-[var(--font-serif)] italic text-xl leading-none mt-1"
                      style={{ fontWeight: 400 }}
                    >
                      {r.n}
                    </p>
                    <div>
                      <h3 className="text-lg text-[#111111] font-medium mb-2">{r.t}</h3>
                      <p className="text-sm text-[#5A5A57] leading-relaxed">{r.d}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Materiales donde más ahorras — pill grid editorial */}
        <section className="py-24 lg:py-32 bg-white border-y border-[#EAEAEA]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-12">
              <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-4">
                Materiales destacados
              </p>
              <h2
                className="text-[#111111] leading-[1.1] mb-6"
                style={{ fontSize: 'clamp(1.875rem, 3.5vw, 3rem)', fontWeight: 500, letterSpacing: '-0.01em' }}
              >
                Donde más se nota la <span className="font-[var(--font-serif)] italic" style={{ fontWeight: 400 }}>diferencia</span>.
              </h2>
              <p className="text-base text-[#5A5A57] leading-relaxed">
                Categorías donde JURMAQ históricamente le saca ventaja a los homecenters.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {TOP_PRODUCTOS_BARRACA.map((m) => (
                <Link
                  key={m.slug}
                  href={`/categorias/${m.categoriaSlug}`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FBFBFA] border border-[#EAEAEA] hover:border-[#111111] rounded-full text-sm text-[#111111] font-medium transition-colors"
                >
                  {m.nombre}
                  <IconArrow className="w-3.5 h-3.5 text-[#787774]" />
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ — divided list, no cards */}
        <section className="py-24 lg:py-32">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-4">
              Preguntas frecuentes
            </p>
            <h2
              className="text-[#111111] leading-[1.1] mb-16"
              style={{ fontSize: 'clamp(1.875rem, 3.5vw, 3rem)', fontWeight: 500, letterSpacing: '-0.01em' }}
            >
              Lo que <span className="font-[var(--font-serif)] italic" style={{ fontWeight: 400 }}>siempre</span> nos preguntan.
            </h2>
            <dl className="border-t border-[#EAEAEA]">
              {FAQ.map((f, i) => (
                <div key={i} className="py-8 border-b border-[#EAEAEA]">
                  <dt className="text-lg lg:text-xl text-[#111111] font-medium mb-3 tracking-[-0.005em]">
                    {f.q}
                  </dt>
                  <dd className="text-base text-[#5A5A57] leading-relaxed">
                    {f.a}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* CTA final — navy editorial */}
        <section className="py-24 lg:py-32 bg-navy-950 text-white border-t border-white/10">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-[10px] font-semibold text-white/55 uppercase tracking-[0.22em] mb-6">
              Tu cotización en 30 segundos
            </p>
            <h2
              className="text-white leading-[1.1] mb-8"
              style={{ fontSize: 'clamp(1.875rem, 3.5vw, 3rem)', fontWeight: 500, letterSpacing: '-0.01em' }}
            >
              ¿Tienes una <span className="font-[var(--font-serif)] italic" style={{ fontWeight: 400 }}>cotización</span>?
            </h2>
            <p className="text-base lg:text-lg text-white/75 mb-12 max-w-2xl mx-auto leading-relaxed">
              Sube tu cotización ahora y te respondemos en menos de dos horas hábiles con una contraoferta JURMAQ por correo.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                href="/cotizar"
                className="inline-flex items-center gap-2 bg-white text-[#111111] px-6 py-3 rounded-lg text-sm font-medium tracking-[0.02em] hover:bg-white/90 transition-colors"
              >
                Subir cotización
                <IconArrow className="w-4 h-4" />
              </Link>
              <a
                href={HQ.whatsapp + "?text=Hola%2C%20quiero%20que%20me%20mejoren%20una%20cotización"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border border-white/25 text-white px-6 py-3 rounded-lg text-sm font-medium tracking-[0.02em] hover:bg-white/10 transition-colors"
              >
                <IconWhatsapp className="w-4 h-4" />
                WhatsApp +56 9 7667 3577
              </a>
            </div>
          </div>
        </section>
      </article>
    </>
  );
}
