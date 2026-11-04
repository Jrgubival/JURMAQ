import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Plus, WhatsappLogo } from '@phosphor-icons/react/dist/ssr';
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';
import { BarraMovil } from '@/components/AccionesContacto';
import Foto, { variantes } from '@/components/Foto';
import TarjetaMaquina from '@/components/TarjetaMaquina';
import { COMUNAS } from '@/data/comunas';
import { obtenerFlota } from '@/lib/flota';
import { jsonLdNegocio } from '@/lib/jsonld';
import { COMUNAS_MAULE } from '@/lib/landings';
import { SITIO, enlaceWhatsapp } from '@/lib/sitio';

export const revalidate = 2592000;

export const metadata: Metadata = {
  title: 'Arriendo de Maquinaria en Curicó, Molina y Talca · JURMAQ',
  description: 'Arriendo de retroexcavadora, miniexcavadora, minicargador, camión tolva y equipos de altura en la Región del Maule. Desde 2000.',
  alternates: { canonical: SITIO.url },
};

const TRABAJOS = [
  { trabajo: 'Zanjas y fundaciones', tipo: 'retroexcavadora' },
  { trabajo: 'Excavar en espacios chicos', tipo: 'miniexcavadora' },
  { trabajo: 'Cargar y limpiar', tipo: 'minicargador' },
  { trabajo: 'Mover tierra y áridos', tipo: 'camion-tolva' },
  { trabajo: 'Llegar alto y lejos', tipo: 'brazo-articulado' },
  { trabajo: 'Subir en vertical', tipo: 'alzahombre' },
];

// Los seis equipos de la portada, en este orden.
const DESTACADAS = [1, 2, 5, 3, 4, 6];

const PASOS = [
  { t: 'Elige la máquina', d: 'Revisa los equipos y sus valores referenciales.' },
  { t: 'Solicita tu cotización', d: 'Indícanos la comuna, las fechas y cuánto tiempo la necesitas.' },
  { t: 'Coordina el arriendo', d: 'Confirmamos disponibilidad y traslado, y preparamos el contrato.' },
];

const PREGUNTAS = [
  { q: '¿El arriendo incluye operador?', a: 'Retroexcavadora, miniexcavadora y minicargador van con operador, y el camión tolva con conductor. Brazo articulado y plataformas los opera tu personal, con curso vigente.' },
  { q: '¿Cómo se calcula el traslado?', a: 'Se cotiza aparte, según el equipo y la comuna de la obra.' },
  { q: '¿Puedo arrendar por hora o por día?', a: 'Depende de la máquina. Cada ficha muestra sus valores y su mínimo.' },
  { q: '¿Qué necesito para cotizar?', a: 'La máquina, la comuna de la obra, las fechas y cuánto tiempo la necesitas.' },
  { q: '¿Los valores incluyen IVA?', a: 'No. Son valores netos y referenciales. La cotización detalla neto, IVA y total.' },
];

