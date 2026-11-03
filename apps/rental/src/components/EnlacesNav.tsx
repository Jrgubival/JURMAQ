'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ENLACES } from '@/lib/enlaces';

export default function EnlacesNav() {
  const ruta = usePathname();
  return ENLACES.map((e) => {
    const actual = ruta === e.href || ruta.startsWith(`${e.href}/`);
    return (
      <Link
        key={e.href}
        href={e.href}
        prefetch={false}
        aria-current={actual ? 'page' : undefined}
        className={`text-[0.9375rem] font-medium transition-colors duration-150 hover:text-white ${actual ? 'text-white underline decoration-2 underline-offset-8' : 'text-white/75'}`}
      >
        {e.texto}
      </Link>
    );
  });
}
