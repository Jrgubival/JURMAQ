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
    description: `${t.descripcionCorta} ${modelos ? `${modelos}. ` : ''}Arriendo en toda la Región del Maule.`.slice(0, 158),
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
    <div className="sobre-claro">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLdServicio(`Arriendo de ${t.nombrePlural}`, t.descripcionLarga, url, SITIO.region)) }} />
      <PortadaLanding migas={[{ nombre: 'Máquinas', href: '/maquinarias' }, { nombre: t.nombre }]} titulo={`Arriendo de ${t.nombrePlural.toLowerCase()} en el Maule`} bajada={t.descripcionCorta} foto={flota[0]} angosta={!['retroexcavadora', 'minicargador', 'camion-tolva'].includes(t.slug)} cotizar={cotizar} texto={texto} />

      <section className="mx-auto max-w-[1320px] py-14 md:px-8 md:py-20">
        <h2 className="medio mb-6 px-4 md:px-0">En nuestra flota</h2>
        <div className={`grid gap-4 px-4 md:px-0 ${flota.length > 1 ? 'md:grid-cols-2' : 'md:max-w-xl'}`}>
          {flota.map((m) => <TarjetaMaquina key={m.id} maquina={m} />)}
        </div>
        <p className="mt-6 max-w-[64ch] px-4 text-lg text-ink-soft md:px-0">{t.descripcionLarga}</p>
      </section>

      <UsosYCaracteristicas tipo={t} />
      <Preguntas preguntas={t.preguntasFrecuentes} />

      <section className="bg-negro text-white">
        <div className="mx-auto max-w-[1320px] px-4 py-14 md:px-8">
          <h2 className="medio">En toda la región</h2>
          <ul className="mt-6 flex flex-wrap gap-2">
            {CIUDADES_RENTAL.map((c) => <li key={c.slug}><Link href={`/arriendo-en/${c.slug}`} prefetch={false} className="chip">{c.nombre}</Link></li>)}
            <li><Link href="/arriendo-en/region-del-maule" prefetch={false} className="chip bg-white text-negro">Región del Maule</Link></li>
          </ul>
        </div>
      </section>
      <BarraMovil cotizar={cotizar} texto={texto} />
    </div>
  );
}
