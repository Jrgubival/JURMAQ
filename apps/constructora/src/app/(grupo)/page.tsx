import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import HeroPortada, { type Lamina } from './HeroPortada';
import MovimientoPortada from './MovimientoPortada';
import { CONTACTO_GRUPO, MarcaGrupo, NEGOCIOS, type Negocio } from '@jurmaq/shared/ui/grupo';

const TITULO = 'Grupo JURMAQ: arriendo, barraca y constructora en el Maule';
const DESCRIPCION =
  'Arriendo de maquinaria, barraca de fierros y constructora en la Región del Maule, desde 2000. Entra al negocio que necesitas o llama directo.';

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: 'https://jurmaq.cl' },
  openGraph: { title: TITULO, description: DESCRIPCION, url: 'https://jurmaq.cl', siteName: 'Grupo JURMAQ', locale: 'es_CL', type: 'website', images: [{ url: '/og-image-1200x630.jpg', width: 1200, height: 630 }] },
};

const EMPRESAS: {
  negocio: Negocio;
  nombre: string;
  texto: string;
  ir: string;
  foto: string;
  alt: string;
}[] = [
  {
    negocio: 'barraca',
    nombre: 'Barraca',
    texto: 'Fierro, perfiles, planchas y materiales. Local en Molina y tienda en línea.',
    ir: 'Ir a la tienda',
    foto: '/images/grupo/barraca-fierros.webp',
    alt: 'Estantes con perfiles y tubos de fierro en la barraca',
  },
  {
    negocio: 'arriendo',
    nombre: 'Arriendo',
    texto: 'Retroexcavadoras, minicargadores, camión tolva, brazo articulado y plataformas.',
    ir: 'Ver maquinaria',
    foto: '/images/grupo/arriendo-excavacion.webp',
    alt: 'Retroexcavadora HMK 102B del arriendo JURMAQ',
  },
  {
    negocio: 'constructora',
    nombre: 'Constructora',
    texto: 'Obras civiles e industriales en la Región del Maule.',
    ir: 'Ver obras',
    foto: '/images/grupo/constructora-fachada.webp',
    alt: 'Brazo articulado en el revestimiento de una bodega industrial',
  },
];

/* Una foto real por negocio. La primera es la imagen LCP (prioridad alta). */
const LAMINAS: Lamina[] = [
  {
    marca: 'constructora',
    negocio: 'JURMAQ Constructora',
    foto: '/images/grupo/hero-constructora',
  },
  {
    marca: 'barraca',
    negocio: 'JURMAQ Barraca',
    foto: '/images/grupo/hero-barraca',
  },
  {
    marca: 'arriendo',
    negocio: 'JURMAQ Arriendo',
    foto: '/images/grupo/hero-arriendo',
  },
];

const TELEFONOS: { negocio: Negocio; nombre: string }[] = [
  { negocio: 'barraca', nombre: 'Barraca' },
  { negocio: 'arriendo', nombre: 'Arriendo' },
  { negocio: 'constructora', nombre: 'Constructora' },
];

export default function InicioGrupo() {
  return (
    <>
      <HeroPortada
        laminas={LAMINAS}
        encabezado={
          <>
            <h1 className="g-display">Maquinaria, fierro y obra en el Maule</h1>
            <p className="h-portada__baja">Tres negocios JURMAQ, desde 2000.</p>
          </>
        }
      >
          <ul className="h-empresas" id="empresas">
            {EMPRESAS.map((e) => (
              <li key={e.negocio} data-marca={e.negocio}>
                <a className="h-empresa h-tarjeta" href={NEGOCIOS[e.negocio].url}>
                  <div className="h-empresa__foto">
                    <Image src={e.foto} alt={e.alt} width={800} height={600} sizes="(min-width: 1200px) 384px, (min-width: 768px) 32vw, 100vw" loading="eager" />
                  </div>
                  <div className="h-empresa__panel">
                    <h2 className="h-empresa__nombre"><MarcaGrupo negocio={e.nombre} soloTexto /></h2>
                    <p className="h-empresa__detalle">{e.texto}</p>
                    <div className="h-empresa__pie">
                      <span className="h-empresa__ir">{e.ir}<span className="h-flecha" aria-hidden="true">→</span></span>
                    </div>
                  </div>
                </a>
              </li>
            ))}
          </ul>
      </HeroPortada>

      <MovimientoPortada />

      <section className="h-grupo">
        <div className="h-grupo__texto">
          <h2 className="g-display">En el Maule desde 2000</h2>
          <p>
            Vendemos fierro en Molina, arrendamos maquinaria y construimos obras civiles e
            industriales en toda la región.
          </p>
          <Link className="g-enlace h-mas" href="/nosotros">Conoce JURMAQ<span className="h-flecha" aria-hidden="true">→</span></Link>
        </div>
        <div className="h-grupo__foto">
          <Image src="/images/grupo/barraca-frontal.webp" alt="Frente del local JURMAQ en Av. Poniente 2157, Molina" width={1100} height={825} sizes="(min-width: 900px) 55vw, 100vw" />
        </div>
      </section>

      <section className="h-llamar" data-tema="marino">
        <div className="h-llamar__ancho">
          <h2 className="g-display">Llama directo al negocio</h2>
          <p>
            ¿No sabes a cuál? Escribe a{' '}
            <a className="g-enlace" href={`mailto:${CONTACTO_GRUPO}`}>{CONTACTO_GRUPO}</a>.
          </p>
          <ul className="h-llamar__botones">
            {TELEFONOS.map((t) => (
              <li key={t.negocio} data-marca={t.negocio}>
                <a className="h-llamar__boton" href={`tel:${NEGOCIOS[t.negocio].telefono}`}>
                  <span>{t.nombre}</span>
                  <span>{NEGOCIOS[t.negocio].telefonoDisplay}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
