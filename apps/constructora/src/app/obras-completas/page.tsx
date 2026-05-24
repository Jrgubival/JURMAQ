import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * /obras-completas — Página del programa "mejora precio por obra completa".
 *
 * Diferenciador: ningún competidor chileno (Sodimac/Easy/Construmart/Prodalam/
 * Rendalomaq) ofrece formalmente descuento por arriendo multi-equipo + materiales
 * en una sola propuesta. JURMAQ sí, porque es las 4 cosas (constructora +
 * arriendo + barraca + maestranza) en una marca.
 *
 * Editorial Luxury aplicado: serif H1 + eyebrow + asymmetric (no centered hero),
 * editorial prose para los bloques de info (no card grids), CTA negro sólido.
 */

export const metadata: Metadata = {
  title: 'Mejora precio por obra completa · JURMAQ',
  description:
    'Si arriendas más de una máquina, o si combinas arriendo con materiales de barraca, te armamos un presupuesto único con mejor precio. Caso a caso, revisado por ejecutivo. Curicó, Molina, Talca y toda la Región del Maule.',
  alternates: { canonical: 'https://jurmaq.cl/obras-completas' },
  openGraph: {
    title: 'Mejora precio por obra completa · JURMAQ',
    description:
      'Más de una máquina, o máquina + materiales: cotización unificada con descuento personalizado.',
    url: 'https://jurmaq.cl/obras-completas',
  },
};

