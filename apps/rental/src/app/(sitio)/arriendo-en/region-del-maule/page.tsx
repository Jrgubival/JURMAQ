import type { Metadata } from 'next';
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';
import { BarraMovil } from '@/components/AccionesContacto';
import PortadaLanding from '@/components/PortadaLanding';
import { MosaicoFlota } from '@/components/TarjetaMaquina';
import TarjetasComunas from '@/components/TarjetasComunas';
import { obtenerFlota } from '@/lib/flota';
import { jsonLdServicio } from '@/lib/jsonld';
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
      <section className="bg-[#f4f5f7]">
        <div className="mx-auto max-w-[1320px] px-4 py-12 md:px-8 md:py-20">
          <h2 className="medio">Comunas que atendemos</h2>
          <p className="mt-4 max-w-[52ch] text-lg text-ink-soft">Distancias desde nuestra base en Maquehua, Curicó.</p>
          <div className="mt-12"><TarjetasComunas /></div>
        </div>
      </section>
      <section className="mx-auto max-w-[1320px] py-12 md:px-8 md:py-20">
        <h2 className="medio mb-8 px-4 md:px-0">Flota</h2>
        <MosaicoFlota flota={flota} />
      </section>
      <BarraMovil cotizar="/cotizar-arriendo" texto={texto} />
    </div>
  );
}
