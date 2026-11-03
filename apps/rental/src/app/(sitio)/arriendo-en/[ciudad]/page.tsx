import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';
import { AccionesContacto, BarraMovil } from '@/components/AccionesContacto';
import Migas from '@/components/Migas';
import TarjetaMaquina from '@/components/TarjetaMaquina';
import { obtenerFlota } from '@/lib/flota';
import { jsonLdServicio } from '@/lib/jsonld';
import { CIUDADES_RENTAL, TIPOS, distanciaDesdeBase } from '@/lib/landings';
import { SITIO } from '@/lib/sitio';

export const revalidate = 2592000;
export const dynamicParams = false;

export function generateStaticParams() {
  return CIUDADES_RENTAL.map((c) => ({ ciudad: c.slug }));
}

type Props = { params: Promise<{ ciudad: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ciudad } = await params;
  const c = CIUDADES_RENTAL.find((x) => x.slug === ciudad);
  if (!c) return {};
  const url = `${SITIO.url}/arriendo-en/${c.slug}`;
  return {
    title: `Arriendo de Maquinaria en ${c.nombre} · JURMAQ`,
    description: `Retroexcavadora, miniexcavadora, minicargador, camión tolva, brazo articulado y alzahombre en arriendo en ${c.nombre}. ${c.contextoLocal}`.slice(0, 158),
    alternates: { canonical: url },
    openGraph: { title: `Arriendo de Maquinaria en ${c.nombre}`, url, type: 'website', locale: 'es_CL', siteName: SITIO.nombre },
  };
}

export default async function ArriendoCiudad({ params }: Props) {
  const { ciudad } = await params;
  const c = CIUDADES_RENTAL.find((x) => x.slug === ciudad);
  if (!c) notFound();
  const flota = await obtenerFlota();
  const d = distanciaDesdeBase(c.slug);
  const url = `${SITIO.url}/arriendo-en/${c.slug}`;
  const texto = `Hola, quiero cotizar el arriendo de una máquina en ${c.nombre}.`;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLdServicio(`Arriendo de maquinaria en ${c.nombre}`, c.contextoLocal, url, c.nombre)) }} />
      <Migas items={[{ nombre: 'Región del Maule', href: '/arriendo-en/region-del-maule' }, { nombre: c.nombre }]} />
      <h1 className="mt-4 text-4xl sm:text-5xl">Arriendo de maquinaria en {c.nombre}</h1>
      <p className="mt-4 max-w-3xl text-lg text-ink-soft">{c.contextoLocal}</p>
      {d && d.km > 0 ? <p className="mt-3 text-ink-soft">Nuestra base en Maquehua, Curicó, está a unos {d.km} km de {c.nombre}. El traslado se cotiza aparte.</p> : null}
      <div className="mt-5 hidden md:block"><AccionesContacto cotizar="/cotizar-arriendo" texto={texto} /></div>

      <section className="mt-10">
        <h2 className="text-3xl">Máquinas para {c.nombre}</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {flota.map((m) => <TarjetaMaquina key={m.id} maquina={m} />)}
        </div>
      </section>

      <div className="mt-12 grid gap-10 md:grid-cols-2">
        <section>
          <h2 className="text-3xl">Rubros de la zona</h2>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-ink-soft">{c.rubroLocal.map((r) => <li key={r}>{r}</li>)}</ul>
        </section>
        <section>
          <h2 className="text-3xl">Comunas vecinas</h2>
          <p className="mt-4 text-ink-soft">También arrendamos en {c.comunasVecinas.join(', ')}.</p>
          <p className="mt-3"><Link href="/arriendo-en/region-del-maule" prefetch={false} className="font-medium underline underline-offset-4">Toda la Región del Maule</Link></p>
        </section>
      </div>

      <section className="mt-12">
        <h2 className="text-3xl">Por tipo de máquina</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {TIPOS.map((t) => <li key={t.slug}><Link href={`/arriendo/${t.slug}`} prefetch={false} className="boton boton-suave">{t.nombre}</Link></li>)}
        </ul>
      </section>
      <BarraMovil cotizar="/cotizar-arriendo" texto={texto} />
    </div>
  );
}
