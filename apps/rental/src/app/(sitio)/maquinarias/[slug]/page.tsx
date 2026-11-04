import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { formatCLP } from '@jurmaq/shared/format';
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';
import { operaElCliente, tieneOperadorIncluido } from '@jurmaq/shared/seo/operador';
import { AccionesContacto, BarraMovil } from '@/components/AccionesContacto';
import Foto from '@/components/Foto';
import Migas from '@/components/Migas';
import { TablaPrecios } from '@/components/Precios';
import TarjetaMaquina from '@/components/TarjetaMaquina';
import { obtenerFlota, obtenerMaquina } from '@/lib/flota';
import { jsonLdFicha } from '@/lib/jsonld';
import { TIPOS } from '@/lib/landings';
import { fichaHref, idDesdeSlug, textoPrecio } from '@/lib/maquinas';
import { SITIO } from '@/lib/sitio';
import { cortar } from '@/lib/texto';

// dynamicParams queda activo sólo aquí: una máquina nueva del panel existe sin build.
export const revalidate = 2592000;

export async function generateStaticParams() {
  const flota = await obtenerFlota();
  return flota.map((m) => ({ slug: fichaHref(m).split('/').pop() as string }));
}

type Props = { params: Promise<{ slug: string }> };

async function cargar(slug: string) {
  const id = idDesdeSlug(slug);
  return id ? obtenerMaquina(id) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const m = await cargar(slug);
  if (!m) return { title: 'Máquina no encontrada · JURMAQ', robots: { index: false } };
  const url = `${SITIO.url}${fichaHref(m)}`;
  const precio = m.precios[0] ? `: ${textoPrecio(m.precios[0], formatCLP)}` : '';
  return {
    title: `${m.nombre} en arriendo · JURMAQ`,
    description: cortar(`Arriendo de ${m.nombre} en la Región del Maule${precio}. Curicó, Molina, Talca y más comunas.`),
    alternates: { canonical: url },
    openGraph: { title: `${m.nombre} en arriendo`, url, type: 'website', locale: 'es_CL', siteName: SITIO.nombre, images: m.fotos[0] ? [m.fotos[0]] : undefined },
  };
}

export default async function Ficha({ params }: Props) {
  const { slug } = await params;
  const m = await cargar(slug);
  if (!m) notFound();
  const canonica = fichaHref(m);
  if (`/maquinarias/${slug}` !== canonica) permanentRedirect(canonica);

  const flota = await obtenerFlota();
  const tipo = TIPOS.find((t) => t.tipoDb === m.tipo);
  const parecidas = flota.filter((x) => x.id !== m.id && x.tipo === m.tipo).slice(0, 3);
  const otras = parecidas.length > 0 ? parecidas : flota.filter((x) => x.id !== m.id).slice(0, 3);
  const cotizar = `/cotizar-arriendo?m=${m.id}`;
  const texto = `Hola, quiero cotizar el arriendo de ${m.nombre}.`;

  const operador = m.tipo === 'camion'
    ? 'Incluye conductor de JURMAQ.'
    : tieneOperadorIncluido(m.tipo)
      ? 'Incluye operador de JURMAQ.'
      : operaElCliente(m.tipo)
        ? 'La opera tu personal, con curso de operación vigente.'
        : null;

  return (
    <div className="sobre-claro">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLdFicha(m, `${SITIO.url}${canonica}`)) }} />
      <div className="mx-auto grid max-w-[1320px] gap-8 px-4 py-6 md:grid-cols-[1.45fr_1fr] md:gap-12 md:px-8 md:py-10">
        <div>
          <Migas items={[{ nombre: 'Máquinas', href: '/maquinarias' }, ...(tipo ? [{ nombre: tipo.nombre, href: `/arriendo/${tipo.slug}` }] : []), { nombre: m.nombre }]} />
          <Foto maquina={m} prioridad fondo="bg-[var(--fondo-foto)]" className="redondo mt-4 aspect-[4/3]" />
          {m.fotos.length > 1 ? (
            <div className="mt-2 grid grid-cols-3 gap-2">
              {m.fotos.slice(1, 4).map((_, i) => <Foto key={i} maquina={m} indice={i + 1} fondo="bg-[var(--fondo-foto)]" className="aspect-[4/3] rounded-[8px] [&>span]:text-[0.625rem]" />)}
            </div>
          ) : null}
        </div>
        <div className="md:sticky md:top-24 md:self-start md:pt-10">
          <h1 className="text-[clamp(2rem,3.4vw,2.75rem)]">{m.nombre}</h1>
          {m.estado !== 'disponible' ? <p className="mt-2 font-medium text-peligro">Consulta disponibilidad</p> : null}
          {operador ? <p className="mt-4 text-lg text-ink-soft">{operador}</p> : null}
          <div className="mt-6"><TablaPrecios precios={m.precios} /></div>
          <div className="mt-6 hidden md:block"><AccionesContacto cotizar={cotizar} texto={texto} /></div>
        </div>
      </div>

      {tipo ? (
        <section className="bg-surface-alt">
          <div className="mx-auto grid max-w-[1320px] gap-8 px-4 py-12 md:grid-cols-2 md:px-8 md:py-20">
            <div>
              <h2 className="medio">Para qué se usa</h2>
              {m.descripcion ? <p className="mt-4 max-w-[52ch] text-lg text-ink-soft">{m.descripcion}</p> : null}
              <p className="mt-4"><Link href={`/arriendo/${tipo.slug}`} prefetch={false} className="font-medium underline underline-offset-4">Arriendo de {tipo.nombrePlural.toLowerCase()} en el Maule</Link></p>
            </div>
            <ul className="space-y-4 text-lg">
              {tipo.casosDeUso.map((c) => <li key={c} className="border-t border-negro/15 pt-4">{c}</li>)}
            </ul>
          </div>
        </section>
      ) : null}

      {otras.length > 0 ? (
        <section className="mx-auto max-w-[1320px] py-12 md:px-8 md:py-20">
          <h2 className="medio mb-8 px-4 md:px-0">Otras máquinas</h2>
          <div className="grid gap-6 px-4 sm:grid-cols-2 lg:grid-cols-3 md:px-0">
            {otras.map((x) => <TarjetaMaquina key={x.id} maquina={x} />)}
          </div>
        </section>
      ) : null}

      <BarraMovil cotizar={cotizar} texto={texto} />
    </div>
  );
}
