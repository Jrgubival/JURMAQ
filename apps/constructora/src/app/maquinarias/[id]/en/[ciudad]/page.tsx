import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabasePublic } from '@jurmaq/shared/supabase';
import {
  CIUDADES,
  TIPOS_MAQUINA,
  DISTANCIAS_CONSTRUCTORA,
  LEGAL_INFO,
  tieneOperadorIncluido,
  operaElCliente,
} from '@jurmaq/shared/seo';
import { getMaquinariaDescripcion } from '@jurmaq/shared/seo/maquinaria-descripciones';
import { formatCLP } from '@jurmaq/shared/format';
import { buildWhatsappUrl, SALUDO } from '@jurmaq/shared/whatsapp';
import { precioPublicoDesde } from '@/lib/pricing-arriendo';
import {
  maquinariaHref,
  parseSlugId,
  slugifyMaquinaria,
} from '@/lib/maquinaria-slug';
import CrossLinksGrid from '@jurmaq/shared/ui/CrossLinksGrid';

/**
 * pSEO: máquina específica × ciudad servida.
 *
 * URL: `/maquinarias/<slug>-<id>/en/<ciudad>` — ej.
 * `/maquinarias/minicargador-bobcat-s650-12/en/talca`.
 *
 * NOTA sobre el segmento `[id]`: Next.js App Router obliga a usar el mismo
 * nombre de slug en el mismo nivel del árbol. Como `maquinarias/[id]/page.tsx`
 * ya existe, esta sub-ruta hereda `[id]` (el spec original pedía `[idSlug]`
 * pero crearía un conflicto de routing).
 *
 * Contenido único por landing — anti-doorway:
 *   - Distancia/tiempo de despacho real (DISTANCIAS_CONSTRUCTORA, OSRM).
 *   - Contexto económico de la ciudad (CIUDADES[ciudad].rubroLocal).
 *   - Ficha técnica real de la máquina (descripcion DB + fallback por tipo).
 *   - FAQs mezclando preguntas del tipo + variantes ciudad-específicas.
 */

interface Maquinaria {
  id: number;
  nombre: string;
  tipo: string;
  descripcion: string | null;
  tarifa_neta: number | null;
  unidad_tarifa: 'hora' | 'dia' | null;
  minimo_unidades: number | null;
  estado: string;
  imagen: string | null;
}

export const dynamic = 'force-static';
export const revalidate = 86400;

async function findMaquinaria(idParam: string): Promise<Maquinaria | null> {
  const id = parseSlugId(idParam);
  if (id !== null) {
    const { data } = await supabasePublic
      .from('maquinarias')
      .select('id, nombre, tipo, descripcion, tarifa_neta, unidad_tarifa, minimo_unidades, estado, imagen')
      .eq('id', id)
      .maybeSingle();
    return (data as Maquinaria) ?? null;
  }
  // Fallback: slug puro sin id (poco frecuente pero posible si Google indexó URL legacy).
  const { data: all } = await supabasePublic
    .from('maquinarias')
    .select('id, nombre, tipo, descripcion, tarifa_neta, unidad_tarifa, minimo_unidades, estado, imagen');
  return (
    ((all as Maquinaria[] | null) ?? []).find(
      (m) => slugifyMaquinaria(m.nombre) === idParam,
    ) ?? null
  );
}

