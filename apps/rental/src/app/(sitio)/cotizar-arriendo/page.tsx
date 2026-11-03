import type { Metadata } from 'next';
import { Suspense } from 'react';
import Cotizador from '@/components/Cotizador';
import CabezaPagina from '@/components/CabezaPagina';
import { obtenerFlota } from '@/lib/flota';
import { SITIO } from '@/lib/sitio';

export const revalidate = 2592000;

export const metadata: Metadata = {
  title: 'Cotizar arriendo de maquinaria · JURMAQ',
  description: 'Pide tu cotización de arriendo de maquinaria en la Región del Maule. Elige máquina, comuna y fechas.',
  alternates: { canonical: `${SITIO.url}/cotizar-arriendo` },
};

export default async function CotizarArriendo() {
  const flota = (await obtenerFlota()).map(({ id, nombre, precios, minimoUnidades, fotos, fotoReferencial }) => ({ id, nombre, precios, minimoUnidades, fotos, fotoReferencial }));
  return (
    <div className="sobre-claro">
      <CabezaPagina migas={[{ nombre: 'Cotizar' }]} titulo="Cotizar arriendo" bajada="Cuéntanos qué necesitas y te enviamos la cotización." />
      <div className="mx-auto max-w-[1320px] px-4 pb-16 md:px-8">
        <Suspense>
          <Cotizador flota={flota} />
        </Suspense>
      </div>
    </div>
  );
}
