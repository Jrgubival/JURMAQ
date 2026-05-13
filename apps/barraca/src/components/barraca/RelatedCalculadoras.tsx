import Link from "next/link";

/**
 * RelatedCalculadoras — barra horizontal con las otras 4 calculadoras
 * de obra. Mejora discovery interno y SEO interlinking entre las 5 calcs.
 *
 * Pasar `currentSlug` para que la calc actual se omita del listado.
 *
 * Server component (sólo Link + datos estáticos), no client.
 */

interface CalculadoraEntry {
  slug: string;
  titulo: string;
  descripcion: string;
}

const CALCULADORAS: CalculadoraEntry[] = [
  {
    slug: "calculadora-fierro",
    titulo: "Fierro",
    descripcion: "Quintales por m² para losa, muro, radier",
  },
  {
    slug: "calculadora-cemento",
    titulo: "Cemento",
    descripcion: "Sacos 25 kg por radier, contrapiso, estuco",
  },
  {
    slug: "calculadora-hormigon",
    titulo: "Hormigón",
    descripcion: "Cemento + arena + gravilla por m³",
  },
  {
    slug: "calculadora-pintura",
    titulo: "Pintura",
    descripcion: "Litros por m² según tipo y manos",
  },
  {
    slug: "calculadora-zincalum",
    titulo: "Zincalum",
    descripcion: "Planchas + tornillería para techumbre",
  },
];

export default function RelatedCalculadoras({ currentSlug }: { currentSlug: string }) {
  const others = CALCULADORAS.filter((c) => c.slug !== currentSlug);

  return (
    <section
      className="py-12 bg-white border-t border-gray-200"
      aria-labelledby="related-calcs-heading"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4 mb-6">
          <h2 id="related-calcs-heading" className="text-xl font-bold text-navy-950">
            Otras calculadoras
          </h2>
          <Link
            href="/calculadoras"
            className="text-sm font-semibold text-orange-700 hover:text-orange-800"
          >
            Ver las 5 →
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {others.map((c) => (
            <Link
              key={c.slug}
              href={`/${c.slug}`}
              className="block bg-gray-50 hover:bg-orange-50 border border-gray-200 hover:border-orange-300 rounded-lg p-4 transition-colors group"
            >
              <p className="font-bold text-navy-950 group-hover:text-orange-700 mb-1">
                {c.titulo}
              </p>
              <p className="text-xs text-gray-500 leading-snug">{c.descripcion}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
