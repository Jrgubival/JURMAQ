import Link from 'next/link';
import { ArrowRight, WhatsappLogo } from '@phosphor-icons/react/dist/ssr';
import { enlaceWhatsapp } from '@/lib/sitio';

export function AccionesContacto({ cotizar, texto }: { cotizar: string; texto: string }) {
  return (
    <div className="flex flex-wrap gap-3">
      <Link href={cotizar} prefetch={false} className="boton boton-principal">Cotizar <ArrowRight size={18} weight="bold" aria-hidden /></Link>
      <a href={enlaceWhatsapp(texto)} className="boton boton-secundario" rel="noopener"><WhatsappLogo size={20} aria-hidden /> WhatsApp</a>
    </div>
  );
}

/** Barra fija en celular, siempre a un dedo. */
export function BarraMovil({ cotizar, texto }: { cotizar: string; texto: string }) {
  return (
    <div className="barra-movil fixed inset-x-0 bottom-0 z-20 grid grid-cols-2 gap-2 bg-negro p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] text-white md:hidden">
      <Link href={cotizar} prefetch={false} className="boton boton-principal">Cotizar</Link>
      <a href={enlaceWhatsapp(texto)} className="boton boton-secundario" rel="noopener"><WhatsappLogo size={20} aria-hidden /> WhatsApp</a>
    </div>
  );
}