export async function generateStaticParams() {
  const { data: machines } = await supabasePublic
    .from('maquinarias')
    .select('id, nombre');
  const out: { id: string; ciudad: string }[] = [];
  for (const m of (machines ?? []) as { id: number; nombre: string }[]) {
    const idSlug = `${slugifyMaquinaria(m.nombre)}-${m.id}`;
    for (const c of CIUDADES) {
      out.push({ id: idSlug, ciudad: c.slug });
    }
  }
  return out;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; ciudad: string }>;
}): Promise<Metadata> {
  const { id, ciudad } = await params;
  const c = CIUDADES.find((x) => x.slug === ciudad);
  const m = await findMaquinaria(id);
  if (!c || !m) return { title: 'Página no encontrada' };

  const dist = DISTANCIAS_CONSTRUCTORA[c.slug];
  const baseTitle = `Arriendo ${m.nombre} en ${c.nombre}`;
  const fullTitle = `${baseTitle} · JURMAQ`;
  const title = fullTitle.length <= 60 ? fullTitle : baseTitle;

  const description = `Arriendo de ${m.nombre} en ${c.nombre} (${c.region}). Despacho desde Curicó (${dist.km} km · ${dist.tiempo}). ${tieneOperadorIncluido(m.tipo) ? (m.tipo === 'camion' ? 'Conductor incluido en la tarifa.' : 'Operador incluido en la tarifa.') : operaElCliente(m.tipo) ? 'Equipo listo para operar por tu equipo.' : 'Equipo con mantención al día.'} Cotiza por WhatsApp y respondemos en menos de 2 horas.`;

  const canonical = `https://jurmaq.cl${maquinariaHref(m)}/en/${c.slug}`;
  const tipoLbl = TIPOS_MAQUINA.find((t) => t.tipoDb === m.tipo)?.nombre ?? m.tipo;

  return {
    title,
    description,
    keywords: [
      `arriendo ${m.nombre.toLowerCase()} ${c.nombre}`,
      `arriendo ${tipoLbl.toLowerCase()} ${c.nombre}`,
      `${m.nombre.toLowerCase()} ${c.nombre}`,
      ...(tieneOperadorIncluido(m.tipo) ? [`${m.nombre.toLowerCase()} con operador ${c.nombre}`] : []),
      ...c.comunasVecinas.map((cv) => `arriendo ${tipoLbl.toLowerCase()} ${cv}`),
      'JURMAQ',
    ],
    alternates: { canonical },
    openGraph: {
      title: fullTitle,
      description,
      url: canonical,
      siteName: 'JURMAQ',
      locale: 'es_CL',
      type: 'website',
      images: m.imagen
        ? [{ url: m.imagen, width: 1200, height: 630, alt: `${m.nombre} en arriendo · ${c.nombre}` }]
        : [{ url: '/og-image-1200x630.png', width: 1200, height: 630, alt: 'JURMAQ' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
    },
  };
}

export default async function MaquinariaCiudadLanding({
  params,
}: {
  params: Promise<{ id: string; ciudad: string }>;
}) {
  const { id, ciudad } = await params;
  const c = CIUDADES.find((x) => x.slug === ciudad);
  if (!c) notFound();
  const m = await findMaquinaria(id);
  if (!m) notFound();

  const dist = DISTANCIAS_CONSTRUCTORA[c.slug];
  const tipoInfo = TIPOS_MAQUINA.find((t) => t.tipoDb === m.tipo) ?? null;
  const descRich = getMaquinariaDescripcion(m.tipo, m.descripcion);
  const precio = precioPublicoDesde(m);
  const canonical = `https://jurmaq.cl${maquinariaHref(m)}/en/${c.slug}`;

  const { data: sameTypeRaw } = await supabasePublic
    .from('maquinarias')
    .select('id, nombre, tipo, estado')
    .eq('tipo', m.tipo)
    .neq('id', m.id)
    .limit(6);
  const sameType = (sameTypeRaw ?? []) as { id: number; nombre: string; tipo: string; estado: string }[];

  const vecinas = new Set(c.comunasVecinas.map((v) => v.toLowerCase()));
  const otrasCiudades = CIUDADES.filter((x) => x.slug !== c.slug)
    .map((x) => ({
      ...x,
      _isVecina: vecinas.has(x.nombre.toLowerCase()) ? 0 : 1,
      _km: DISTANCIAS_CONSTRUCTORA[x.slug]?.km ?? 9999,
    }))
    .sort((a, b) => a._isVecina - b._isVecina || a._km - b._km)
    .slice(0, 6);

  const tipoFaqs = (tipoInfo?.preguntasFrecuentes ?? []).slice(0, 2).map((f) => ({
    q: f.q.replace(/Curicó/g, c.nombre),
    a: f.a.replace(/Curicó/g, c.nombre),
  }));
  const ciudadFaqs: { q: string; a: string }[] = [
    {
      q: `¿Cuánto demora el despacho de ${m.nombre} a ${c.nombre}?`,
      a: `Despachamos desde Maquehua, Curicó. A ${c.nombre} el trayecto es de ${dist.km} km — aproximadamente ${dist.tiempo} con camión cargado. Coordinamos ventana de despacho para llegar a primera hora de obra si lo necesitas.`,
    },
  ];
  if (c.rubroLocal[0]) {
    ciudadFaqs.push({
      q: `¿Trabajan con obras del rubro ${c.rubroLocal[0]} en ${c.nombre}?`,
      a: `Sí. Tenemos experiencia constante con ${c.rubroLocal.slice(0, 3).join(', ')} en ${c.nombre} y comunas vecinas (${c.comunasVecinas.slice(0, 3).join(', ')}). ${tieneOperadorIncluido(m.tipo) ? (m.tipo === 'camion' ? 'Coordinamos plazos, accesos y la faena con nuestro conductor incluido en la tarifa.' : 'Coordinamos plazos, accesos y la faena con nuestro operador incluido en la tarifa.') : operaElCliente(m.tipo) ? 'Coordinamos plazos, accesos y la entrega del equipo listo para operar por tu equipo.' : 'Coordinamos plazos, accesos y la entrega del equipo.'}`,
    });
  }
  const faqs = [...tipoFaqs, ...ciudadFaqs];

  const ctaWa = buildWhatsappUrl({
    text: `${SALUDO}me interesa arrendar ${m.nombre} en ${c.nombre}`,
    utm_content: `maquinaria_${m.id}_ciudad_${c.slug}`,
    utm_campaign: 'arriendo_maquinaria_ciudad',
  });

  const brand = LEGAL_INFO.brands.constructora;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        name: `${m.nombre} en arriendo · ${c.nombre}`,
        description:
          descRich.custom ??
          `${m.nombre} disponible para arriendo en ${c.nombre} y comunas vecinas. ${descRich.intro}`,
        image: m.imagen || undefined,
        brand: { '@type': 'Brand', name: 'JURMAQ' },
        category: tipoInfo?.nombre ?? m.tipo,
        offers: precio !== null
          ? {
              '@type': 'Offer',
              priceCurrency: 'CLP',
              price: precio,
              availability:
                m.estado === 'disponible'
                  ? 'https://schema.org/InStock'
                  : 'https://schema.org/OutOfStock',
              seller: {
                '@type': 'Organization',
                name: LEGAL_INFO.nombreLegal,
              },
              areaServed: {
                '@type': 'City',
                name: c.nombre,
                containedInPlace: { '@type': 'AdministrativeArea', name: c.region },
              },
              url: canonical,
            }
          : undefined,
      },
      {
        '@type': 'LocalBusiness',
        name: 'JURMAQ — Arriendo de Maquinaria',
        telephone: brand.telefono,
        address: {
          '@type': 'PostalAddress',
          streetAddress: brand.streetAddress,
          addressLocality: brand.addressLocality,
          addressRegion: brand.addressRegion,
          addressCountry: brand.addressCountry,
        },
        geo: {
          '@type': 'GeoCoordinates',
          latitude: c.lat,
          longitude: c.lng,
        },
        areaServed: {
          '@type': 'City',
          name: c.nombre,
          containedInPlace: { '@type': 'AdministrativeArea', name: c.region },
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://jurmaq.cl' },
          { '@type': 'ListItem', position: 2, name: 'Maquinarias', item: 'https://jurmaq.cl/maquinarias' },
          { '@type': 'ListItem', position: 3, name: m.nombre, item: `https://jurmaq.cl${maquinariaHref(m)}` },
          { '@type': 'ListItem', position: 4, name: c.nombre, item: canonical },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <section className="bg-navy-950 py-10 lg:py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex flex-wrap items-center gap-2 text-sm text-gray-400 mb-6">
            <Link href="/" className="hover:text-gold-500 transition-colors">Inicio</Link>
            <span>›</span>
            <Link href="/maquinarias" className="hover:text-gold-500 transition-colors">Maquinarias</Link>
            <span>›</span>
            <Link href={maquinariaHref(m)} className="hover:text-gold-500 transition-colors">{m.nombre}</Link>
            <span>›</span>
            <span className="text-gray-300">{c.nombre}</span>
          </nav>

          <p className="text-[10px] font-semibold text-gold-400 uppercase tracking-[0.22em] mb-3">
            {tipoInfo?.nombre ?? 'Maquinaria'} · {c.region}
          </p>
          <h1
            className="text-white leading-[1.05] max-w-4xl"
            style={{ fontSize: 'clamp(2rem, 4vw, 3.25rem)', fontWeight: 500, letterSpacing: '-0.015em' }}
          >
            Arriendo {m.nombre} en{' '}
            <span className="font-[var(--font-serif)] italic text-gold-400" style={{ fontWeight: 400 }}>
              {c.nombre}
            </span>
          </h1>
          <p className="mt-4 text-base text-gray-300 max-w-3xl leading-relaxed">
            {descRich.intro}
          </p>

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-navy-900/60 border border-navy-800 rounded-xl p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-1">Distancia</p>
                <p className="text-white text-lg font-semibold tabular-nums">{dist.km} km</p>
              </div>
              <div className="bg-navy-900/60 border border-navy-800 rounded-xl p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-1">Despacho</p>
                <p className="text-white text-lg font-semibold">{dist.tiempo}</p>
              </div>
              <div className="bg-navy-900/60 border border-navy-800 rounded-xl p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-1">Disponibilidad</p>
                <p className="text-white text-lg font-semibold">
                  {m.estado === 'disponible' ? 'En stock' : 'Bajo demanda'}
                </p>
              </div>
              <div className="bg-navy-900/60 border border-navy-800 rounded-xl p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400 mb-1">Desde</p>
                <p className="text-white text-lg font-semibold tabular-nums">
                  {precio !== null
                    ? `${formatCLP(precio)} /${m.unidad_tarifa}`
                    : 'Cotizar'}
                </p>
              </div>
            </div>

            <aside className="bg-gold-500 text-navy-950 rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] font-bold mb-2">
                  Cotiza ahora
                </p>
                <p className="text-sm leading-snug">
                  Respondemos en menos de 2 horas hábiles con disponibilidad confirmada para {c.nombre}.
                </p>
              </div>
              <div className="flex flex-col gap-2 mt-4">
                <a
                  href={ctaWa}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="block w-full text-center bg-navy-950 hover:bg-navy-900 text-white font-bold py-3 rounded-xl text-sm transition-colors"
                >
                  WhatsApp →
                </a>
                <Link
                  href={`/cotizar-arriendo?maquinariaId=${m.id}&ciudad=${c.slug}`}
                  className="block w-full text-center bg-white hover:bg-gray-100 text-navy-950 font-bold py-3 rounded-xl text-sm transition-colors"
                >
                  Cotización online
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Hero image + ficha */}
      <section className="py-12 lg:py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-navy-900 to-navy-800 aspect-video flex items-center justify-center">
              {m.imagen ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={m.imagen} alt={`${m.nombre} en arriendo · ${c.nombre}`} className="w-full h-full object-cover" />
              ) : (
                <span className="text-navy-700 text-sm">Sin imagen</span>
              )}
            </div>

            {/* Ficha técnica */}
            <div className="bg-white rounded-2xl border border-[#EAEAEA] p-6 lg:p-8 space-y-6">
              <div>
                <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-3">
                  Ficha técnica
                </p>
                <h2 className="text-2xl font-semibold text-[#111111] mb-3">
                  Características de {m.nombre}
                </h2>
                <p className="text-base text-[#5A5A57] leading-relaxed">
                  {descRich.intro}
                </p>
              </div>

              {(tipoInfo?.especificacionesClave?.length ?? 0) > 0 && (
                <div className="pt-4 border-t border-[#EAEAEA]">
                  <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-3">
                    Especificaciones clave
                  </p>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                    {tipoInfo!.especificacionesClave.map((s) => (
                      <li key={s} className="flex items-start gap-2 text-sm text-[#5A5A57]">
                        <span className="text-[#956400] shrink-0">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#EAEAEA]">
                <div>
                  <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-3">
                    Usos típicos
                  </p>
                  <ul className="space-y-1.5">
                    {descRich.usos.map((u) => (
                      <li key={u} className="flex items-start gap-2 text-sm text-[#5A5A57]">
                        <span className="text-[#956400] shrink-0">→</span>
                        <span>{u}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-3">
                    Incluye sin costo
                  </p>
                  <ul className="space-y-1.5">
                    {descRich.incluye.map((i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[#5A5A57]">
                        <span className="text-[#2F7F4E] shrink-0">✓</span>
                        <span>{i}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Despacho a la ciudad */}
            <div className="bg-white rounded-2xl border border-[#EAEAEA] p-6 lg:p-8">
              <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-3">
                Despacho a {c.nombre}
              </p>
              <h2 className="text-2xl font-semibold text-[#111111] mb-3">
                Cómo llegamos a tu obra en {c.nombre}
              </h2>
              <p className="text-base text-[#5A5A57] leading-relaxed mb-4">
                Operamos desde Maquehua, Curicó (Región del Maule). A {c.nombre} la distancia por carretera es de{' '}
                <strong>{dist.km} km</strong>, lo que se traduce en{' '}
                <strong>{dist.tiempo}</strong> de despacho con camión cargado. Coordinamos la ventana
                de llegada según los horarios de tu obra.
              </p>
              <p className="text-base text-[#5A5A57] leading-relaxed">
                Desde {c.nombre} también llegamos a{' '}
                <strong>{c.comunasVecinas.join(', ')}</strong> y comunas vecinas. Coordinamos
                el traslado de la máquina contigo al confirmar el arriendo.
              </p>
            </div>

            {/* Aplicaciones típicas */}
            <div className="bg-white rounded-2xl border border-[#EAEAEA] p-6 lg:p-8">
              <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-3">
                Aplicaciones típicas en {c.nombre}
              </p>
              <h2 className="text-2xl font-semibold text-[#111111] mb-3">
                Para qué se usa {m.nombre} en {c.nombre}
              </h2>
              <p className="text-base text-[#5A5A57] leading-relaxed mb-4">
                {c.contextoLocal}
              </p>
              <p className="text-base text-[#5A5A57] leading-relaxed">
                En este contexto, {m.nombre} se usa habitualmente en faenas de{' '}
                <strong>{c.rubroLocal.slice(0, 3).join(', ')}</strong>. Despacho coordinado
                con tu encargado de obra para evitar tiempos muertos en sitio.
              </p>
            </div>

            {/* FAQ */}
            <div className="bg-white rounded-2xl border border-[#EAEAEA] p-6 lg:p-8">
              <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-3">
                Preguntas frecuentes
              </p>
              <h2 className="text-2xl font-semibold text-[#111111] mb-5">
                {m.nombre} en {c.nombre}
              </h2>
              <div className="space-y-3">
                {faqs.map((f, i) => (
                  <details
                    key={i}
                    className="border border-[#EAEAEA] rounded-xl px-4 py-3 group"
                  >
                    <summary className="cursor-pointer font-semibold text-[#111111] group-open:text-[#956400]">
                      {f.q}
                    </summary>
                    <p className="mt-3 text-sm text-[#5A5A57] leading-relaxed">{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            <div className="bg-navy-950 text-white rounded-2xl p-6">
              <p className="text-[10px] uppercase tracking-[0.22em] text-gold-400 font-bold mb-3">
                Tarifa referencial
              </p>
              {precio !== null ? (
                <p className="text-3xl font-bold tabular-nums mb-1">
                  {formatCLP(precio)}
                  <span className="text-sm font-normal text-gray-400 ml-2">
                    / {m.unidad_tarifa} neto
                  </span>
                </p>
              ) : (
                <p className="text-xl font-semibold mb-1">A cotizar</p>
              )}
              <p className="text-xs text-gray-400 mb-5">
                Valor de referencia por uso (neto). El traslado de la máquina a {c.nombre} lo
                coordinamos contigo al confirmar — sin cargos sorpresa.
              </p>
              <a
                href={ctaWa}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="block w-full text-center bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold py-3 rounded-xl mb-2 text-sm transition-colors"
              >
                WhatsApp en {c.nombre}
              </a>
              <Link
                href={`/cotizar-arriendo?maquinariaId=${m.id}&ciudad=${c.slug}`}
                className="block w-full text-center bg-white hover:bg-gray-100 text-navy-950 font-bold py-3 rounded-xl text-sm transition-colors"
              >
                Cotización online
              </Link>
            </div>

            <div className="bg-white border border-[#EAEAEA] rounded-2xl p-6">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#787774] font-bold mb-3">
                Incluido sin costo
              </p>
              <ul className="space-y-2 text-sm text-[#5A5A57]">
                {['Mantención preventiva al día', 'Coordinación de traslado', 'Asesoría por WhatsApp', 'Contrato digital'].map((it) => (
                  <li key={it} className="flex items-start gap-2">
                    <span className="text-[#2F7F4E] shrink-0">✓</span>
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white border border-[#EAEAEA] rounded-2xl p-6">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#787774] font-bold mb-3">
                Cobertura cercana
              </p>
              <p className="text-sm text-[#5A5A57] mb-3">
                Despachamos {tipoInfo?.nombrePlural.toLowerCase() ?? 'esta máquina'} a:
              </p>
              <div className="flex flex-wrap gap-2">
                {[c.nombre, ...c.comunasVecinas].map((cv) => (
                  <span
                    key={cv}
                    className="px-3 py-1 bg-[#FBFBFA] border border-[#EAEAEA] rounded-full text-xs text-[#5A5A57]"
                  >
                    {cv}
                  </span>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* Cross-links: misma máquina, otras ciudades */}
      <CrossLinksGrid
        eyebrow="Cobertura · Maule"
        title={`${m.nombre} también en otras ciudades`}
        subtitle={`Si tu obra no está en ${c.nombre}, despachamos a estas ciudades del Maule y coordinamos el traslado contigo.`}
        items={otrasCiudades.map((oc) => ({
          label: `${m.nombre} en ${oc.nombre}`,
          href: `${maquinariaHref(m)}/en/${oc.slug}`,
        }))}
      />

      {/* Cross-links: misma ciudad, otras máquinas del mismo tipo */}
      {sameType.length > 0 && (
        <CrossLinksGrid
          eyebrow={`Catálogo · ${c.nombre}`}
          title={`Otras ${tipoInfo?.nombrePlural.toLowerCase() ?? 'máquinas del mismo tipo'} en ${c.nombre}`}
          subtitle={`Compara modelos disponibles en ${c.nombre} y elige el que mejor se ajusta al volumen y plazos de tu obra.`}
          variant="dark"
          items={sameType.map((sm) => ({
            label: `${sm.nombre} en ${c.nombre}`,
            href: `${maquinariaHref(sm)}/en/${c.slug}`,
          }))}
        />
      )}

      {/* CTA final */}
      <section className="bg-navy-950 py-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-[10px] uppercase tracking-[0.22em] text-gold-400 font-bold mb-3">
            {c.nombre} · {c.region}
          </p>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
            ¿Necesitas {m.nombre} en {c.nombre} esta semana?
          </h2>
          <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
            Despacho en {dist.tiempo} desde Curicó.{' '}
            {tieneOperadorIncluido(m.tipo)
              ? m.tipo === 'camion'
                ? 'Conductor incluido en la tarifa.'
                : 'Operador incluido en la tarifa.'
              : operaElCliente(m.tipo)
                ? 'Equipo listo para operar por tu equipo.'
                : 'Equipo con mantención al día.'}{' '}
            Cotiza ahora y respondemos en menos de 2 horas hábiles.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={ctaWa}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-block bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold px-8 py-3 rounded-xl transition-colors"
            >
              WhatsApp ahora
            </a>
            <Link
              href={`/cotizar-arriendo?maquinariaId=${m.id}&ciudad=${c.slug}`}
              className="inline-block bg-white text-navy-950 font-bold px-8 py-3 rounded-xl hover:bg-gray-100 transition-colors"
            >
              Cotización online
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
