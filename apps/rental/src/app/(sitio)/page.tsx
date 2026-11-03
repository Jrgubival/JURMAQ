import type { Metadata } from 'next';
import Link from 'next/link';
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';
import { AccionesContacto, BarraMovil } from '@/components/AccionesContacto';
import Foto from '@/components/Foto';
import TarjetaMaquina from '@/components/TarjetaMaquina';
import { obtenerFlota } from '@/lib/flota';
import { jsonLdNegocio } from '@/lib/jsonld';
import { CIUDADES_RENTAL, COMUNAS_MAULE, TIPOS } from '@/lib/landings';
import { SITIO } from '@/lib/sitio';

export const revalidate = 2592000;

export const metadata: Metadata = {
  title: 'Arriendo de Maquinaria en Curicó, Molina y Talca · JURMAQ',
  description:
    'Arriendo de retroexcavadora, miniexcavadora, minicargador, camión tolva, brazo articulado y alzahombre en toda la Región del Maule. Valores a la vista. Desde 2000.',
  alternates: { canonical: SITIO.url },
};

const TRABAJOS = [
  { trabajo: 'Zanjas y fundaciones', tipo: 'retroexcavadora' },
  { trabajo: 'Excavar en espacios chicos', tipo: 'miniexcavadora' },
  { trabajo: 'Cargar y limpiar', tipo: 'minicargador' },
  { trabajo: 'Mover tierra y áridos', tipo: 'camion-tolva' },
  { trabajo: 'Llegar alto y lejos', tipo: 'brazo-articulado' },
  { trabajo: 'Subir vertical', tipo: 'alzahombre' },
];

const PREGUNTAS = [
  {
    q: '¿La máquina viene con operador?',
    a: 'Retroexcavadora, miniexcavadora y minicargador van con operador, y el camión tolva con conductor. Brazo articulado y plataformas los opera tu personal, con curso vigente.',
  },
  {
    q: '¿El valor incluye traslado?',
    a: 'No. El traslado se cotiza aparte según la comuna de la obra.',
  },
  {
    q: '¿Los valores incluyen IVA?',
    a: 'No. Los valores que ves son netos y referenciales. La cotización detalla neto, IVA y total.',
  },
  {
    q: '¿Dónde atienden?',
    a: 'En toda la Región del Maule, con base en Maquehua, Curicó.',
  },
];

export default async function Inicio() {
  const flota = await obtenerFlota();
  const destacada = flota.find((m) => m.tipo === 'retroexcavadora') ?? flota[0];
  const texto = 'Hola, quiero cotizar el arriendo de una máquina.';
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLdNegocio(COMUNAS_MAULE)) }} />

      <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 md:grid-cols-2 md:py-16">
        <div>
          <p className="text-sm font-medium text-ink-muted">Región del Maule, desde {SITIO.anioInicio}</p>
          <h1 className="mt-3 text-4xl sm:text-5xl lg:text-6xl">Arriendo de maquinaria en Curicó, Molina y Talca</h1>
          <p className="mt-4 max-w-xl text-lg text-ink-soft">
            Retroexcavadora, miniexcavadora, minicargador, camión tolva, brazo articulado y plataformas. Revisa el valor y cotiza en minutos.
          </p>
          <div className="mt-6"><AccionesContacto cotizar="/cotizar-arriendo" texto={texto} /></div>
        </div>
        {destacada ? <Foto maquina={destacada} prioridad className="aspect-[4/3] rounded-xl" /> : null}
      </section>

      <section aria-labelledby="trabajo" className="border-y border-hairline bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <h2 id="trabajo" className="text-3xl">¿Qué trabajo tienes?</h2>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {TRABAJOS.map((t) => {
              const tipo = TIPOS.find((x) => x.slug === t.tipo);
              if (!tipo) return null;
              return (
                <li key={t.tipo}>
                  <Link href={`/arriendo/${t.tipo}`} prefetch={false} className="presionable boton-suave flex min-h-14 items-center justify-between rounded-[10px] border px-4">
                    <span className="font-medium">{t.trabajo}</span>
                    <span className="text-sm text-ink-muted">{tipo.nombre}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section aria-labelledby="flota" className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex items-end justify-between gap-4">
          <h2 id="flota" className="text-3xl">Flota y valores</h2>
          <Link href="/maquinarias" prefetch={false} className="text-sm font-medium underline underline-offset-4">Ver todas</Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {flota.slice(0, 6).map((m) => <TarjetaMaquina key={m.id} maquina={m} />)}
        </div>
        <p className="mt-4 text-sm text-ink-muted">Valores referenciales, netos. El traslado se cotiza aparte.</p>
      </section>

      <section aria-labelledby="cobertura" className="bg-surface-alt">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 id="cobertura" className="text-3xl">Toda la Región del Maule</h2>
          <p className="mt-3 max-w-2xl text-ink-soft">Arrendamos desde nuestra base en Maquehua, Curicó, a cualquier comuna de la región.</p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {CIUDADES_RENTAL.map((c) => (
              <li key={c.slug}><Link href={`/arriendo-en/${c.slug}`} prefetch={false} className="boton boton-suave">{c.nombre}</Link></li>
            ))}
            <li><Link href="/arriendo-en/region-del-maule" prefetch={false} className="boton boton-suave">Otras comunas</Link></li>
          </ul>
        </div>
      </section>

      <section aria-labelledby="preguntas" className="mx-auto max-w-3xl px-4 py-12">
        <h2 id="preguntas" className="text-3xl">Preguntas frecuentes</h2>
        <dl className="mt-5 divide-y divide-hairline border-y border-hairline">
          {PREGUNTAS.map((p) => (
            <div key={p.q} className="py-4">
              <dt className="font-semibold">{p.q}</dt>
              <dd className="mt-1 text-ink-soft">{p.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <BarraMovil cotizar="/cotizar-arriendo" texto={texto} />
    </>
  );
}
