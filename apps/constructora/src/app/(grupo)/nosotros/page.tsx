import type { Metadata } from 'next';
import Image from 'next/image';
import { NEGOCIOS, type Negocio } from '@jurmaq/shared/ui/grupo';

const TITULO = 'Quiénes somos · Grupo JURMAQ';
const DESCRIPCION =
  'JURMAQ trabaja en la Región del Maule desde 2000: arriendo de maquinaria, barraca de fierros y constructora.';

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: 'https://jurmaq.cl/nosotros' },
  openGraph: { title: TITULO, description: DESCRIPCION, url: 'https://jurmaq.cl/nosotros', siteName: 'Grupo JURMAQ', locale: 'es_CL', type: 'website' },
};

const FICHAS: { negocio: Negocio; titulo: string; texto: string; foto: string; alt: string; nota?: string }[] = [
  {
    negocio: 'arriendo',
    titulo: 'Arriendo',
    texto: 'Maquinaria para obra, faena y trabajos en altura en la Región del Maule.',
    foto: '/images/maquinarias/camion-tolva-vw-constellation.jpg',
    alt: 'Camión tolva Volkswagen Constellation',
    nota: 'Imagen referencial',
  },
  {
    negocio: 'barraca',
    titulo: 'Barraca',
    texto: 'Fierros, perfiles, planchas y materiales de construcción, en local y tienda en línea.',
    foto: '/images/grupo/barraca-frontal.jpg',
    alt: 'Frente del local de la barraca en Av. Poniente 2157, Molina',
  },
  {
    negocio: 'constructora',
    titulo: 'Constructora',
    texto: 'Obras civiles e industriales en la Región del Maule.',
    foto: '/images/proyectos/nestle-teno-fundaciones-silos/01-fundaciones.jpg',
    alt: 'Fundación de silos en construcción en la planta Nestlé de Teno',
  },
];

export default function Nosotros() {
  return (
    <>
      <section className="h-banda" data-tema="marino">
        <div className="h-banda__texto">
          <h1 className="g-display">Quiénes somos</h1>
          <p>
            JURMAQ trabaja en la Región del Maule desde 2000. Hoy son tres negocios, cada uno con
            su sitio y sus datos legales.
          </p>
        </div>
      </section>

      <div className="h-fichas">
        {FICHAS.map((f) => {
          const n = NEGOCIOS[f.negocio];
          return (
            <section className="h-ficha" key={f.negocio} data-marca={f.negocio}>
              <div>
                <div className="h-ficha__foto">
                  <Image src={f.foto} alt={f.alt} fill sizes="(min-width: 900px) 45vw, 100vw" />
                </div>
                {f.nota && <p className="h-ficha__nota">{f.nota}</p>}
              </div>
              <div>
                <h2><span>{f.titulo}</span></h2>
                <p>{f.texto}</p>
                <dl className="h-datos">
                  <dt>Razón social</dt>
                  <dd>{n.razonSocial}</dd>
                  <dt>RUT</dt>
                  <dd>{n.rut}</dd>
                  <dt>Dirección</dt>
                  <dd>{n.direccion}</dd>
                </dl>
                <a className="g-enlace" href={n.url}>{n.url.replace('https://', '')}</a>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
