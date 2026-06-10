import type { Metadata } from "next";
import Link from "next/link";
import { whatsappCtaHome } from "@jurmaq/shared/whatsapp";
import { IconWhatsapp } from "@jurmaq/shared/icons";

export const metadata: Metadata = {
  title: "Cómo Funciona el Arriendo de Maquinaria · JURMAQ",
  description:
    "Conoce nuestro proceso de arriendo de maquinaria en 4 pasos simples: cotiza online, confirma, recibe el equipo en obra y devuélvelo cuando termines. Sin sorpresas en el precio, contrato digital y respuesta en menos de 2 horas.",
  alternates: {
    canonical: "https://jurmaq.cl/como-funciona",
  },
  openGraph: {
    title: "Cómo Funciona el Arriendo de Maquinaria · JURMAQ",
    description:
      "Proceso de arriendo en 4 pasos: cotiza, confirma, recibe y devuelve. Contrato digital, respuesta en menos de 2 horas.",
    url: "https://jurmaq.cl/como-funciona",
  },
};

const STEPS = [
  {
    n: "01",
    title: "Cotizas online",
    desc: "Eliges máquina, fechas y obra. O subes una cotización de la competencia y la mejoramos.",
    detail: ["Catálogo con precios visibles", "Disponibilidad en tiempo real", "Sin registro obligatorio"],
  },
  {
    n: "02",
    title: "Confirmamos en 2 horas",
    desc: "Un ejecutivo valida tu pedido y te envía el contrato digital por WhatsApp o email.",
    detail: ["Respuesta humana, no bots", "Firma digital OTP por WhatsApp", "Sin letra chica"],
  },
  {
    n: "03",
    title: "Recibes en obra",
    desc: "Coordinamos traslado a Curicó, Molina, Teno, Talca o donde estés. Operador certificado incluido en maquinaria de movimiento de tierra.",
    detail: ["Despacho propio", "Entrega coordinada por GPS", "Mantención al día"],
  },
  {
    n: "04",
    title: "Devuelves cuando termines",
    desc: "Coordinamos el retiro al finalizar. Si extendiste el plazo, te ajustamos la factura sin sorpresas.",
    detail: ["Factura electrónica al instante", "Sin penalizaciones ocultas", "Garantía Klap en tarjeta (hold + liberación automática)"],
  },
];

const FAQ = [
  {
    q: "¿Cuánto tiempo demoran en confirmar mi cotización?",
    a: "Menos de 2 horas en horario laboral (8:30 a 18:30, lunes a viernes; 9:00 a 14:00 sábado). Fuera de horario, te respondemos al abrir.",
  },
  {
    q: "¿Cuál es el plazo mínimo de arriendo?",
    a: "Depende de la máquina. Algunos equipos parten desde 1 día y otros desde 1 semana. El plazo mínimo aparece en cada ficha del catálogo.",
  },
  {
    q: "¿Incluyen operador?",
    a: "Depende del equipo. La retroexcavadora, la miniexcavadora, los minicargadores y el camión tolva incluyen operador certificado en la tarifa: no pagas extra. Las plataformas elevadoras y el brazo articulado se entregan listos para que los opere tu equipo, con curso de operación vigente.",
  },
  {
    q: "¿Qué pasa si la máquina se daña en obra?",
    a: "Tienes 24 horas para reportarlo por WhatsApp. Si el daño es por uso normal, nosotros nos hacemos cargo. Si fue mal uso, lo cobramos según catálogo de daños transparente.",
  },
  {
    q: "¿Hacen despacho fuera de la Región del Maule?",
    a: "Sí, llegamos hasta Rancagua por el norte y Linares por el sur. Cobra traslado por km, te lo cotizamos antes de confirmar.",
  },
  {
    q: "¿Cómo pago?",
    a: "Transferencia bancaria, tarjeta vía Klap o factura a 30 días para empresas con convenio. El método se elige al confirmar la cotización.",
  },
];

