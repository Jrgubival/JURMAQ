import Link from 'next/link';
import EnlacesNav from './EnlacesNav';
import Menu from './Menu';

export default function Cabecera() {
  return (
    <header className="sticky top-0 z-30 bg-negro text-white">
      <div className="mx-auto flex h-[68px] max-w-[1320px] items-center justify-between gap-4 px-4 md:px-8">
        <Link href="/" prefetch={false} className="relative z-30 flex shrink-0 items-baseline">
          <span className="text-2xl font-extrabold tracking-tight text-white lg:text-3xl">JURMAQ</span>
          <span className="ml-1 text-lg font-semibold text-acento lg:text-xl">Arriendo</span>
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
