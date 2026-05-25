import Link from 'next/link';

/**
 * ObraCompletaCTA — Banner inline para destacar mejora-precio en obras completas
 * o multi-arriendo. Se renderiza después de PricingTiers en /maquinarias/[id] y
 * en el home.
 *
 * Diferenciador único JURMAQ: si arriendas más de una máquina, o si es una obra
 * completa con materiales (barraca) + maquinaria + constructora, te bajamos
 * más el precio. Ningún competidor en Chile lo ofrece formalmente.
 *
 * Aplica skills: minimalist-ui (warm bone + hairline + serif italic accents),
 * design-taste (eyebrow tag), impeccable (no hero-metric, no em dashes UX copy),
 * emil-design-eng (tactile feedback en CTA).
 */
interface Props {
  /** Para tracking GA4 / WhatsApp UTM */
  source?: string;
}

export default function ObraCompletaCTA({ source = 'maquinaria_detail' }: Props) {
  const whatsappMessage = encodeURIComponent(
    'Hola, quiero precio personalizado para arriendo de varias máquinas / obra completa en JURMAQ. ¿Me podés ayudar?',
  );

  return (
    <section className="bg-[#FBFBFA] hairline rounded-[16px] p-6 lg:p-7">
      <p className="eyebrow mb-4">Mejora precio · obra completa o multi-arriendo</p>

      <h3
        className="font-[var(--font-serif)] text-[#111111] mb-4 tracking-tight"
        style={{
          fontSize: 'clamp(1.5rem, 2vw + 0.5rem, 2rem)',
          lineHeight: 1.15,
          fontWeight: 500,
        }}
      >
        ¿Más de una máquina, o es para la obra completa?{' '}
        <span className="italic text-[#956400]">Te bajamos el precio.</span>
      </h3>

      <p className="text-[#2F3437] text-base leading-relaxed max-w-[60ch] mb-6">
        Si necesitas dos o más equipos para la misma obra, o si además vas a comprar
        materiales en la barraca, armamos un solo presupuesto con precio mejorado.
        No es descuento de catálogo, es propuesta caso a caso revisada por un ejecutivo.
      </p>

      <ul className="space-y-3 mb-7">
        {[
          {
            label: 'Más de una máquina',
            detail: 'Descuento adicional sobre el subtotal de cada equipo arrendado.',
          },
          {
            label: 'Obra completa (máquinas + materiales)',
            detail: 'Cotización unificada con descuento cross-categoría JURMAQ Barraca.',
          },
          {
            label: 'Arriendo > 1 mes',
            detail: 'Tarifa mensual extendida, mejor que tabla pública.',
          },
        ].map((it) => (
          <li key={it.label} className="flex items-start gap-3">
            <span
              className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#956400] shrink-0"
              aria-hidden="true"
            />
            <div>
              <span className="font-medium text-[#111111]">{it.label}</span>
              <span className="text-[#787774] text-sm leading-relaxed block">
                {it.detail}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col sm:flex-row gap-3">
        <a
          href={`https://wa.me/56976673577?text=${whatsappMessage}&utm_source=site&utm_medium=cta&utm_campaign=obra_completa&utm_content=${source}`}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="group inline-flex items-center justify-center gap-3 px-5 py-3 bg-[#111111] hover:bg-[#2F3437] text-white text-sm font-semibold rounded-[10px] transition-spring tactile"
        >
          Pedir precio personalizado
          <svg
            className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-spring"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </a>
        <Link
          href="/obras-completas"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-white hairline hover:bg-[#F7F6F3] text-[#111111] text-sm font-medium rounded-[10px] transition-spring tactile"
        >
          ¿Cómo funciona?
        </Link>
      </div>
    </section>
  );
}
