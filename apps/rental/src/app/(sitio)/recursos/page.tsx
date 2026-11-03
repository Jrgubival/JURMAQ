import type { Metadata } from 'next';
import Link from 'next/link';
import CabezaPagina from '@/components/CabezaPagina';
import { RECURSOS } from '@/data/recursos';
import { SITIO } from '@/lib/sitio';

export const metadata: Metadata = {
  title: 'Guías de arriendo de maquinaria · JURMAQ',
  description: 'Guías para elegir máquina, calcular una excavación y entender valores y operador en el arriendo de maquinaria.',
  alternates: { canonical: `${SITIO.url}/recursos` },
};

export default function Recursos() {
  return (
    <div className="sobre-claro">
      <CabezaPagina migas={[{ nombre: 'Guías' }]} titulo="Guías de arriendo" />
      <ul className="mx-auto grid max-w-[1320px] gap-px px-4 py-12 md:grid-cols-2 md:gap-x-12 md:px-8 md:py-16">
        {RECURSOS.map((r) => (
          <li key={r.slug}>
            <Link href={`/recursos/${r.slug}`} prefetch={false} className="presionable block border-t border-[#111]/20 py-5">
              <h2 className="text-2xl">{r.h1}</h2>
              <p className="mt-1 text-ink-soft">{r.resumen}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
