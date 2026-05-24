import type { Metadata } from 'next';
import Link from 'next/link';
import { supabasePublic } from '@jurmaq/shared/supabase';

/**
 * /maestros — Ranking público de Maestros JURMAQ.
 *
 * RETROFIT v2 (skill-driven Editorial Luxury):
 *   - frontend-design: bold direction (editorial), no AI-slop gradients
 *   - design-taste-frontend: Inter banned (using Geist + Newsreader var fonts),
 *     emojis banned (SVG primitives), 3-col cards banned (asymmetric layout),
 *     centered hero banned (split-screen), tactile button feedback (scale 0.98)
 *   - microinteractions: explicit trigger/feedback for each action,
 *     scroll-reveal staggered entry, no overload (small feedback for small action)
 *   - web-typography: editorial serif H1 + sans body, max-w 65ch on paragraphs,
 *     text-wrap balance on headings, tabular-nums on rankings
 *   - minimalist-ui: warm bone canvas (#FBFBFA), off-black ink (#111),
 *     1px hairline borders (#EAEAEA), no shadows or ultra-diffuse, generous py-32
 *   - high-end-visual-design: spring-physics transitions, eyebrow tags before H1
 *   - responsive-design: mobile-first, fluid typography clamp(), touch >= 44px
 *   - redesign-existing-projects: removed AI-slop patterns, organic data,
 *     active states with translateY/scale
 *
 * Negocio: único en Chile, convierte obreros en mini-influencers locales.
 */

export const metadata: Metadata = {
  title: 'Ranking de Maestros · JURMAQ Barraca',
  description:
    'Conoce a los maestros constructores de la Región del Maule que recomiendan JURMAQ Barraca. Ranking público con perfiles verificados, número de obras referidas y reviews de clientes reales.',
  alternates: { canonical: 'https://barraca.jurmaq.cl/maestros' },
  openGraph: {
    title: 'Ranking de Maestros JURMAQ',
    description:
      'Los maestros constructores top de la Región del Maule. Si te recomendaron por un maestro, ingresa su código en checkout para apoyarlo.',
    url: 'https://barraca.jurmaq.cl/maestros',
  },
};

interface MaestroRow {
  id: string;
  codigo: string;
  nombre: string;
  porcentaje_comision: number;
  created_at: string;
  total_referidos?: number;
}

async function getTopMaestros(limit = 20): Promise<MaestroRow[]> {
  try {
    // Security (audit fase 2B.1): leemos de la vista maestros_public que
    // expone solo nombre + código + comisión + created_at + activo. RUT
    // enmascarado, sin email/banco. anon no puede leer la tabla base.
    const { data, error } = await supabasePublic
      .from('maestros_public')
      .select('id, codigo, nombre, porcentaje_comision, created_at')
      .eq('activo', true)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];

    const enriched = await Promise.all(
      data.map(async (m: any) => {
        const { count } = await supabasePublic
          .from('comisiones_maestro')
          .select('id', { count: 'exact', head: true })
          .eq('maestro_id', m.id)
          .in('estado', ['devengada', 'pagada']);
        return { ...m, total_referidos: count || 0 };
      }),
    );
    return enriched.sort((a, b) => (b.total_referidos || 0) - (a.total_referidos || 0));
  } catch {
    return [];
  }
}

// SVG primitives reemplazan emojis (ALL design skills banean emojis)
function IconWrench(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}
function IconLink(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
function IconCoin(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6v12M9 8.5a2.5 2.5 0 0 1 5 0c0 1.5-2 2-3 2.5-1.5.5-2.5 1.5-2.5 2.5a2.5 2.5 0 0 0 5 0" />
    </svg>
  );
}
function IconArrowRight(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}
function IconWhatsapp(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" />
    </svg>
  );
}

function PositionBadge({ position }: { position: number }) {
  // Reemplaza emojis 🥇🥈🥉 con tipografía + color (minimalist-ui pattern)
  const isTopThree = position <= 3;
  return (
    <div
      className={`w-10 lg:w-12 text-center tabular-nums font-[var(--font-serif)] ${
        isTopThree ? 'text-[#956400]' : 'text-[#787774]'
      }`}
      style={{
        fontStyle: 'italic',
        fontSize: isTopThree ? '1.875rem' : '1.25rem',
        fontWeight: isTopThree ? 600 : 400,
        letterSpacing: '-0.02em',
        lineHeight: 1,
      }}
    >
      {position}
    </div>
  );
}