function IconArrowRight(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

export default function ObrasCompletasPage() {
  const supuestos = [
    {
      label: 'Construyendo un galpón',
      desc:
        'Necesitas retro para fundaciones + camión tolva para tierra + fierro + cemento + planchas. En vez de pedirlos por separado a 4 proveedores, armamos un solo presupuesto.',
    },
    {
      label: 'Ampliación industrial',
      desc:
        'Plataforma elevadora + brazo articulado + minicargador + barraca para perfiles y zincalum. Pagas un solo IVA, un solo despacho, un solo contacto.',
    },
    {
      label: 'Movimiento de tierras grande',
      desc:
        'Más de una máquina en obra simultánea. El descuento sube proporcional a la cantidad de equipos y al monto total.',
    },
  ];

  const proceso = [
    {
      n: '01',
      title: 'Nos contás qué obra es',
      desc:
        'Por WhatsApp, formulario o llamada. Necesitamos saber el tipo de obra, la ubicación, la fecha de inicio y qué máquinas o materiales tenés en mente.',
    },
    {
      n: '02',
      title: 'Revisamos el caso en menos de 24h',
      desc:
        'Un ejecutivo arma la cotización integrada. Verifica disponibilidad real de cada equipo, cuadra los traslados, suma los materiales y calcula el descuento.',
    },
    {
      n: '03',
      title: 'Te enviamos un presupuesto único',
      desc:
        'PDF con todos los ítems, total con IVA, condiciones de pago y plazo de entrega. Si lo aceptas, firmamos contrato digital con OTP y arrancamos.',
    },
  ];

  return (
    <>
      {/* HERO — split asymmetric, NO centered */}
      <section className="relative bg-[#FBFBFA] overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none opacity-50"
          style={{
            backgroundImage:
              'radial-gradient(70% 50% at 80% 20%, rgba(149,100,0,0.05) 0%, transparent 60%)',
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 lg:pt-28 lg:pb-32">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            <div className="lg:col-span-8 reveal-on-load">
              <div className="flex items-center gap-2 text-sm text-[#787774] mb-5">
                <Link href="/" className="hover:text-[#111111] transition-spring">
                  Inicio
                </Link>
                <span>›</span>
                <span className="text-[#111111]">Mejora precio obra completa</span>
              </div>

              <p className="eyebrow mb-5">Único en Chile · propuesta integrada</p>

              <h1
                className="editorial-h1 text-[#111111] mb-6"
                style={{ fontSize: 'clamp(2.5rem, 5vw + 1rem, 5rem)' }}
              >
                Una obra,{' '}
                <span className="italic text-[#956400]">un solo presupuesto</span>,
                mejor precio.
              </h1>

              <p className="text-[#2F3437] text-lg leading-relaxed max-w-[58ch] mb-8">
                Si arriendas más de una máquina, o si combinas máquinas con materiales
                de la barraca, no pagás cada cosa por separado. Te armamos una sola
                propuesta integrada con descuento personalizado.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="https://wa.me/56976673577?text=Hola%2C%20quiero%20precio%20personalizado%20para%20una%20obra%20completa&utm_source=site&utm_medium=hero&utm_campaign=obra_completa"
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="group inline-flex items-center gap-3 px-6 py-3.5 bg-[#111111] hover:bg-[#2F3437] text-white text-sm font-semibold rounded-[10px] transition-spring tactile"
                >
                  Pedir precio personalizado
                  <IconArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-spring" />
                </a>
                <Link
                  href="/maquinarias"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 hairline rounded-[10px] text-[#111111] hover:bg-white text-sm font-medium transition-spring tactile"
                >
                  Ver flota disponible
                </Link>
              </div>

              <p className="text-xs text-[#787774] mt-4">
                Respuesta de ejecutivo en menos de 24 horas hábiles
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CUÁNDO APLICA — Editorial prose, no card grid */}
      <section className="bg-white border-t border-[#EAEAEA] py-24 lg:py-32">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-14 max-w-2xl">
            <p className="eyebrow mb-4">Ejemplos reales</p>
            <h2
              className="editorial-h1 text-[#111111]"
              style={{ fontSize: 'clamp(2rem, 3vw + 1rem, 3.25rem)' }}
            >
              ¿Cuándo conviene?
            </h2>
          </div>

          <div className="space-y-12 lg:space-y-16">
            {supuestos.map((s, i) => (
              <article
                key={s.label}
                className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 border-b border-[#EAEAEA] pb-12 last:border-b-0 last:pb-0"
              >
                <div className="lg:col-span-3">
                  <p
                    className="font-[var(--font-serif)] italic text-[#956400] tabular-nums"
                    style={{
                      fontSize: 'clamp(2.5rem, 3vw + 1rem, 3.5rem)',
                      fontWeight: 400,
                      lineHeight: 1,
                    }}
                  >
                    0{i + 1}
                  </p>
                </div>
                <div className="lg:col-span-9">
                  <h3
                    className="font-[var(--font-serif)] text-[#111111] mb-3"
                    style={{
                      fontSize: 'clamp(1.4rem, 1.5vw + 0.75rem, 1.85rem)',
                      fontWeight: 500,
                      letterSpacing: '-0.02em',
                      lineHeight: 1.2,
                    }}
                  >
                    {s.label}
                  </h3>
                  <p className="text-[#2F3437] leading-relaxed max-w-[62ch]">{s.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA — Zig-zag 3 pasos */}
      <section className="bg-[#FBFBFA] border-t border-[#EAEAEA] py-24 lg:py-32">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-14 max-w-2xl">
            <p className="eyebrow mb-4">Tres pasos · cero burocracia</p>
            <h2
              className="editorial-h1 text-[#111111]"
              style={{ fontSize: 'clamp(2rem, 3vw + 1rem, 3.25rem)' }}
            >
              Cómo cotizamos tu obra.
            </h2>
          </div>

          <div className="space-y-14 lg:space-y-20">
            {proceso.map((p, idx) => {
              const right = idx % 2 === 1;
              return (
                <div
                  key={p.n}
                  className={`grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start ${
                    right ? 'lg:[&>*:first-child]:order-2' : ''
                  }`}
                >
                  <div className="lg:col-span-5">
                    <div className="hairline bg-white rounded-[16px] aspect-[4/3] flex items-center justify-center shadow-diffuse">
                      <p
                        className="font-[var(--font-serif)] italic text-[#787774]"
                        style={{ fontSize: '5rem', lineHeight: 1 }}
                      >
                        {p.n}
                      </p>
                    </div>
                  </div>
                  <div className="lg:col-span-7">
                    <p className="eyebrow mb-3">Paso {p.n}</p>
                    <h3
                      className="font-[var(--font-serif)] text-[#111111] mb-4 tracking-tight"
                      style={{
                        fontSize: 'clamp(1.5rem, 2vw + 0.5rem, 2.25rem)',
                        fontWeight: 500,
                        lineHeight: 1.15,
                      }}
                    >
                      {p.title}
                    </h3>
                    <p className="text-[#2F3437] leading-relaxed max-w-[60ch]">{p.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="bg-[#111111] py-24 lg:py-32">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-end">
            <div className="lg:col-span-8">
              <p className="eyebrow text-[#787774] mb-4">
                Para constructoras, contratistas y maestros
              </p>
              <h2
                className="editorial-h1 text-white"
                style={{ fontSize: 'clamp(2rem, 3vw + 1rem, 3.25rem)' }}
              >
                Una sola llamada. Una sola cotización.{' '}
                <span className="italic text-[#FBE49C]">Un solo precio.</span>
              </h2>
            </div>
            <div className="lg:col-span-4 lg:text-right">
              <a
                href="https://wa.me/56976673577?text=Hola%2C%20quiero%20precio%20de%20obra%20completa&utm_source=site&utm_medium=footer&utm_campaign=obra_completa"
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="group inline-flex items-center gap-3 px-6 py-3.5 bg-white hover:bg-[#F7F6F3] text-[#111111] text-sm font-semibold rounded-[10px] transition-spring tactile"
              >
                Pedir mi presupuesto
                <IconArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-spring" />
              </a>
              <p className="text-xs text-[#787774] mt-3 lg:text-right">
                Respondemos en menos de 24 horas hábiles
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
