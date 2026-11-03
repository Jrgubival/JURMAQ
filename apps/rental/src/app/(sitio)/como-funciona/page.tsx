import type { Metadata } from 'next';
import Link from 'next/link';
import { BarraMovil } from '@/components/AccionesContacto';
import CabezaPagina from '@/components/CabezaPagina';
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
    <div className="sobre-claro">
      <CabezaPagina migas={[{ nombre: 'Cómo funciona' }]} titulo="Cómo funciona el arriendo" />
      <div className="mx-auto max-w-[1320px] px-4 py-12 md:px-8 md:py-20">
      <ol className="grid gap-px bg-[#111]/15 md:grid-cols-4">
        {PASOS.map((p, i) => (
          <li key={p.t} className="bg-canvas p-5 md:min-h-72">
            <span className="font-titulo text-6xl font-semibold">{i + 1}</span>
            <h2 className="mt-6 text-2xl">{p.t}</h2>
            <p className="mt-2 text-ink-soft">{p.d}</p>
          </li>
        ))}
      </ol>
      <Link href="/cotizar-arriendo" prefetch={false} className="boton boton-principal mt-8">Cotizar</Link>
      </div>
      <BarraMovil cotizar="/cotizar-arriendo" texto="Hola, quiero cotizar el arriendo de una máquina." />
    </div>
  );
}
