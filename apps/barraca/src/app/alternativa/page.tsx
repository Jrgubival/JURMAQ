import type { Metadata } from "next";
import Link from "next/link";
import { COMPETIDORES_DATA } from "@/lib/competidores-data";
import TrustSignals, { COMPARACION_KPIS } from "@/components/TrustSignals";

export const metadata: Metadata = {
  title: "Alternativas a Sodimac, Easy y otras barracas en el Maule · JURMAQ",
  description:
    "Compara JURMAQ Barraca con Sodimac, Easy, Construmart e Imperial para tu obra en Curicó, Talca y el Maule. Mejor precio garantizado contra cotización formal.",
  keywords: [
    "alternativa sodimac",
    "alternativa easy",
    "alternativa construmart",
    "alternativa imperial",
    "barraca Curicó",
    "barraca Maule",
    "comparar barracas chile",
  ],
  openGraph: {
    title: "Compara JURMAQ Barraca vs Sodimac, Easy, Construmart, Imperial",
    description:
      "JURMAQ Barraca: despacho local desde Molina, mejor precio contra cotización, atención WhatsApp directa para obras en el Maule.",
    url: "https://barraca.jurmaq.cl/alternativa",
    siteName: "Barraca JURMAQ",
    locale: "es_CL",
    type: "website",
  },
  alternates: {
    canonical: "https://barraca.jurmaq.cl/alternativa",
  },
};

export default function AlternativasIndexPage() {
  return (
    <article className="bg-white">
      <header className="bg-navy-950 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4">
            Alternativas a las grandes cadenas en el Maule
          </h1>
          <p className="text-lg text-gray-200 max-w-3xl">
            Compara JURMAQ Barraca vs Sodimac, Easy, Construmart e Imperial. Comparativos
            honestos por categoría, precio, despacho y atención. Tú decides.
          </p>
        </div>
      </header>

      <TrustSignals variant="light" items={COMPARACION_KPIS} />

      <section className="py-12 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-navy-950 mb-8">
            Compara JURMAQ vs cada cadena
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {COMPETIDORES_DATA.map((c) => (
              <Link
                key={c.slug}
                href={`/alternativa/${c.slug}`}
                className="block bg-gray-50 hover:bg-orange-50 border border-gray-200 hover:border-orange-300 rounded-xl p-6 transition-colors group"
              >
                <h3 className="text-xl font-bold text-navy-950 group-hover:text-orange-700 mb-2">
                  Alternativa a {c.nombre}
                </h3>
                <p className="text-sm text-gray-600 mb-3">{c.descripcionCompetidor}</p>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-orange-700">
                  Ver comparación
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-orange-50 border-t border-orange-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-4">
            ¿Tienes cotización de otra cadena?
          </h2>
          <p className="text-gray-700 mb-8">
            Súbela en /te-mejoramos-el-precio y respondemos con un mejor precio en 2 horas.
          </p>
          <Link
            href="/te-mejoramos-el-precio"
            className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-8 py-4 rounded-lg font-bold text-lg transition-colors"
          >
            Te mejoramos el precio
          </Link>
        </div>
      </section>
    </article>
  );
}
