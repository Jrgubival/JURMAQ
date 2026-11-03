import Link from 'next/link';
import { enlaceWhatsapp } from '@/lib/sitio';

export function AccionesContacto({ cotizar, texto }: { cotizar: string; texto: string }) {
  return (
    <div className="flex flex-wrap gap-3">
      <Link href={cotizar} prefetch={false} className="boton boton-principal">Cotizar</Link>
      <a href={enlaceWhatsapp(texto)} className="boton boton-secundario" rel="noopener">WhatsApp</a>
    </div>
  );
}

/** Barra fija en celular, siempre a un dedo. */
export function BarraMovil({ cotizar, texto }: { cotizar: string; texto: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-2 gap-2 border-t border-hairline bg-canvas p-3 md:hidden">
      <Link href={cotizar} prefetch={false} className="boton boton-principal">Cotizar</Link>
      <a href={enlaceWhatsapp(texto)} className="boton boton-secundario" rel="noopener">WhatsApp</a>
    </div>
  );
}
