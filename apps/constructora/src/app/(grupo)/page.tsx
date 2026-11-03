import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { NEGOCIOS, type Negocio } from '@jurmaq/shared/ui/grupo';

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
  nombre: string;
  texto: string;
  ir: string;
  foto: string;
  alt: string;
  nota?: string;
}[] = [
  {
    negocio: 'arriendo',
    nombre: 'Arriendo',
    texto: 'Retroexcavadoras, minicargadores, camión tolva, brazo articulado y plataformas.',
    ir: 'Ver maquinaria',
    foto: '/images/maquinarias/retroexcavadora-hmk-102b.jpg',
    alt: 'Retroexcavadora en un patio de faena',
    nota: 'Imagen referencial',
  },
  {
    negocio: 'barraca',
    nombre: 'Barraca',
    texto: 'Fierros, perfiles, planchas y materiales. Tienda en línea y local en Molina.',
    ir: 'Ir a la tienda',
    foto: '/images/grupo/barraca-fierros.jpg',
    alt: 'Estantes con perfiles y tubos de fierro en la barraca',
  },
  {
    negocio: 'constructora',
    nombre: 'Constructora',
    texto: 'Obras civiles e industriales en la Región del Maule.',
    ir: 'Ver obras',
    foto: '/images/proyectos/nestle-teno-fundaciones-silos/hero.jpg',
    alt: 'Enfierradura de fundación para silos en la planta Nestlé de Teno',
  },
];

export default function InicioGrupo() {
  return (
    <>
      <section className="h-portada g-textura-acero" data-tema="oscuro">
        <div className="h-portada__texto">
          <h1 className="g-display">Maquinaria, fierro y obra en el Maule</h1>
          <p>Tres negocios JURMAQ, desde 2000.</p>
        </div>

        <ul className="h-puertas">
          {ENTRADAS.map((e) => (
            <li key={e.negocio} data-marca={e.negocio}>
              <a className="h-puerta" href={NEGOCIOS[e.negocio].url}>
                <div className="h-puerta__foto">
                  <Image src={e.foto} alt={e.alt} fill sizes="(min-width: 900px) 50vw, 100vw" priority />
                </div>
                <div className="h-puerta__panel">
                  <h2 className="h-puerta__nombre">{e.nombre}</h2>
                  <p className="h-puerta__detalle">{e.texto}</p>
                  <div className="h-puerta__pie">
                    <span className="h-puerta__ir">
                      {e.ir}
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                        <path d="M3 10h13M11 5l5 5-5 5" />
                      </svg>
                    </span>
                    {e.nota && <span className="h-puerta__nota">{e.nota}</span>}
                  </div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="h-cierre g-textura-acero" data-tema="oscuro">
        <div className="h-cierre__fila">
          <h2 className="g-display">¿No sabes por dónde partir?</h2>
          <Link className="g-boton g-boton--grande" href="/contacto">Escríbenos</Link>
        </div>
      </section>
    </>
  );
}
