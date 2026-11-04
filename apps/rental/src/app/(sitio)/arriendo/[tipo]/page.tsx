import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';
import { BarraMovil } from '@/components/AccionesContacto';
import { Preguntas, UsosYCaracteristicas } from '@/components/ContenidoTipo';
import PortadaLanding from '@/components/PortadaLanding';
import TarjetaMaquina from '@/components/TarjetaMaquina';
import { obtenerFlota } from '@/lib/flota';
import { jsonLdServicio } from '@/lib/jsonld';
import { CIUDADES_RENTAL, TIPOS, tipoPorSlug } from '@/lib/landings';
import { GUIAS_POR_TIPO } from '@/data/guias-por-tipo';
import { CRUCES_COMUNA_TIPO } from '@/data/comunas';
import { RECURSOS } from '@/data/recursos';
import { SITIO } from '@/lib/sitio';
import { cortar } from '@/lib/texto';

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
  const titulo = `Arriendo de ${t.nombrePlural}${operador} en el Maule · JURMAQ`;
  return {
    title: titulo.length <= 60 ? titulo : `Arriendo de ${t.nombrePlural} en el Maule · JURMAQ`,
    description: cortar(`${t.descripcionCorta} ${modelos ? `${modelos}. ` : ''}Arriendo en toda la Región del Maule.`),
    alternates: { canonical: url },
    openGraph: { title: `Arriendo de ${t.nombrePlural}`, url, type: 'website', locale: 'es_CL', siteName: SITIO.nombre, images: ['/og.jpg'] },
  };
}

export default async function ArriendoTipo({ params }: Props) {
  const { tipo } = await params;
  const t = tipoPorSlug(tipo);
  if (!t) notFound();
  const flota = (await obtenerFlota()).filter((m) => m.tipo === t.tipoDb);
  const url = `${SITIO.url}/arriendo/${t.slug}`;
  const guias = (GUIAS_POR_TIPO[t.slug] ?? []).flatMap((g) => RECURSOS.find((r) => r.slug === g) ?? []);
  const texto = `Hola, quiero cotizar el arriendo de ${t.nombre.toLowerCase()}.`;
  const cotizar = flota[0] ? `/cotizar-arriendo?m=${flota[0].id}` : '/cotizar-arriendo';
  return (
    <div className="sobre-claro">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLdServicio(`Arriendo de ${t.nombrePlural}`, t.descripcionLarga, url, SITIO.region)) }} />
      <PortadaLanding migas={[{ nombre: 'Máquinas', href: '/maquinarias' }, { nombre: t.nombre }]} titulo={`Arriendo de ${t.nombrePlural.toLowerCase()} en el Maule`} bajada={t.descripcionCorta} foto={flota[0]} angosta={!['retroexcavadora', 'minicargador', 'camion-tolva'].includes(t.slug)} cotizar={cotizar} texto={texto} />

      <section className="mx-auto max-w-[1320px] py-12 md:px-8 md:py-20">
        <h2 className="medio mb-8 px-4 md:px-0">En nuestra flota</h2>
        <div className={`grid gap-6 px-4 md:px-0 ${flota.length > 1 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'md:max-w-md'}`}>
          {flota.map((m) => <TarjetaMaquina key={m.id} maquina={m} />)}
        </div>
        <p className="mt-8 max-w-[64ch] px-4 text-lg text-ink-soft md:px-0">{t.descripcionLarga}</p>
      </section>

      <UsosYCaracteristicas tipo={t} />
      <Preguntas preguntas={t.preguntasFrecuentes} />
      {guias.length > 0 ? (
        <section className="mx-auto max-w-[900px] px-4 pb-14">
          <h2 className="medio">Guías</h2>
          <ul className="mt-4">
            {guias.map((g) => <li key={g.slug} className="border-t border-negro/20"><Link href={`/recursos/${g.slug}`} prefetch={false} className="presionable block py-4 text-lg font-medium">{g.h1}</Link></li>)}
          </ul>
        </section>
      ) : null}

      <section className="bg-negro text-white">
        <div className="mx-auto max-w-[1320px] px-4 py-14 md:px-8">
          <h2 className="medio">En toda la región</h2>
          <ul className="mt-6 flex flex-wrap gap-2">
            {CIUDADES_RENTAL.map((c) => {
              const cruce = CRUCES_COMUNA_TIPO.some((x) => x.ciudad === c.slug && x.tipo === t.slug);
              return <li key={c.slug}><Link href={cruce ? `/arriendo-en/${c.slug}/${t.slug}` : `/arriendo-en/${c.slug}`} prefetch={false} className="chip">{c.nombre}</Link></li>;
            })}
            <li><Link href="/arriendo-en/region-del-maule" prefetch={false} className="chip bg-white text-negro">Región del Maule</Link></li>
          </ul>
        </div>
      </section>
      <BarraMovil cotizar={cotizar} texto={texto} />
    </div>
  );
}
