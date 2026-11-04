import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';
import CabezaPagina from '@/components/CabezaPagina';
import { RECURSOS, getRecurso } from '@/data/recursos';
import { tiposDeGuia } from '@/data/guias-por-tipo';
import { proveedor } from '@/lib/jsonld';
import { tipoPorSlug } from '@/lib/landings';
import { cortar } from '@/lib/texto';
import { SITIO } from '@/lib/sitio';

export const dynamicParams = false;

export function generateStaticParams() {
  return RECURSOS.map((r) => ({ slug: r.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = getRecurso((await params).slug);
  if (!r) return {};
  return { title: r.titulo, description: cortar(r.descripcionMeta), alternates: { canonical: `${SITIO.url}/recursos/${r.slug}` } };
}

export default async function Recurso({ params }: Props) {
  const r = getRecurso((await params).slug);
  if (!r) notFound();
  const url = `${SITIO.url}/recursos/${r.slug}`;
  const tipos = tiposDeGuia(r.slug).flatMap((s) => tipoPorSlug(s) ?? []);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: r.h1,
    description: r.descripcionMeta,
    datePublished: r.fechaPublicacion,
    dateModified: r.fechaModificacion ?? r.fechaPublicacion,
    url,
    author: proveedor,
    publisher: proveedor,
    mainEntityOfPage: url,
    image: `${SITIO.url}/opengraph-image.jpg`,
  };
  return (
    <article className="sobre-claro mx-auto max-w-3xl px-4 py-10 md:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <CabezaPagina migas={[{ nombre: 'Guías', href: '/recursos' }, { nombre: 'Guía' }]} titulo={r.h1} bajada={r.resumen} />
      <div className="mx-auto max-w-3xl px-4 pb-16">
      <div className="prosa mt-4">
        {r.secciones.map((s) => (
          <section key={s.h2}>
            <h2>{s.h2}</h2>
            {/* Contenido propio del repo, no viene de usuarios. */}
            <div dangerouslySetInnerHTML={{ __html: s.html }} />
          </section>
        ))}
      </div>
      {r.faq.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-3xl">Preguntas frecuentes</h2>
          <dl className="mt-4 divide-y divide-hairline border-y border-hairline">
            {r.faq.map((p) => <div key={p.q} className="py-4"><dt className="font-semibold">{p.q}</dt><dd className="mt-1 text-ink-soft">{p.a}</dd></div>)}
          </dl>
        </section>
      ) : null}
      {tipos.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-2xl">Máquinas relacionadas</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {tipos.map((t) => <li key={t.slug}><Link href={`/arriendo/${t.slug}`} prefetch={false} className="chip">{t.nombrePlural}</Link></li>)}
          </ul>
        </section>
      ) : null}
      <Link href="/cotizar-arriendo" prefetch={false} className="boton boton-principal mt-8">Cotizar</Link>
      </div>
    </article>
  );
}
