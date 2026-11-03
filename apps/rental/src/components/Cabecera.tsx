import Link from 'next/link';
import { ENLACES } from '@/lib/enlaces';
import Menu from './Menu';

export default function Cabecera() {
  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-canvas">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" prefetch={false} className="relative z-30 font-titulo text-2xl font-semibold tracking-wide">
          JURMAQ <span className="font-sans text-sm font-medium text-ink-muted">Rental</span>
        </Link>
        <nav aria-label="Principal" className="hidden items-center gap-6 md:flex">
          {ENLACES.map((e) => (
            <Link key={e.href} href={e.href} prefetch={false} className="text-sm font-medium text-ink-soft hover:text-ink">
              {e.texto}
            </Link>
          ))}
          <Link href="/cotizar-arriendo" prefetch={false} className="boton boton-principal">
            Cotizar
          </Link>
        </nav>
        <Menu />
      </div>
    </header>
  );
}
