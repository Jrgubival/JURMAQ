import type { Metadata } from 'next';
import Link from 'next/link';
import Migas from '@/components/Migas';
import { BarraMovil } from '@/components/AccionesContacto';
import TarjetaMaquina from '@/components/TarjetaMaquina';
import { obtenerFlota } from '@/lib/flota';
import { TIPOS } from '@/lib/landings';
import { SITIO } from '@/lib/sitio';

export const revalidate = 2592000;

export const metadata: Metadata = {
  title: 'Maquinaria en arriendo: flota y valores · JURMAQ',
  description: 'Flota de JURMAQ en la Región del Maule: valores referenciales por hora, día, semana o mes, y quién opera cada máquina.',
  alternates: { canonical: `${SITIO.url}/maquinarias` },
};

export default async function Catalogo() {
  const flota = await obtenerFlota();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Migas items={[{ nombre: 'Máquinas' }]} />
      <h1 className="mt-4 text-4xl">Maquinaria en arriendo</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">Valores referenciales y netos. El traslado se cotiza aparte según la comuna de la obra.</p>
      <ul className="mt-5 flex flex-wrap gap-2">
        {TIPOS.map((t) => (
          <li key={t.slug}><Link href={`/arriendo/${t.slug}`} prefetch={false} className="boton boton-suave">{t.nombre}</Link></li>
        ))}
      </ul>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {flota.map((m) => <TarjetaMaquina key={m.id} maquina={m} />)}
      </div>
      <BarraMovil cotizar="/cotizar-arriendo" texto="Hola, quiero cotizar el arriendo de una máquina." />
    </div>
  );
}
