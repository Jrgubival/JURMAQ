import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Plus } from '@phosphor-icons/react/dist/ssr';
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';
import { AccionesContacto, BarraMovil } from '@/components/AccionesContacto';
import { MosaicoFlota } from '@/components/TarjetaMaquina';
import { COMUNAS } from '@/data/comunas';
import { obtenerFlota } from '@/lib/flota';
import { jsonLdNegocio } from '@/lib/jsonld';
import { COMUNAS_MAULE, distanciaDesdeBase } from '@/lib/landings';
import { SITIO } from '@/lib/sitio';

export const revalidate = 2592000;

export const metadata: Metadata = {
  title: 'Arriendo de Maquinaria en Curicó, Molina y Talca · JURMAQ',
  description: 'Arriendo de retroexcavadora, miniexcavadora, minicargador, camión tolva, brazo articulado y alzahombre en toda la Región del Maule. Valores a la vista. Desde 2000.',
  alternates: { canonical: SITIO.url },
};

const TRABAJOS = [
  { trabajo: 'Zanjas y fundaciones', tipo: 'retroexcavadora', maquina: 'Retroexcavadora' },
  { trabajo: 'Excavar donde no cabe otra', tipo: 'miniexcavadora', maquina: 'Miniexcavadora' },
  { trabajo: 'Cargar y limpiar', tipo: 'minicargador', maquina: 'Minicargador' },
  { trabajo: 'Mover tierra y áridos', tipo: 'camion-tolva', maquina: 'Camión tolva' },
  { trabajo: 'Llegar alto y lejos', tipo: 'brazo-articulado', maquina: 'Brazo articulado' },
  { trabajo: 'Subir en vertical', tipo: 'alzahombre', maquina: 'Alzahombre' },
];

const PREGUNTAS = [
  { q: '¿La máquina viene con operador?', a: 'Retroexcavadora, miniexcavadora y minicargador van con operador, y el camión tolva con conductor. Brazo articulado y plataformas los opera tu personal, con curso vigente.' },
  { q: '¿El valor incluye traslado?', a: 'No. El traslado se cotiza aparte según la comuna de la obra.' },
  { q: '¿Los valores incluyen IVA?', a: 'No. Son valores netos y referenciales. La cotización detalla neto, IVA y total.' },
  { q: '¿Dónde arriendan?', a: 'En toda la Región del Maule, desde nuestra base en Maquehua, Curicó.' },
];

