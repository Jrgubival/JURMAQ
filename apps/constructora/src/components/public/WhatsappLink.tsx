'use client';

import { trackEvents } from '@/lib/analytics';

/**
 * Wrapper sobre <a> que auto-trackea click WhatsApp.
 *
 * Fix P0 audit-analytics: 30+ CTAs WhatsApp en producción usaban <a href>
 * crudo sin trackEvents.whatsappClick(). El canal #1 de conversión quedaba
 * invisible en GA4. Este componente cubre el gap.
 *
 * Uso:
 *   <WhatsappLink href={whatsappCtaMaquinaria(id, nombre)} source="maquinaria_detail">
 *     💬 WhatsApp
 *   </WhatsappLink>
 */

interface Props extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  /** Identificador del origen del click. Ej: 'navbar', 'hero_home', 'maquinaria_detail', 'pricing_tiers' */
  source: string;
  children: React.ReactNode;
}

export default function WhatsappLink({ href, source, children, onClick, ...rest }: Props) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      onClick={(e) => {
        try {
          trackEvents.whatsappClick(source);
        } catch {
          /* swallow — never break the link click */
        }
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