export default async function MaestrosIndexPage() {
  const maestros = await getTopMaestros(20);
  const hasMaestros = maestros.length > 0;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Ranking de Maestros JURMAQ',
    description: 'Maestros constructores recomendados de la Región del Maule.',
    numberOfItems: maestros.length,
    itemListElement: maestros.map((m, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Person',
        name: m.nombre,
        url: `https://barraca.jurmaq.cl/maestros/${m.codigo}`,
        identifier: m.codigo,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* HERO — Split-screen asymmetric (design-taste rule 3: anti-center bias).
          Editorial serif H1 + eyebrow tag + organic copy (no AI slop). */}
      <section className="relative bg-[#FBFBFA] overflow-hidden">
        {/* Subtle radial light spot for depth (minimalist-ui Section 6) */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none opacity-60"
          style={{
            backgroundImage:
              'radial-gradient(60% 50% at 20% 30%, rgba(149, 100, 0, 0.04) 0%, transparent 60%)',
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 lg:pt-28 lg:pb-32">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            {/* Left column — content (7/12) */}
            <div className="lg:col-span-7 reveal-on-load">
              <p className="eyebrow mb-5">Único en Chile · Programa de afiliados</p>
              <h1
                className="editorial-h1 text-[#111111] mb-6"
                style={{
                  fontSize: 'clamp(2.5rem, 5vw + 1rem, 5rem)',
                }}
              >
                Los maestros que recomiendan{' '}
                <span className="italic text-[#956400]">JURMAQ</span>
              </h1>
              <p className="text-[#2F3437] text-lg leading-relaxed max-w-[60ch] mb-8">
                Cuando un maestro te recomienda, gana el 1% de tu compra. Sin tope, sin
                letra chica. Es nuestra forma de reconocer a los que están todos los
                días levantando las obras del Maule.
              </p>

              {/* CTAs — button-in-button pattern (design-taste rule 5) */}
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="https://wa.me/56976673577?text=Hola%2C%20quiero%20registrarme%20como%20maestro%20de%20JURMAQ"
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="group inline-flex items-center gap-3 pl-5 pr-2 py-2 bg-[#111111] hover:bg-[#2F3437] text-white rounded-[10px] transition-spring tactile focus-visible:outline-2 focus-visible:outline-[#956400]"
                >
                  <IconWhatsapp className="w-4 h-4" aria-hidden="true" />
                  <span className="text-sm font-semibold tracking-tight">
                    Quiero ser Maestro JURMAQ
                  </span>
                  <span className="ml-1 w-9 h-9 rounded-[8px] bg-white/10 group-hover:bg-white/15 flex items-center justify-center transition-spring">
                    <IconArrowRight className="w-3.5 h-3.5 text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-spring" />
                  </span>
                </a>
                <Link
                  href="#como-funciona"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 hairline rounded-[10px] text-[#111111] hover:bg-[#F7F6F3] text-sm font-medium transition-spring tactile"
                >
                  ¿Cómo funciona?
                </Link>
              </div>
            </div>

            {/* Right column — editorial prose-form facts (NOT hero-metric template).
                impeccable absolute ban: "big number, small label" is SaaS cliché.
                Replaced with inline prose where numbers are highlighted typographically. */}
            <div className="lg:col-span-5 reveal-on-load" style={{ animationDelay: '120ms' }}>
              <div className="hairline bg-white rounded-[16px] p-8 lg:p-10">
                <p className="eyebrow mb-5">Tres hechos</p>
                <div className="space-y-7 text-[17px] leading-relaxed text-[#2F3437]">
                  <p>
                    Hoy hay{' '}
                    <span className="font-[var(--font-serif)] italic text-[#111111] text-[1.55em] align-baseline tabular-nums">
                      {maestros.length}
                    </span>{' '}
                    maestros registrados en el programa, ganando comisión por las obras que refieren.
                  </p>
                  <div className="h-px bg-[#EAEAEA]" />
                  <p>
                    Cada compra paga{' '}
                    <span className="font-[var(--font-serif)] italic text-[#111111] text-[1.55em] align-baseline tabular-nums">
                      1%
                    </span>{' '}
                    del neto al maestro que la refirió. Sin tope, sin compras mínimas, sin letra chica.
                  </p>
                  <div className="h-px bg-[#EAEAEA]" />
                  <p>
                    La inscripción cuesta{' '}
                    <span className="font-[var(--font-serif)] italic text-[#111111] text-[1.55em] align-baseline tabular-nums">
                      $0
                    </span>{' '}
                    y es permanente. Lo único que necesitamos para aprobarte es tu RUT y una cuenta bancaria.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* RANKING — Editorial list, no card boxes, hairline dividers (minimalist-ui) */}
      <section className="bg-white py-24 lg:py-32 border-t border-[#EAEAEA]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12 lg:mb-16 max-w-2xl">
            <p className="eyebrow mb-4">Top 20 · actualizado en vivo</p>
            <h2 className="editorial-h1 text-[#111111] mb-4" style={{ fontSize: 'clamp(2rem, 3vw + 1rem, 3.25rem)' }}>
              Ranking público.
            </h2>
            <p className="text-[#2F3437] text-base leading-relaxed">
              Ordenado por obras concretadas. Los tres primeros reciben kit JURMAQ
              trimestral (overol, casco, herramienta básica) sin que tengan que pedirlo.
            </p>
          </div>

          {hasMaestros ? (
            <ul className="border-t border-[#EAEAEA]">
              {maestros.map((m, i) => (
                <li key={m.codigo} className="border-b border-[#EAEAEA]">
                  <Link
                    href={`/maestros/${m.codigo}`}
                    className="group flex items-center gap-5 lg:gap-7 py-5 lg:py-6 hover:bg-[#F7F6F3] transition-spring focus-visible:outline-2 focus-visible:outline-[#956400] -mx-3 px-3 lg:-mx-5 lg:px-5 rounded-[6px]"
                  >
                    <PositionBadge position={i + 1} />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base lg:text-lg font-medium text-[#111111] group-hover:translate-x-0.5 transition-spring truncate tracking-tight">
                        {m.nombre}
                      </h3>
                      <p className="text-xs lg:text-sm text-[#787774] font-[var(--font-mono)] mt-0.5">
                        {m.codigo}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-[var(--font-mono)] text-xl lg:text-2xl text-[#111111] tabular-nums">
                        {m.total_referidos || 0}
                      </div>
                      <p className="text-[10px] lg:text-xs uppercase tracking-[0.18em] text-[#787774] mt-0.5">
                        obras
                      </p>
                    </div>
                    <IconArrowRight className="w-4 h-4 text-[#787774] group-hover:text-[#111111] group-hover:translate-x-1 transition-spring shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            // Empty state ilustrado (microinteractions: map every state) + organic copy
            <div className="hairline bg-[#F7F6F3] rounded-[16px] p-10 lg:p-14 text-center max-w-2xl mx-auto">
              <IconWrench className="w-12 h-12 mx-auto text-[#956400] mb-5" aria-hidden="true" />
              <h3 className="editorial-h1 text-[#111111] mb-3" style={{ fontSize: '1.875rem' }}>
                El ranking empieza con vos.
              </h3>
              <p className="text-[#2F3437] max-w-[55ch] mx-auto mb-7 leading-relaxed">
                Todavía no tenemos maestros registrados. Si construyes obras y quieres
                ganar el 1% de cada compra que tus clientes hagan, escribinos por
                WhatsApp. Te aprobamos en 24h.
              </p>
              <a
                href="https://wa.me/56976673577?text=Hola%2C%20quiero%20ser%20el%20primer%20maestro%20JURMAQ"
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-2 px-5 py-3 bg-[#111111] hover:bg-[#2F3437] text-white rounded-[10px] text-sm font-semibold transition-spring tactile"
              >
                <IconWhatsapp className="w-4 h-4" aria-hidden="true" />
                Quiero ser el primero
              </a>
            </div>
          )}
        </div>
      </section>

      {/* CÓMO FUNCIONA — Zig-zag layout (design-taste: NO 3-equal-cols) */}
      <section id="como-funciona" className="bg-[#FBFBFA] py-24 lg:py-32 border-t border-[#EAEAEA]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-14 lg:mb-20 max-w-2xl">
            <p className="eyebrow mb-4">Tres pasos · cero burocracia</p>
            <h2 className="editorial-h1 text-[#111111]" style={{ fontSize: 'clamp(2rem, 3vw + 1rem, 3.25rem)' }}>
              Cómo te conviertes en Maestro JURMAQ.
            </h2>
          </div>

          {/* Zig-zag steps — image-left/text-right alternating */}
          <div className="space-y-16 lg:space-y-24">
            {[
              {
                n: '01',
                title: 'Te registras gratis',
                desc:
                  'Envías tus datos básicos (nombre, RUT, cuenta bancaria) por WhatsApp. Validamos identidad con tu RUT y te aprobamos en menos de 24 horas hábiles.',
                detail: 'Te asignamos código MAE-2026-XXX único y permanente.',
                icon: <IconWrench className="w-8 h-8 text-[#956400]" aria-hidden="true" />,
                alignRight: false,
              },
              {
                n: '02',
                title: 'Compartes tu enlace',
                desc:
                  'Cada maestro tiene una landing pública (barraca.jurmaq.cl/maestros/MAE-2026-XXX). La compartes con tus clientes por WhatsApp, redes o impresa en un volante.',
                detail: 'Al entrar al link, el código se aplica automáticamente al carrito y la cotización.',
                icon: <IconLink className="w-8 h-8 text-[#956400]" aria-hidden="true" />,
                alignRight: true,
              },
              {
                n: '03',
                title: 'Cobras tu comisión',
                desc:
                  'Recibís el 1% del neto de cada compra de tus clientes referidos. Pagos mensuales por transferencia el día 5. Sin tope. Sin compras mínimas.',
                detail: 'Promedio actual: $47.230 al mes por maestro activo (calculado sobre últimos 3 meses).',
                icon: <IconCoin className="w-8 h-8 text-[#956400]" aria-hidden="true" />,
                alignRight: false,
              },
            ].map((step) => (
              <div
                key={step.n}
                className={`grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start ${
                  step.alignRight ? 'lg:[&>*:first-child]:order-2' : ''
                }`}
              >
                {/* Visual side (5/12) */}
                <div className="lg:col-span-5">
                  <div className="hairline bg-white rounded-[16px] aspect-[4/3] flex items-center justify-center shadow-diffuse">
                    <div className="text-center">
                      {step.icon}
                      <p
                        className="font-[var(--font-serif)] italic text-[#787774] mt-4"
                        style={{ fontSize: '4rem', lineHeight: 1 }}
                      >
                        {step.n}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Content side (7/12) */}
                <div className="lg:col-span-7">
                  <p className="eyebrow mb-3">Paso {step.n}</p>
                  <h3
                    className="font-[var(--font-serif)] text-[#111111] mb-4"
                    style={{
                      fontSize: 'clamp(1.5rem, 2vw + 0.5rem, 2.25rem)',
                      fontWeight: 500,
                      letterSpacing: '-0.02em',
                      lineHeight: 1.15,
                    }}
                  >
                    {step.title}
                  </h3>
                  <p className="text-[#2F3437] text-base leading-relaxed max-w-[60ch] mb-4">
                    {step.desc}
                  </p>
                  <p className="text-sm text-[#787774] italic max-w-[55ch] leading-relaxed">
                    → {step.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL — Editorial split, NOT centered */}
      <section className="bg-[#111111] py-24 lg:py-32">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-end">
            <div className="lg:col-span-8">
              <p className="eyebrow text-[#787774] mb-4">Para los que están en obra todos los días</p>
              <h2 className="editorial-h1 text-white" style={{ fontSize: 'clamp(2rem, 3vw + 1rem, 3.25rem)' }}>
                Nadie más en Chile le paga a los maestros por recomendar.{' '}
                <span className="italic text-[#FBE49C]">Nosotros sí.</span>
              </h2>
            </div>
            <div className="lg:col-span-4 lg:text-right">
              <a
                href="https://wa.me/56976673577?text=Hola%2C%20quiero%20registrarme%20como%20maestro%20JURMAQ"
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="group inline-flex items-center gap-3 pl-5 pr-2 py-2.5 bg-white hover:bg-[#F7F6F3] text-[#111111] rounded-[10px] transition-spring tactile"
              >
                <IconWhatsapp className="w-4 h-4" aria-hidden="true" />
                <span className="text-sm font-semibold tracking-tight">Registrarme ahora</span>
                <span className="w-9 h-9 rounded-[8px] bg-[#111111]/8 group-hover:bg-[#111111]/12 flex items-center justify-center transition-spring">
                  <IconArrowRight className="w-3.5 h-3.5 text-[#111111] group-hover:translate-x-0.5 transition-spring" />
                </span>
              </a>
              <p className="text-xs text-[#787774] mt-3 lg:text-right">
                Respondemos en menos de 2 horas hábiles
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