export default async function Inicio() {
  const flota = await obtenerFlota();
  const heroe = flota.find((m) => m.tipo === 'retroexcavadora') ?? flota[0];
  const texto = 'Hola, quiero cotizar el arriendo de una máquina.';
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLdNegocio(COMUNAS_MAULE)) }} />

      <section className="relative isolate flex min-h-[calc(100dvh-68px)] items-end overflow-hidden bg-negro text-white">
        {heroe?.fotos[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroe.fotos[0]} alt={heroe.nombre} width={1600} height={1066} fetchPriority="high" className="foto-hero absolute inset-0 -z-20 h-full w-full object-cover object-[60%_50%]" />
        ) : null}
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/95 via-black/55 to-black/10 md:bg-gradient-to-r md:from-black/90 md:via-black/50 md:to-transparent" />
        {heroe?.fotoReferencial ? <span className="absolute right-3 top-3 bg-negro/75 px-2 py-1 text-xs">Imagen referencial</span> : null}
        <div className="mx-auto w-full max-w-[1320px] px-4 pb-24 pt-32 md:px-8 md:pb-20">
          <h1 className="entra max-w-[13ch] text-[clamp(3.25rem,10vw,8rem)] leading-[1]" style={{ '--i': 0 } as React.CSSProperties}>Maquinaria en arriendo en el Maule</h1>
          <p className="entra mt-5 max-w-[34ch] text-lg text-white/85 md:text-xl" style={{ '--i': 1 } as React.CSSProperties}>Retroexcavadoras, minicargadores, camión tolva y equipos de altura. Desde {SITIO.anioInicio}.</p>
          <div className="entra mt-7 hidden md:block" style={{ '--i': 2 } as React.CSSProperties}><AccionesContacto cotizar="/cotizar-arriendo" texto={texto} /></div>
        </div>
      </section>

      <section aria-labelledby="trabajo" className="bg-acento text-[#111]">
        <div className="mx-auto max-w-[1320px] px-4 py-16 md:px-8 md:py-24">
          <h2 id="trabajo" className="grande revela">¿Qué trabajo tienes?</h2>
          <ul className="mt-10 grid gap-x-12 md:grid-cols-2">
            {TRABAJOS.map((t) => (
              <li key={t.tipo} className="border-t-2 border-[#111]">
                <Link href={`/arriendo/${t.tipo}`} prefetch={false} className="fila-trabajo presionable flex items-center justify-between gap-4 py-5">
                  <span>
                    <span className="block font-titulo text-[clamp(1.625rem,3vw,2.5rem)] font-semibold uppercase leading-tight">{t.trabajo}</span>
                    <span className="mt-1 block text-[0.9375rem]">{t.maquina}</span>
                  </span>
                  <ArrowRight size={30} className="flecha shrink-0" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="flota" className="mx-auto max-w-[1320px] px-1 py-16 md:px-8 md:py-24">
        <div className="mb-8 flex items-end justify-between gap-4 px-3 md:px-0">
          <h2 id="flota" className="grande">Flota y valores</h2>
          <Link href="/maquinarias" prefetch={false} className="mb-2 whitespace-nowrap font-medium underline underline-offset-4">Ver todas</Link>
        </div>
        <MosaicoFlota flota={flota} />
        <p className="mt-4 px-3 text-sm text-ink-muted md:px-0">Valores referenciales y netos. El traslado se cotiza aparte.</p>
      </section>

      <section aria-labelledby="cobertura" className="bg-negro text-white">
        <div className="mx-auto max-w-[1320px] px-4 py-16 md:px-8 md:py-24">
          <h2 id="cobertura" className="grande revela max-w-[14ch]">Toda la Región del Maule</h2>
          <p className="mt-4 max-w-[46ch] text-lg text-white/75">Arrendamos desde nuestra base en Maquehua, Curicó.</p>
          <ul className="mt-10 grid grid-cols-2 gap-px bg-white/15 md:grid-cols-4">
            {COMUNAS.map((c) => {
              const d = distanciaDesdeBase(c.slug);
              return (
                <li key={c.slug} className="bg-negro">
                  <Link href={`/arriendo-en/${c.slug}`} prefetch={false} className="comuna presionable flex min-h-24 flex-col justify-between p-4">
                    <span className="font-titulo text-2xl font-semibold uppercase leading-tight">{c.nombre}</span>
                    {d ? <span className="font-cifra text-sm text-white/60">{d.km} km</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section aria-labelledby="preguntas" className="sobre-claro mx-auto grid max-w-[1320px] gap-10 px-4 py-16 md:grid-cols-[1fr_1.4fr] md:px-8 md:py-24">
        <div>
          <h2 id="preguntas" className="medio">Lo que más nos preguntan</h2>
          <div className="mt-6 hidden md:block"><AccionesContacto cotizar="/cotizar-arriendo" texto={texto} /></div>
        </div>
        <div>
          {PREGUNTAS.map((p) => (
            <details key={p.q} className="border-t border-[#111]/20 last:border-b">
              <summary className="presionable flex min-h-16 items-center justify-between gap-4 py-4 text-lg font-semibold">
                {p.q}<Plus size={22} className="mas shrink-0" aria-hidden />
              </summary>
              <p className="pb-5 text-ink-soft">{p.a}</p>
            </details>
          ))}
        </div>
      </section>

      <BarraMovil cotizar="/cotizar-arriendo" texto={texto} />
    </>
  );
}
