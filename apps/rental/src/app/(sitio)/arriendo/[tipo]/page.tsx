import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';
import { AccionesContacto, BarraMovil } from '@/components/AccionesContacto';
import Migas from '@/components/Migas';
import TarjetaMaquina from '@/components/TarjetaMaquina';
import { obtenerFlota } from '@/lib/flota';
import { jsonLdServicio } from '@/lib/jsonld';
import { CIUDADES_RENTAL, TIPOS, tipoPorSlug } from '@/lib/landings';
import { SITIO } from '@/lib/sitio';

export const revalidate = 2592000;
export const dynamicParams = false;

export function generateStaticParams() {
  return TIPOS.map((t) => ({ tipo: t.slug }));
}

type Props = { params: Promise<{ tipo: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tipo } = await params;
  const t = tipoPorSlug(tipo);
  if (!t) return {};
  const flota = (await obtenerFlota()).filter((m) => m.tipo === t.tipoDb);
  const modelos = flota.slice(0, 2).map((m) => m.nombre).join(' y ');
  const url = `${SITIO.url}/arriendo/${t.slug}`;
  const operador = t.tipoDb === 'camion' ? ' con conductor' : t.operadorIncluido ? ' con operador' : '';
  return {
    title: `Arriendo de ${t.nombrePlural}${operador} en el Maule · JURMAQ`,
    description: `${t.descripcionCorta} ${modelos ? `${modelos}. ` : ''}Arriendo en Curicó, Molina, Talca y toda la Región del Maule.`,
    alternates: { canonical: url },
    openGraph: { title: `Arriendo de ${t.nombrePlural}`, url, type: 'website', locale: 'es_CL', siteName: SITIO.nombre },
  };
}

export default async function ArriendoTipo({ params }: Props) {
  const { tipo } = await params;
  const t = tipoPorSlug(tipo);
  if (!t) notFound();
  const flota = (await obtenerFlota()).filter((m) => m.tipo === t.tipoDb);
  const url = `${SITIO.url}/arriendo/${t.slug}`;
  const texto = `Hola, quiero cotizar el arriendo de ${t.nombre.toLowerCase()}.`;
  const cotizar = flota[0] ? `/cotizar-arriendo?m=${flota[0].id}` : '/cotizar-arriendo';
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLdServicio(`Arriendo de ${t.nombrePlural}`, t.descripcionLarga, url, SITIO.region)) }} />
      <Migas items={[{ nombre: 'Máquinas', href: '/maquinarias' }, { nombre: t.nombre }]} />
      <h1 className="mt-4 text-4xl sm:text-5xl">Arriendo de {t.nombrePlural.toLowerCase()} en el Maule</h1>
      <p className="mt-4 max-w-3xl text-lg text-ink-soft">{t.descripcionLarga}</p>
      <div className="mt-5 hidden md:block"><AccionesContacto cotizar={cotizar} texto={texto} /></div>

      <section className="mt-10">
        <h2 className="text-3xl">Máquinas disponibles</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {flota.map((m) => <TarjetaMaquina key={m.id} maquina={m} />)}
        </div>
      </section>

      <div className="mt-12 grid gap-10 md:grid-cols-2">
        <section>
          <h2 className="text-3xl">Para qué se usa</h2>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-ink-soft">{t.casosDeUso.map((c) => <li key={c}>{c}</li>)}</ul>
        </section>
        <section>
          <h2 className="text-3xl">Características típicas</h2>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-ink-soft">{t.especificacionesClave.map((c) => <li key={c}>{c}</li>)}</ul>
        </section>
      </div>

      <section className="mt-12 max-w-3xl">
        <h2 className="text-3xl">Preguntas frecuentes</h2>
        <dl className="mt-4 divide-y divide-hairline border-y border-hairline">
          {t.preguntasFrecuentes.map((p) => (
            <div key={p.q} className="py-4"><dt className="font-semibold">{p.q}</dt><dd className="mt-1 text-ink-soft">{p.a}</dd></div>
          ))}
        </dl>
      </section>

      <section className="mt-12">
        <h2 className="text-3xl">Dónde la arrendamos</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {CIUDADES_RENTAL.map((c) => <li key={c.slug}><Link href={`/arriendo-en/${c.slug}`} prefetch={false} className="boton boton-suave">{c.nombre}</Link></li>)}
          <li><Link href="/arriendo-en/region-del-maule" prefetch={false} className="boton boton-suave">Región del Maule</Link></li>
        </ul>
      </section>
      <BarraMovil cotizar={cotizar} texto={texto} />
    </div>
  );
}
