import type { Metadata } from "next";
import Link from "next/link";
import { whatsappCtaHome } from "@jurmaq/shared/whatsapp";

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
    title: "Cotiza online en 1 minuto",
    desc: "Elige tu máquina del catálogo, indica fechas y dirección de obra. Si te complica, sube una cotización de la competencia y te la mejoramos.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    detail: ["Catálogo completo con precios visibles", "Calendario de disponibilidad en tiempo real", "Sin registro obligatorio"],
  },
  {
    n: "02",
    title: "Te confirmamos en menos de 2 horas",
    desc: "Un ejecutivo revisa tu cotización, valida disponibilidad y te envía el contrato digital por WhatsApp o email. Sin letra chica.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
    detail: ["Respuesta humana, no bots", "Firma digital con OTP por WhatsApp", "Contrato con cláusulas claras"],
  },
  {
    n: "03",
    title: "Recibes el equipo en obra",
    desc: "Coordinamos el traslado al punto exacto en Curicó, Molina, Teno, Talca o donde estés en la Región del Maule. Operador certificado opcional.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
      </svg>
    ),
    detail: ["Despacho propio (no tercerizado)", "Entrega coordinada por GPS", "Mantención al día garantizada"],
  },
  {
    n: "04",
    title: "Devuelves cuando termines",
    desc: "Al finalizar el arriendo coordinamos el retiro. Si extendiste sin pasarte del límite, te ajustamos la factura sin recargos sorpresa.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    detail: ["Factura electrónica al instante", "Sin penalizaciones ocultas", "Garantías Klap (próximamente)"],
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
    a: "Sí, opcional. Puedes arrendar con o sin operador. Si pides operador, viene certificado y con todos los seguros vigentes.",
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

      {/* Hero */}
      <section className="bg-navy-950 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <Link href="/" className="hover:text-gold-500 transition-colors">Inicio</Link>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-gray-300">Cómo Funciona</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-white mb-4">
            Arrendar maquinaria <span className="text-gold-500">no tiene por qué ser complicado</span>
          </h1>
          <p className="text-lg lg:text-xl text-gray-300 max-w-3xl">
            4 pasos, respuesta el mismo día y contrato digital. Así trabajamos en JURMAQ desde hace +25 años.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section className="py-16 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            {STEPS.map((step) => (
              <div
                key={step.n}
                className="relative bg-gray-50 border border-gray-200 rounded-2xl p-8 lg:p-10 hover:border-gold-500/40 transition-colors"
              >
                <span className="absolute top-6 right-6 text-7xl font-black text-navy-950/5 leading-none select-none">
                  {step.n}
                </span>
                <div className="relative">
                  <div className="inline-flex items-center justify-center w-14 h-14 bg-gold-500/10 text-gold-600 rounded-xl mb-5">
                    {step.icon}
                  </div>
                  <h2 className="text-2xl font-bold text-navy-950 mb-3">{step.title}</h2>
                  <p className="text-gray-600 leading-relaxed mb-5">{step.desc}</p>
                  <ul className="space-y-2">
                    {step.detail.map((d) => (
                      <li key={d} className="flex items-start gap-2 text-sm text-gray-700">
                        <svg className="w-5 h-5 text-gold-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Diferenciadores */}
      <section className="py-16 lg:py-20 bg-navy-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl lg:text-4xl font-extrabold text-white text-center mb-12">
            ¿Por qué arrendar con <span className="text-gold-500">JURMAQ</span>?
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {[
              { v: "+25", l: "años en la zona", s: "Conocemos cada obra del Maule." },
              { v: "<2h", l: "respuesta promedio", s: "Te confirmamos el mismo día." },
              { v: "100%", l: "flota propia", s: "Nada de subarriendos." },
              { v: "0", l: "sorpresas en factura", s: "Lo cotizado es lo que pagas." },
            ].map((it) => (
              <div key={it.l} className="text-center">
                <div className="text-5xl lg:text-6xl font-extrabold text-gold-500 mb-2">{it.v}</div>
                <div className="text-base lg:text-lg font-semibold text-white mb-1">{it.l}</div>
                <div className="text-sm text-gray-500">{it.s}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 lg:py-24 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl lg:text-4xl font-extrabold text-navy-950 mb-3 text-center">
            Preguntas frecuentes
          </h2>
          <p className="text-lg text-gray-600 text-center mb-12">
            Lo que más nos preguntan antes de arrendar.
          </p>
          <div className="space-y-4">
            {FAQ.map((f) => (
              <details
                key={f.q}
                className="group bg-white border border-gray-200 rounded-xl p-5 hover:border-gold-500/40 transition-colors"
              >
                <summary className="flex items-center justify-between cursor-pointer text-navy-950 font-semibold text-base lg:text-lg list-none">
                  <span>{f.q}</span>
                  <svg className="w-5 h-5 text-gold-500 shrink-0 ml-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <p className="mt-3 text-gray-600 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 lg:py-20 bg-gold-500">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-extrabold text-navy-950 mb-4">
            ¿Listo para tu próximo arriendo?
          </h2>
          <p className="text-base lg:text-lg text-navy-900 mb-8 max-w-2xl mx-auto">
            Ve el catálogo completo o escríbenos por WhatsApp con tu cotización de la competencia y te la mejoramos en menos de 2 horas.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/maquinarias"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-navy-950 hover:bg-navy-900 text-white font-bold text-base rounded-xl transition-colors"
            >
              Ver catálogo
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            <a
              href={whatsappCtaHome()}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white hover:bg-gray-50 text-navy-950 font-bold text-base rounded-xl transition-colors"
            >
              💬 Cotizar por WhatsApp
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
