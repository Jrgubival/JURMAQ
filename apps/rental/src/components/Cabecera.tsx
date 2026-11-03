import Link from 'next/link';
import EnlacesNav from './EnlacesNav';
import Menu from './Menu';

export default function Cabecera() {
  return (
    <header className="sticky top-0 z-30 bg-negro text-white">
      <div className="mx-auto flex h-[68px] max-w-[1320px] items-center justify-between gap-4 px-4 md:px-8">
        <Link href="/" prefetch={false} className="relative z-30 flex items-baseline gap-2 font-titulo text-[1.75rem] font-semibold uppercase leading-none">
          JURMAQ <span className="font-semibold text-acento">Arriendo</span>
        </Link>
        <nav aria-label="Principal" className="hidden items-center gap-7 md:flex">
          <EnlacesNav />
          <Link href="/cotizar-arriendo" prefetch={false} className="boton boton-principal !min-h-11">Cotizar</Link>
        </nav>
        <Menu />
      </div>
    </header>
  );
}