export default function ComoFuncionaPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Hero — editorial */}
      <section className="bg-navy-950 py-20 lg:py-28 border-b border-navy-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-2 text-sm text-white/55 mb-6 flex-wrap">
            <Link href="/" className="hover:text-gold-400 transition-colors">Inicio</Link>
            <svg className="w-3.5 h-3.5 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-white/85 font-medium">Cómo funciona</span>
          </nav>
          <p className="text-[10px] font-semibold text-gold-400 uppercase tracking-[0.22em] mb-6">
            Proceso · 4 pasos · 2 horas
          </p>
          <h1
            className="text-white leading-[1.05] mb-6 max-w-4xl"
            style={{ fontSize: 'clamp(2.25rem, 5vw, 4rem)', fontWeight: 500, letterSpacing: '-0.015em' }}
          >
            Arrendar maquinaria{' '}
            <span className="font-[var(--font-serif)] italic text-gold-400" style={{ fontWeight: 400 }}>
              sin complicaciones
            </span>.
          </h1>
          <p className="text-base lg:text-lg text-white/75 max-w-2xl leading-relaxed">
            4 pasos, respuesta el mismo día y contrato digital. Así trabajamos hace 27 años.
          </p>
        </div>
      </section>

      {/* Steps — divided list editorial (sin franja blanca, sin cards gray) */}
      <section className="py-20 lg:py-28 bg-[#FBFBFA]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-3">
            Cómo funciona
          </p>
          <h2
            className="text-[#111111] leading-[1.1] mb-14 max-w-3xl"
            style={{ fontSize: 'clamp(1.875rem, 3.5vw, 3rem)', fontWeight: 500, letterSpacing: '-0.01em' }}
          >
            De cotizar a recibir, en{' '}
            <span className="font-[var(--font-serif)] italic" style={{ fontWeight: 400 }}>menos de un día</span>.
          </h2>
          <ol className="border-t border-[#EAEAEA]">
            {STEPS.map((step) => (
              <li
                key={step.n}
                className="grid grid-cols-[80px_1fr] lg:grid-cols-[120px_280px_1fr] gap-x-6 lg:gap-x-10 gap-y-3 py-8 lg:py-10 border-b border-[#EAEAEA]"
              >
                <p className="font-[var(--font-serif)] italic text-[#956400] text-2xl lg:text-3xl leading-none" style={{ fontWeight: 400 }}>
                  {step.n}
                </p>
                <h3 className="text-lg lg:text-xl font-medium text-[#111111] tracking-[-0.005em] col-span-2 lg:col-span-1">
                  {step.title}
                </h3>
                <div className="col-span-2 lg:col-span-1">
                  <p className="text-base text-[#5A5A57] leading-relaxed mb-3">{step.desc}</p>
                  <ul className="space-y-1.5">
                    {step.detail.map((d) => (
                      <li key={d} className="flex items-start gap-2 text-sm text-[#5A5A57]">
                        <svg className="w-3.5 h-3.5 text-[#956400] shrink-0 mt-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="m5 12 5 5L20 7" />
                        </svg>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Diferenciadores — reemplaza hero-metric template (impeccable banned)
          por editorial divisible list con números inline en Newsreader italic. */}
      <section className="py-24 lg:py-32 bg-navy-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="eyebrow text-gold-400 mb-4">Cuatro razones · medibles</p>
          <h2 className="editorial-h1 text-white mb-12 max-w-3xl" style={{ fontSize: 'clamp(2rem, 3vw + 1rem, 3.25rem)' }}>
            ¿Por qué arrendar con{' '}
            <span className="font-[var(--font-serif)] italic text-gold-500" style={{ fontWeight: 500 }}>JURMAQ</span>?
          </h2>

          <div className="border-t border-navy-800 divide-y divide-navy-800">
            {[
              { n: '27', unit: 'años', l: 'en la Región del Maule', s: 'Conocemos cada obra de la zona, no llegamos a probar.' },
              { n: '<2h', unit: '', l: 'respuesta promedio en horario hábil', s: 'Te confirma un ejecutivo humano, no un bot.' },
              { n: '100%', unit: '', l: 'flota propia y operativa', s: 'Nada de subarriendos a terceros ni excusas de disponibilidad.' },
              { n: '0', unit: '', l: 'sorpresas en factura', s: 'Lo cotizado es lo que pagas. Si cambia el alcance, lo conversamos antes.' },
            ].map((it) => (
              <div key={it.l} className="grid grid-cols-12 gap-4 lg:gap-8 py-7 lg:py-9 items-baseline">
                <div className="col-span-12 lg:col-span-3 flex items-baseline gap-1.5">
                  <span className="font-[var(--font-serif)] italic text-gold-500 tabular-nums" style={{ fontSize: 'clamp(2.5rem, 3vw + 1rem, 3.5rem)', fontWeight: 500, lineHeight: 1, letterSpacing: '-0.02em' }}>
                    {it.n}
                  </span>
                  {it.unit && (
                    <span className="text-base text-gray-400 lg:text-lg" style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>
                      {it.unit}
                    </span>
                  )}
                </div>
                <div className="col-span-12 lg:col-span-9">
                  <p className="text-lg lg:text-xl text-white font-medium mb-1.5 tracking-tight">{it.l}</p>
                  <p className="text-sm lg:text-base text-gray-400 max-w-[55ch] leading-relaxed">{it.s}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ — editorial divided list */}
      <section className="py-20 lg:py-28 bg-white border-y border-[#EAEAEA]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-3">
            Preguntas frecuentes
          </p>
          <h2
            className="text-[#111111] leading-[1.1] mb-14"
            style={{ fontSize: 'clamp(1.875rem, 3.5vw, 3rem)', fontWeight: 500, letterSpacing: '-0.01em' }}
          >
            Lo que más{' '}
            <span className="font-[var(--font-serif)] italic" style={{ fontWeight: 400 }}>nos preguntan</span>.
          </h2>
          <dl className="border-t border-[#EAEAEA]">
            {FAQ.map((f) => (
              <details
                key={f.q}
                className="group py-6 border-b border-[#EAEAEA]"
              >
                <summary className="flex items-center justify-between cursor-pointer text-[#111111] text-base lg:text-lg list-none font-medium tracking-[-0.005em]">
                  <span>{f.q}</span>
                  <svg className="w-4 h-4 text-[#787774] shrink-0 ml-4 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <p className="mt-3 text-base text-[#5A5A57] leading-relaxed pr-8">{f.a}</p>
              </details>
            ))}
          </dl>
        </div>
      </section>

      {/* CTA final — navy-950 consistente (antes era bg-gold-500 chillón) */}
      <section className="py-20 lg:py-28 bg-navy-950 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-[10px] font-semibold text-gold-400 uppercase tracking-[0.22em] mb-6">
            Tu cotización en 60 segundos
          </p>
          <h2
            className="text-white leading-[1.1] mb-6"
            style={{ fontSize: 'clamp(1.875rem, 3.5vw, 3rem)', fontWeight: 500, letterSpacing: '-0.01em' }}
          >
            ¿Listo para tu{' '}
            <span className="font-[var(--font-serif)] italic" style={{ fontWeight: 400 }}>próximo arriendo</span>?
          </h2>
          <p className="text-base lg:text-lg text-white/75 mb-10 max-w-2xl mx-auto leading-relaxed">
            Ve el catálogo o escríbenos por WhatsApp con tu cotización de la competencia. La mejoramos en menos de 2 horas.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/maquinarias"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-[#111111] text-sm font-medium tracking-[0.02em] rounded-lg hover:bg-white/90 transition-colors"
            >
              Ver catálogo
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>
            <a
              href={whatsappCtaHome()}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-white/25 text-white text-sm font-medium tracking-[0.02em] rounded-lg hover:bg-white/10 transition-colors"
            >
              <IconWhatsapp className="w-4 h-4" />
              Cotizar por WhatsApp
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
