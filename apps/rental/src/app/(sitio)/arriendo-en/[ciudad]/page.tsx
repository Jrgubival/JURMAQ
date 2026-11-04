import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';
import { BarraMovil } from '@/components/AccionesContacto';
import { FlotaComuna, TrabajosComuna, ordenarParaComuna } from '@/components/PaginaComuna';
import PortadaLanding from '@/components/PortadaLanding';
import { COMUNAS } from '@/data/comunas';
import { obtenerFlota } from '@/lib/flota';
import { jsonLdServicio } from '@/lib/jsonld';
import { CIUDADES_RENTAL, TIPOS_MENU, distanciaDesdeBase, fotoPortada } from '@/lib/landings';
import { CRUCES_COMUNA_TIPO } from '@/data/comunas';
import { SITIO } from '@/lib/sitio';
import { cortar } from '@/lib/texto';

export const revalidate = 2592000;
export const dynamicParams = false;

export function generateStaticParams() {
  return COMUNAS.map((c) => ({ ciudad: c.slug }));
}

type Props = { params: Promise<{ ciudad: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ciudad } = await params;
  const c = COMUNAS.find((x) => x.slug === ciudad);
  if (!c) return {};
  const url = `${SITIO.url}/arriendo-en/${c.slug}`;
  return {
    title: `Arriendo de Maquinaria en ${c.nombre} · JURMAQ`,
    description: cortar(`Arriendo de maquinaria en ${c.nombre}. ${c.intro}`),
    alternates: { canonical: url },
    openGraph: { title: `Arriendo de Maquinaria en ${c.nombre}`, url, type: 'website', locale: 'es_CL', siteName: SITIO.nombre },
  };
}

export default async function ArriendoComuna({ params }: Props) {
  const { ciudad } = await params;
  const c = COMUNAS.find((x) => x.slug === ciudad);
  if (!c) notFound();
  const flota = ordenarParaComuna(await obtenerFlota(), c);
  const d = distanciaDesdeBase(c.slug);
  const url = `${SITIO.url}/arriendo-en/${c.slug}`;
  const base = CIUDADES_RENTAL.find((x) => x.slug === c.slug);
  const vecinas = (base?.comunasVecinas ?? []).flatMap((n) => COMUNAS.find((x) => x.nombre === n) ?? []);
  const texto = `Hola, quiero cotizar el arriendo de una máquina en ${c.nombre}.`;
  return (
    <div className="sobre-claro">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLdServicio(`Arriendo de maquinaria en ${c.nombre}`, c.intro, url, c.nombre)) }} />
      <PortadaLanding migas={[{ nombre: 'Región del Maule', href: '/arriendo-en/region-del-maule' }, { nombre: c.nombre }]} titulo={`Arriendo de maquinaria en ${c.nombre}`} bajada={c.intro} foto={fotoPortada(flota, COMUNAS.indexOf(c))} cotizar="/cotizar-arriendo" texto={texto} />
      <TrabajosComuna comuna={c} km={d?.km ?? null} tiempo={d?.tiempo ?? null} vecinas={vecinas} />
      <FlotaComuna flota={flota.slice(0, 3)} titulo={`Lo más pedido para ${c.nombre}`} />
      <p className="mx-auto -mt-8 max-w-[1320px] px-4 pb-12 md:px-8"><Link href="/maquinarias" prefetch={false} className="font-semibold text-acento-texto underline underline-offset-4">Ver toda la flota</Link></p>
      <section className="bg-negro text-white">
        <div className="mx-auto max-w-[1320px] px-4 py-14 md:px-8">
          <h2 className="medio">Por tipo de máquina</h2>
          <ul className="mt-6 flex flex-wrap gap-2">
            {TIPOS_MENU.map((t) => {
              const cruce = CRUCES_COMUNA_TIPO.some((x) => x.ciudad === c.slug && x.tipo === t.slug);
              return <li key={t.slug}><Link href={cruce ? `/arriendo-en/${c.slug}/${t.slug}` : `/arriendo/${t.slug}`} prefetch={false} className="chip">{t.nombrePlural}</Link></li>;
            })}
          </ul>
        </div>
      </section>
      <BarraMovil cotizar="/cotizar-arriendo" texto={texto} />
    </div>
  );
}
