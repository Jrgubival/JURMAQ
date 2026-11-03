import type { Metadata } from 'next';
import { Suspense } from 'react';
import Cotizador from '@/components/Cotizador';
import Migas from '@/components/Migas';
import { obtenerFlota } from '@/lib/flota';
import { SITIO } from '@/lib/sitio';

export const revalidate = 2592000;

export const metadata: Metadata = {
  title: 'Cotizar arriendo de maquinaria · JURMAQ',
  description: 'Pide tu cotización de arriendo de maquinaria en la Región del Maule. Elige máquina, comuna y fechas.',
  alternates: { canonical: `${SITIO.url}/cotizar-arriendo` },
};

export default async function CotizarArriendo() {
  const flota = (await obtenerFlota()).map(({ id, nombre, precios, minimoUnidades }) => ({ id, nombre, precios, minimoUnidades }));
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Migas items={[{ nombre: 'Cotizar' }]} />
      <h1 className="mt-4 text-4xl">Cotizar arriendo</h1>
      <Suspense>
        <Cotizador flota={flota} />
      </Suspense>
    </div>
  );
}
