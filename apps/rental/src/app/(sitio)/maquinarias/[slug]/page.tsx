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
    title: `${m.nombre} en arriendo${precio} · JURMAQ`,
    description: `Arriendo de ${m.nombre} en Curicó, Molina, Talca y toda la Región del Maule. Valor referencial, condiciones y cotización.`,
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
    <div className="mx-auto max-w-6xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLdFicha(m, `${SITIO.url}${canonica}`)) }} />
      <Migas items={[{ nombre: 'Máquinas', href: '/maquinarias' }, ...(tipo ? [{ nombre: tipo.nombre, href: `/arriendo/${tipo.slug}` }] : []), { nombre: m.nombre }]} />

      <div className="mt-5 grid gap-8 md:grid-cols-2">
        <div className="space-y-3">
          <Foto maquina={m} prioridad className="aspect-[4/3] rounded-xl" />
          {m.fotos.length > 1 ? (
            <div className="grid grid-cols-3 gap-3">
              {m.fotos.slice(1, 4).map((_, i) => <Foto key={i} maquina={m} indice={i + 1} className="aspect-[4/3] rounded-lg" />)}
            </div>
          ) : null}
        </div>
        <div>
          <h1 className="text-4xl">{m.nombre} en arriendo</h1>
          {m.estado !== 'disponible' ? <p className="mt-2 font-medium text-peligro">Consulta disponibilidad</p> : null}
          {m.descripcion ? <p className="mt-3 text-ink-soft">{m.descripcion}</p> : null}
          {operador ? <p className="mt-3 font-medium">{operador}</p> : null}
          <div className="mt-5"><TablaPrecios precios={m.precios} /></div>
          <div className="mt-5 hidden md:block"><AccionesContacto cotizar={cotizar} texto={texto} /></div>
        </div>
      </div>

      {tipo ? (
        <section className="mt-12 max-w-3xl">
          <h2 className="text-3xl">Para qué se usa</h2>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-ink-soft">
            {tipo.casosDeUso.map((c) => <li key={c}>{c}</li>)}
          </ul>
          <p className="mt-4"><Link href={`/arriendo/${tipo.slug}`} prefetch={false} className="font-medium underline underline-offset-4">Arriendo de {tipo.nombrePlural.toLowerCase()} en el Maule</Link></p>
        </section>
      ) : null}

      {otras.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-3xl">Otras máquinas</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {otras.map((x) => <TarjetaMaquina key={x.id} maquina={x} />)}
          </div>
        </section>
      ) : null}

      <BarraMovil cotizar={cotizar} texto={texto} />
    </div>
  );
}
