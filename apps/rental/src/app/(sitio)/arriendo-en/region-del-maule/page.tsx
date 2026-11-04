import type { Metadata } from 'next';
import Link from 'next/link';
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';
import { BarraMovil } from '@/components/AccionesContacto';
import PortadaLanding from '@/components/PortadaLanding';
import { MosaicoFlota } from '@/components/TarjetaMaquina';
import { COMUNAS } from '@/data/comunas';
import { obtenerFlota } from '@/lib/flota';
import { jsonLdServicio } from '@/lib/jsonld';
import { distanciaDesdeBase } from '@/lib/landings';
import { SITIO } from '@/lib/sitio';

export const revalidate = 2592000;

const url = `${SITIO.url}/arriendo-en/region-del-maule`;
const descripcion = 'Arriendo de maquinaria en toda la Región del Maule, con base en Maquehua, Curicó. Retroexcavadora, miniexcavadora, minicargador, camión tolva y plataformas.';

export const metadata: Metadata = {
  title: 'Arriendo de Maquinaria en la Región del Maule · JURMAQ',
  description: descripcion,
  alternates: { canonical: url },
};

export default async function RegionMaule() {
  const flota = await obtenerFlota();
  const texto = 'Hola, quiero cotizar el arriendo de una máquina en la Región del Maule.';
  return (
    <div className="sobre-claro">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLdServicio('Arriendo de maquinaria en la Región del Maule', descripcion, url, SITIO.region)) }} />
      <PortadaLanding migas={[{ nombre: 'Región del Maule' }]} titulo="Arriendo de maquinaria en la Región del Maule" bajada="Arrendamos desde nuestra base en Maquehua, Curicó. El traslado se cotiza aparte según la comuna de la obra." foto={flota.find((m) => m.tipo === 'camion') ?? flota[0]} cotizar="/cotizar-arriendo" texto={texto} />
      <section className="bg-negro pb-14 text-white">
        <ul className="mx-auto grid max-w-[1320px] grid-cols-1 gap-px bg-white/15 sm:grid-cols-2 md:grid-cols-3">
          {COMUNAS.map((c) => (
            <li key={c.slug} className="bg-negro">
              <Link href={`/arriendo-en/${c.slug}`} prefetch={false} className="comuna presionable block h-full p-5">
                <span className="flex items-baseline justify-between gap-3 font-titulo text-3xl font-semibold uppercase">{c.nombre}<span className="font-cifra text-sm font-normal normal-case text-white/60">{distanciaDesdeBase(c.slug)?.km} km</span></span>
                <span className="mt-2 block text-[0.9375rem] text-white/70">{c.trabajos[0]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="mx-auto max-w-[1320px] py-14 md:px-8 md:py-20">
        <h2 className="medio mb-6 px-4 md:px-0">Flota</h2>
        <MosaicoFlota flota={flota} />
      </section>
      <BarraMovil cotizar="/cotizar-arriendo" texto={texto} />
    </div>
  );
}
