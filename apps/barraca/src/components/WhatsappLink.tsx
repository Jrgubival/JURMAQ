"use client"

import { trackEvents } from '@/lib/analytics';

/**
 * Wrapper sobre <a> que auto-trackea click WhatsApp.
 *
 * Twin del componente equivalente en apps/constructora — cubre el gap P0 del
 * audit-analytics barraca: 15+ CTAs WhatsApp en producción usaban <a href>
 * crudo sin trackEvents.whatsappClick() → canal #1 conversión invisible
 * en GA4.
 *
 * Uso:
 *   <WhatsappLink href="https://wa.me/56976673577?text=..." source="topbar">
 *     💬 WhatsApp
 *   </WhatsappLink>
 */

interface Props extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  /** Identificador del origen del click. Ej: 'topbar', 'product_card', 'cart_drawer', 'maestros_hero', 'sucursales' */
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
