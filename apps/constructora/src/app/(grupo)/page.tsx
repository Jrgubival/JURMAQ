import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { CONTACTO_GRUPO, NEGOCIOS, type Negocio } from '@jurmaq/shared/ui/grupo';

const TITULO = 'Grupo JURMAQ · Arriendo de maquinaria, barraca y constructora en el Maule';
const DESCRIPCION =
  'Arriendo de maquinaria, barraca de fierros y constructora en la Región del Maule, desde 2000. Elige el negocio que necesitas.';

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: 'https://jurmaq.cl' },
  openGraph: { title: TITULO, description: DESCRIPCION, url: 'https://jurmaq.cl', siteName: 'Grupo JURMAQ', locale: 'es_CL', type: 'website' },
};

const ENTRADAS: {
  negocio: Negocio;
  texto: string;
  ir: string;
  foto: string;
  alt: string;
  nota?: string;
}[] = [
  {
    negocio: 'arriendo',
    texto: 'Retroexcavadoras, miniexcavadoras, minicargadores, camión tolva, brazo articulado y plataformas.',
    ir: 'Ver maquinaria',
    foto: '/images/maquinarias/retroexcavadora-hmk-102b.jpg',
    alt: 'Retroexcavadora en un patio de faena',
    nota: 'Imagen referencial',
  },
  {
    negocio: 'barraca',
    texto: 'Fierros, perfiles, planchas y materiales de construcción. Tienda en línea y local en Molina.',
    ir: 'Ir a la tienda',
    foto: '/images/grupo/barraca-fierros.jpg',
    alt: 'Estantes con perfiles y tubos de fierro en la barraca',
  },
  {
    negocio: 'constructora',
    texto: 'Obras civiles e industriales en la Región del Maule.',
    ir: 'Ver obras',
    foto: '/images/proyectos/nestle-teno-fundaciones-silos/hero.jpg',
    alt: 'Enfierradura de fundación para silos en la planta Nestlé de Teno',
  },
];

export default function InicioGrupo() {
  return (
    <>
      <section className="h-intro">
        <h1 className="h-titular">Arriendo de maquinaria, barraca y construcción en el Maule</h1>
        <p>Tres negocios JURMAQ, desde 2000. Entra al que necesitas.</p>
      </section>

      <ul className="h-entradas">
        {ENTRADAS.map((e, i) => (
          <li key={e.negocio} data-marca={e.negocio}>
            <a className="h-entrada" href={NEGOCIOS[e.negocio].url}>
              <div className="h-entrada__foto">
                <Image
                  src={e.foto}
                  alt={e.alt}
                  width={1100}
                  height={825}
                  sizes="(min-width: 900px) 34vw, 100vw"
                  priority={i === 0}
                />
                {e.nota && <span className="h-entrada__nota">{e.nota}</span>}
              </div>
              <div className="h-entrada__texto">
                <h2>{NEGOCIOS[e.negocio].nombre}</h2>
                <p>{e.texto}</p>
                <span className="h-entrada__ir">{e.ir}</span>
              </div>
            </a>
          </li>
        ))}
      </ul>

      <section className="h-cierre">
        <p>
          ¿No sabes por dónde partir? Escríbenos a{' '}
          <a className="g-enlace" href={`mailto:${CONTACTO_GRUPO}`}>{CONTACTO_GRUPO}</a>{' '}
          o usa el <Link className="g-enlace" href="/contacto">formulario de contacto</Link>.
        </p>
      </section>
    </>
  );
}
