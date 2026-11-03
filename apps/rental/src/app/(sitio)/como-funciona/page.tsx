import type { Metadata } from 'next';
import Link from 'next/link';
import Migas from '@/components/Migas';
import { SITIO } from '@/lib/sitio';

export const metadata: Metadata = {
  title: 'Cómo funciona el arriendo de maquinaria · JURMAQ',
  description: 'Cómo arrendar una máquina con JURMAQ: eliges, pides tu cotización, confirmamos valores y traslado, y firmas el contrato.',
  alternates: { canonical: `${SITIO.url}/como-funciona` },
};

const PASOS = [
  { t: 'Elige la máquina', d: 'Revisa la flota y sus valores referenciales. Si no sabes cuál necesitas, cuéntanos el trabajo.' },
  { t: 'Pide tu cotización', d: 'Por el formulario o WhatsApp, con la comuna, las fechas y el tiempo que la necesitas.' },
  { t: 'Te enviamos el detalle', d: 'Recibes una cotización en PDF con neto, IVA, total y el traslado a tu obra.' },
  { t: 'Firmas y coordinamos', d: 'Con la cotización aceptada se prepara el contrato de arriendo y coordinamos la entrega.' },
];

export default function ComoFunciona() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Migas items={[{ nombre: 'Cómo funciona' }]} />
      <h1 className="mt-4 text-4xl">Cómo funciona el arriendo</h1>
      <ol className="mt-6 divide-y divide-hairline border-y border-hairline">
        {PASOS.map((p, i) => (
          <li key={p.t} className="flex gap-4 py-5">
            <span className="font-titulo text-3xl font-semibold text-ink-muted">{i + 1}</span>
            <div><h2 className="text-xl">{p.t}</h2><p className="mt-1 text-ink-soft">{p.d}</p></div>
          </li>
        ))}
      </ol>
      <Link href="/cotizar-arriendo" prefetch={false} className="boton boton-principal mt-6">Cotizar</Link>
    </div>
  );
}
