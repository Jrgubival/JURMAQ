import type { Metadata } from 'next';
import Link from 'next/link';
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';
import { AccionesContacto, BarraMovil } from '@/components/AccionesContacto';
import Migas from '@/components/Migas';
import TarjetaMaquina from '@/components/TarjetaMaquina';
import { obtenerFlota } from '@/lib/flota';
import { jsonLdServicio } from '@/lib/jsonld';
import { CIUDADES_RENTAL, COMUNAS_MAULE, TIPOS } from '@/lib/landings';
import { SITIO } from '@/lib/sitio';

export const revalidate = 2592000;

const url = `${SITIO.url}/arriendo-en/region-del-maule`;

export const metadata: Metadata = {
  title: 'Arriendo de Maquinaria en la Región del Maule · JURMAQ',
  description: 'Arriendo de maquinaria en toda la Región del Maule, con base en Maquehua, Curicó. Retroexcavadora, miniexcavadora, minicargador, camión tolva y plataformas.',
  alternates: { canonical: url },
};

export default async function RegionMaule() {
  const flota = await obtenerFlota();
  const texto = 'Hola, quiero cotizar el arriendo de una máquina en la Región del Maule.';
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLdServicio('Arriendo de maquinaria en la Región del Maule', metadata.description as string, url, SITIO.region)) }} />
      <Migas items={[{ nombre: 'Región del Maule' }]} />
      <h1 className="mt-4 text-4xl sm:text-5xl">Arriendo de maquinaria en la Región del Maule</h1>
      <p className="mt-4 max-w-3xl text-lg text-ink-soft">Arrendamos en toda la región desde nuestra base en Maquehua, Curicó. El traslado se cotiza aparte según la comuna de la obra.</p>
      <div className="mt-5 hidden md:block"><AccionesContacto cotizar="/cotizar-arriendo" texto={texto} /></div>

      <section className="mt-10">
        <h2 className="text-3xl">Comunas</h2>
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-ink-soft">
          {COMUNAS_MAULE.map((c) => {
            const pagina = CIUDADES_RENTAL.find((x) => x.nombre === c);
            return <li key={c}>{pagina ? <Link href={`/arriendo-en/${pagina.slug}`} prefetch={false} className="font-medium text-ink underline underline-offset-4">{c}</Link> : c}</li>;
          })}
        </ul>
        <p className="mt-3 text-ink-soft">¿Tu comuna no aparece? Escríbenos igual.</p>
      </section>

      <section className="mt-10">
        <h2 className="text-3xl">Flota</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{flota.map((m) => <TarjetaMaquina key={m.id} maquina={m} />)}</div>
      </section>

      <section className="mt-12">
        <h2 className="text-3xl">Por tipo de máquina</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {TIPOS.map((t) => <li key={t.slug}><Link href={`/arriendo/${t.slug}`} prefetch={false} className="boton boton-suave">{t.nombre}</Link></li>)}
        </ul>
      </section>
      <BarraMovil cotizar="/cotizar-arriendo" texto={texto} />
    </div>
  );
}
