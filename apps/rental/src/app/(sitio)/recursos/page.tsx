import type { Metadata } from 'next';
import Link from 'next/link';
import Migas from '@/components/Migas';
import { RECURSOS } from '@/data/recursos';
import { SITIO } from '@/lib/sitio';

export const metadata: Metadata = {
  title: 'Guías de arriendo de maquinaria · JURMAQ',
  description: 'Guías para elegir máquina, calcular una excavación y entender valores y operador en el arriendo de maquinaria.',
  alternates: { canonical: `${SITIO.url}/recursos` },
};

export default function Recursos() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Migas items={[{ nombre: 'Guías' }]} />
      <h1 className="mt-4 text-4xl">Guías de arriendo</h1>
      <ul className="mt-6 divide-y divide-hairline border-y border-hairline">
        {RECURSOS.map((r) => (
          <li key={r.slug}>
            <Link href={`/recursos/${r.slug}`} prefetch={false} className="presionable block py-4">
              <h2 className="text-xl">{r.h1}</h2>
              <p className="mt-1 text-ink-soft">{r.resumen}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
