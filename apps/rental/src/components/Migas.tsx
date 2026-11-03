import Link from 'next/link';
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';
import { SITIO } from '@/lib/sitio';

export default function Migas({ items }: { items: { nombre: string; href?: string }[] }) {
  const lista = [{ nombre: 'Inicio', href: '/' }, ...items];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: lista.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.nombre,
      ...(it.href ? { item: `${SITIO.url}${it.href === '/' ? '' : it.href}` } : {}),
    })),
  };
  return (
    <nav aria-label="Migas" className="text-sm text-ink-muted">
      <ol className="flex flex-wrap gap-x-2">
        {lista.map((it, i) => (
          <li key={it.nombre} className="flex gap-2">
            {i > 0 ? <span aria-hidden>/</span> : null}
            {it.href ? <Link href={it.href} prefetch={false} className="hover:underline">{it.nombre}</Link> : <span>{it.nombre}</span>}
          </li>
        ))}
      </ol>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
    </nav>
  );
}
