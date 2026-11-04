import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';
import { BarraMovil } from '@/components/AccionesContacto';
import { Preguntas } from '@/components/ContenidoTipo';
import { FlotaComuna, TrabajosComuna } from '@/components/PaginaComuna';
import PortadaLanding from '@/components/PortadaLanding';
import { COMUNAS, CRUCES_COMUNA_TIPO } from '@/data/comunas';
import { obtenerFlota } from '@/lib/flota';
import { jsonLdServicio } from '@/lib/jsonld';
import { distanciaDesdeBase, tipoPorSlug } from '@/lib/landings';
import { SITIO } from '@/lib/sitio';
import { cortar } from '@/lib/texto';

export const revalidate = 2592000;
export const dynamicParams = false;

export function generateStaticParams() {
  return CRUCES_COMUNA_TIPO;
}

type Props = { params: Promise<{ ciudad: string; tipo: string }> };

function resolver(ciudad: string, tipo: string) {
  if (!CRUCES_COMUNA_TIPO.some((x) => x.ciudad === ciudad && x.tipo === tipo)) return null;
  const c = COMUNAS.find((x) => x.slug === ciudad);
  const t = tipoPorSlug(tipo);
  return c && t ? { c, t } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ciudad, tipo } = await params;
  const r = resolver(ciudad, tipo);
  if (!r) return {};
  const url = `${SITIO.url}/arriendo-en/${ciudad}/${tipo}`;
  return {
    title: `Arriendo de ${r.t.nombre} en ${r.c.nombre} · JURMAQ`,
    description: cortar(`${r.t.nombrePlural} en arriendo para ${r.c.nombre}. ${r.t.descripcionCorta} ${r.c.trabajos[0]} y más trabajos en la comuna.`),
    alternates: { canonical: url },
  };
}

export default async function ArriendoCruce({ params }: Props) {
  const { ciudad, tipo } = await params;
  const r = resolver(ciudad, tipo);
  if (!r) notFound();
  const { c, t } = r;
  const flota = (await obtenerFlota()).filter((m) => m.tipo === t.tipoDb);
  const url = `${SITIO.url}/arriendo-en/${c.slug}/${t.slug}`;
  const texto = `Hola, quiero cotizar el arriendo de ${t.nombre.toLowerCase()} en ${c.nombre}.`;
  const cotizar = flota[0] ? `/cotizar-arriendo?m=${flota[0].id}` : '/cotizar-arriendo';
  return (
    <div className="sobre-claro">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLdServicio(`Arriendo de ${t.nombre} en ${c.nombre}`, t.descripcionCorta, url, c.nombre)) }} />
      <PortadaLanding migas={[{ nombre: c.nombre, href: `/arriendo-en/${c.slug}` }, { nombre: t.nombre }]} titulo={`Arriendo de ${t.nombre.toLowerCase()} en ${c.nombre}`} bajada={`${t.descripcionCorta} ${c.intro}`} foto={flota[0]} angosta={!['retroexcavadora', 'minicargador', 'camion-tolva'].includes(t.slug)} cotizar={cotizar} texto={texto} />
      <FlotaComuna flota={flota} titulo="En nuestra flota" />
      <TrabajosComuna comuna={c} km={distanciaDesdeBase(c.slug)?.km ?? null} />
      <Preguntas preguntas={t.preguntasFrecuentes.map((p) => ({ q: p.q.replace('en Curicó', `en ${c.nombre}`), a: p.a }))} />
      <p className="mx-auto max-w-[900px] px-4 pb-14"><Link href={`/arriendo/${t.slug}`} prefetch={false} className="font-medium underline underline-offset-4">Arriendo de {t.nombrePlural.toLowerCase()} en toda la región</Link></p>
      <BarraMovil cotizar={cotizar} texto={texto} />
    </div>
  );
}
