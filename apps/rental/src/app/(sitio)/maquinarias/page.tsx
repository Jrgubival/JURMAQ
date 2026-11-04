import type { Metadata } from 'next';
import Link from 'next/link';
import { BarraMovil } from '@/components/AccionesContacto';
import Migas from '@/components/Migas';
import { MosaicoFlota } from '@/components/TarjetaMaquina';
import { obtenerFlota } from '@/lib/flota';
import { TIPOS_MENU } from '@/lib/landings';
import { SITIO } from '@/lib/sitio';

export const revalidate = 2592000;

export const metadata: Metadata = {
  title: 'Maquinaria en arriendo: flota y valores · JURMAQ',
  description: 'Flota de JURMAQ en la Región del Maule: valores referenciales por hora, día, semana o mes.',
  alternates: { canonical: `${SITIO.url}/maquinarias` },
};

export default async function Catalogo() {
  const flota = await obtenerFlota();
  return (
    <>
      <div className="bg-negro text-white">
        <div className="mx-auto max-w-[1320px] px-4 py-10 md:px-8 md:py-16">
          <Migas items={[{ nombre: 'Máquinas' }]} />
          <h1 className="grande mt-4">Maquinaria en arriendo</h1>
          <ul className="mt-8 flex flex-wrap gap-2">
            {TIPOS_MENU.map((t) => <li key={t.slug}><Link href={`/arriendo/${t.slug}`} prefetch={false} className="chip presionable border-white/25 text-white/90 hover:border-white hover:text-white">{t.nombrePlural}</Link></li>)}
          </ul>
        </div>
      </div>
      <div className="mx-auto max-w-[1320px] py-8 md:px-8 md:py-16">
        <h2 className="sr-only">Equipos disponibles</h2>
        <MosaicoFlota flota={flota} />
        <p className="mt-8 px-4 pb-8 text-sm text-ink-muted md:px-0">Valores referenciales y netos. El traslado se cotiza aparte.</p>
      </div>
      <BarraMovil cotizar="/cotizar-arriendo" texto="Hola, quiero cotizar el arriendo de una máquina." />
    </>
  );
}
