import type { Metadata } from 'next';
import Image from 'next/image';
import { MarcaGrupo, NEGOCIOS, type Negocio } from '@jurmaq/shared/ui/grupo';

const TITULO = 'Empresas · Grupo JURMAQ';
const DESCRIPCION =
  'Barraca de fierros en Molina, arriendo de maquinaria desde Maquehua y constructora para plantas industriales del Maule y O’Higgins.';

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: 'https://jurmaq.cl/empresas' },
  openGraph: { title: TITULO, description: DESCRIPCION, url: 'https://jurmaq.cl/empresas', siteName: 'Grupo JURMAQ', locale: 'es_CL', type: 'website', images: [{ url: '/og-image-1200x630.jpg', width: 1200, height: 630 }] },
};

/* Sólo datos publicados en barraca.jurmaq.cl, rental.jurmaq.cl,
   constructora.jurmaq.cl y el brochure. Si un dato no está ahí, no va. */
const EMPRESAS: {
  negocio: Negocio;
  nombre: string;
  bajada: string;
  datos: string[];
  ir: string;
  foto: string;
  alt: string;
}[] = [
  {
    negocio: 'barraca',
    nombre: 'Barraca',
    bajada: 'Fierro, perfiles, planchas, techumbre y herramientas, en el local de Molina y en la tienda en línea.',
    datos: [
      'Local en Av. Poniente 2157, Molina. Retiro gratis.',
      'Despacho propio a 13 zonas del Maule, gratis en Molina.',
      'Tarjeta de crédito hasta 3 cuotas sin interés, débito o transferencia.',
      'Lunes a viernes de 8:30 a 13:00 y de 14:30 a 18:00. Sábado de 9:00 a 13:00.',
    ],
    ir: 'Ir a la tienda',
    foto: '/images/grupo/barraca-fierros.webp',
    alt: 'Estantes con perfiles y tubos de fierro en la barraca',
  },
  {
    negocio: 'arriendo',
    nombre: 'Arriendo',
    bajada: 'Maquinaria para obras civiles, faenas agrícolas e industriales en la Región del Maule.',
    datos: [
      'Retroexcavadora, miniexcavadora, minicargador, camión tolva, brazo articulado y plataformas.',
      'Base en Maquehua, Curicó.',
      'Por hora o por día, según la máquina.',
      'Traslado cotizado aparte, según el equipo y la comuna de la obra.',
    ],
    ir: 'Ver maquinaria',
    foto: '/images/grupo/arriendo-excavacion.webp',
    alt: 'Retroexcavadora HMK 102B del arriendo JURMAQ',
  },
  {
    negocio: 'constructora',
    nombre: 'Constructora',
    bajada: 'Obras industriales, civiles y metalmecánicas para el sector agroindustrial, alimenticio y productivo.',
    datos: [
      'Trabajos dentro de plantas en operación, en el Maule y O’Higgins.',
      'Equipo con prevencionista de riesgos, supervisores y administrador de obra.',
      'Base en Maquehua, Curicó, con maestranza propia.',
      'Clientes: Nestlé, Miguel Torres, Cementos Biobío, Iansagro y Surfrut.',
    ],
    ir: 'Ver obras',
    foto: '/images/grupo/constructora-fachada.webp',
    alt: 'Brazo articulado en el revestimiento de una bodega industrial',
  },
];

export default function Empresas() {
  return (
    <>
      <section className="h-banda" data-tema="marino">
        <div className="h-banda__texto">
          <h1 className="g-display">Tres empresas, un mismo grupo</h1>
          <p>Material, maquinaria y obra en la Región del Maule. Cada una con su sitio y su teléfono.</p>
        </div>
      </section>

      <div className="h-negocios">
        {EMPRESAS.map((e) => {
          const n = NEGOCIOS[e.negocio];
          return (
            <section key={e.negocio} className="h-negocio h-tarjeta" data-marca={e.negocio} aria-labelledby={`n-${e.negocio}`}>
              <div className="h-negocio__foto">
                <Image src={e.foto} alt={e.alt} fill sizes="(min-width: 900px) 520px, 100vw" />
              </div>
              <div className="h-negocio__texto">
                <h2 id={`n-${e.negocio}`} className="h-empresa__nombre"><MarcaGrupo negocio={e.nombre} soloTexto /></h2>
                <p className="h-negocio__bajada">{e.bajada}</p>
                <ul className="h-negocio__datos">
                  {e.datos.map((d) => <li key={d}>{d}</li>)}
                </ul>
                <div className="h-negocio__acciones">
                  <a className="g-boton" href={n.url}>{e.ir}<span className="h-flecha" aria-hidden="true">→</span></a>
                  <a className="g-boton g-boton--linea" href={`tel:${n.telefono}`}>{n.telefonoDisplay}</a>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