export default async function Inicio() {
  const flota = await obtenerFlota();
  const seis = DESTACADAS.flatMap((id) => flota.filter((m) => m.id === id));
  const heroe = flota.find((m) => m.tipo === 'retroexcavadora') ?? flota[0];
  const camion = flota.find((m) => m.tipo === 'camion') ?? flota[0];
  const texto = 'Hola, quiero cotizar el arriendo de una máquina.';
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLdNegocio(COMUNAS_MAULE)) }} />

      <section className="relative isolate overflow-hidden bg-negro text-white">
        {heroe?.fotos[0] ? (
          <div className="relative aspect-[3/2] md:absolute md:inset-y-0 md:right-0 md:-z-10 md:aspect-auto md:w-[62%]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroe.fotos[0]} alt={heroe.nombre} {...variantes(heroe.fotos[0], '(min-width: 768px) 62vw, 100vw')} width={1600} height={1066} fetchPriority="high" className="foto-hero h-full w-full object-cover" />
            <div aria-hidden className="absolute inset-0 hidden bg-gradient-to-r from-negro via-negro/30 to-transparent md:block" />
            {heroe.fotoReferencial ? <span className="absolute bottom-2 right-2 bg-negro/80 px-2 py-1 text-xs">Imagen referencial</span> : null}
          </div>
        ) : null}
        <div className="mx-auto max-w-[1320px] px-4 py-9 md:flex md:min-h-[560px] md:flex-col md:justify-center md:px-8 md:py-16">
          <h1 className="entra max-w-[14ch] text-[clamp(2.5rem,5vw,4rem)]">Arriendo de maquinaria en el Maule</h1>
          <p className="entra mt-4 max-w-[36ch] text-lg text-white/85" style={{ '--i': 1 } as React.CSSProperties}>Retroexcavadora, miniexcavadora, minicargador, camión tolva y equipos de altura. Desde {SITIO.anioInicio}.</p>
          <div className="entra mt-6 hidden flex-wrap gap-3 md:flex" style={{ '--i': 2 } as React.CSSProperties}>
            <a href="#equipos" className="boton boton-principal">Ver equipos <ArrowRight size={18} weight="bold" aria-hidden /></a>
            <a href={enlaceWhatsapp(texto)} rel="noopener" className="boton boton-secundario"><WhatsappLogo size={20} aria-hidden /> WhatsApp</a>
          </div>
        </div>
      </section>

      <section id="equipos" aria-labelledby="flota" className="mx-auto max-w-[1320px] scroll-mt-20 px-4 py-12 md:px-8 md:py-16">
        <h2 id="flota" className="grande">Maquinarias para arrendar</h2>
        <div className="mt-5">
          <p className="font-semibold">¿Qué trabajo tienes?</p>
          <ul className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
            {TRABAJOS.map((t) => (
              <li key={t.tipo} className="shrink-0"><Link href={`/arriendo/${t.tipo}`} prefetch={false} className="chip presionable bg-surface text-negro">{t.trabajo}</Link></li>
            ))}
          </ul>
        </div>
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {seis.map((m) => <TarjetaMaquina key={m.id} maquina={m} />)}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[0.9375rem] text-ink-soft">Valores netos + IVA. Consulta disponibilidad, mínimo y traslado.</p>
          <Link href="/maquinarias" prefetch={false} className="inline-flex min-h-11 items-center font-semibold text-acento-texto underline underline-offset-4">Ver toda la flota</Link>
        </div>
      </section>

      <section aria-labelledby="zona" className="bg-surface-alt">
        <div className="mx-auto grid max-w-[1320px] items-center gap-8 px-4 py-12 md:grid-cols-2 md:gap-12 md:px-8 md:py-16">
          {camion ? <Foto maquina={camion} className="aspect-[3/2] rounded-[var(--g-radio)]" /> : null}
          <div>
            <h2 id="zona" className="grande">Arriendo de maquinaria en Molina y Curicó</h2>
            <p className="mt-4 max-w-[52ch] text-lg text-ink-soft">Arrendamos para obras civiles, faenas agrícolas e industriales desde nuestra base en Maquehua, Curicó.</p>
            <p className="mt-3 max-w-[52ch] text-lg text-ink-soft">Cuéntanos dónde es el trabajo y te cotizamos el equipo y el traslado.</p>
            <p className="mt-5"><Link href="/arriendo-en/molina" prefetch={false} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">Molina</Link> <span className="px-1 text-ink-muted">y</span> <Link href="/arriendo-en/curico" prefetch={false} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">Curicó</Link></p>
          </div>
        </div>
      </section>

      <section aria-labelledby="pasos" className="mx-auto max-w-[1320px] px-4 py-12 md:px-8 md:py-16">
        <h2 id="pasos" className="grande">Cómo arrendar</h2>
        <ol className="mt-7 grid gap-6 md:grid-cols-3 md:gap-0 md:divide-x md:divide-hairline">
          {PASOS.map((p, i) => (
            <li key={p.t} data-revela className="flex gap-4 md:px-8 md:first:pl-0 md:last:pr-0">
              <span className="font-titulo text-4xl leading-none text-acento-texto">{i + 1}</span>
              <div><h3 className="text-2xl">{p.t}</h3><p className="mt-1 text-ink-soft">{p.d}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="cobertura" className="bg-negro text-white">
        <div className="mx-auto max-w-[1320px] px-4 py-12 md:px-8 md:py-16">
          <div className="md:flex md:items-end md:justify-between md:gap-8">
            <div>
              <h2 id="cobertura" className="grande">Equipos para tu faena en el Maule</h2>
              <p className="mt-3 text-lg text-white/80">Traslado según la comuna de la obra.</p>
            </div>
            <Link href="/arriendo-en/region-del-maule" prefetch={false} className="boton boton-principal mt-5 md:mt-0">Ver cobertura <ArrowRight size={18} weight="bold" aria-hidden /></Link>
          </div>
          <ul data-revela className="mt-7 flex flex-wrap gap-2">
            {COMUNAS.map((c) => <li key={c.slug}><Link href={`/arriendo-en/${c.slug}`} prefetch={false} className="chip comuna presionable">{c.nombre}</Link></li>)}
          </ul>
        </div>
      </section>

      <section aria-labelledby="preguntas" className="sobre-claro mx-auto grid max-w-[1320px] gap-8 px-4 py-12 md:grid-cols-[1fr_1.8fr] md:px-8 md:py-16">
        <h2 id="preguntas" className="grande">Preguntas frecuentes</h2>
        <div>
          {PREGUNTAS.map((p, i) => (
            <details key={p.q} open={i === 0} className="border-t border-negro/20 last:border-b">
              <summary className="presionable flex min-h-16 items-center justify-between gap-4 py-4 text-lg font-semibold">
                {p.q}<Plus size={22} className="mas shrink-0 text-acento-texto" aria-hidden />
              </summary>
              <p className="pb-5 text-ink-soft">{p.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="bg-surface-alt">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-5 px-4 py-10 md:px-8">
          <div>
            <h2 className="medio">Cotiza por WhatsApp</h2>
            <p className="mt-1 text-lg text-ink-soft">Indícanos el equipo, la comuna y las fechas.</p>
          </div>
          <a href={enlaceWhatsapp(texto)} rel="noopener" className="boton boton-principal"><WhatsappLogo size={20} aria-hidden /> Escribir por WhatsApp</a>
        </div>
      </section>

      <BarraMovil cotizar="/cotizar-arriendo" texto={texto} />
    </>
  );
}
