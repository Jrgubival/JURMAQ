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

const EMPRESAS: {
  negocio: Negocio;
  nombre: string;
  texto: string;
  ir: string;
  foto: string;
  alt: string;
  nota?: string;
}[] = [
  {
    negocio: 'barraca',
    nombre: 'Barraca',
    texto: 'Fierro, perfiles, planchas y materiales. Local en Molina y tienda en línea.',
    ir: 'Ir a la tienda',
    foto: '/images/grupo/barraca-fierros.jpg',
    alt: 'Estantes con perfiles y tubos de fierro en la barraca',
  },
  {
    negocio: 'arriendo',
    nombre: 'Arriendo',
    texto: 'Retroexcavadoras, minicargadores, camión tolva, brazo articulado y plataformas.',
    ir: 'Ver maquinaria',
    foto: '/images/grupo/arriendo-excavacion.webp',
    alt: 'Retroexcavadora excavando en una faena',
    nota: 'Imagen referencial',
  },
  {
    negocio: 'constructora',
    nombre: 'Constructora',
    texto: 'Obras civiles e industriales en la Región del Maule.',
    ir: 'Ver obras',
    foto: '/images/grupo/constructora-fachada.webp',
    alt: 'Brazo articulado y trabajadores en el revestimiento de una bodega industrial',
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
      <section className="h-portada" data-tema="marino">
        <div className="h-portada__fondo">
          <Image src="/images/grupo/silos-general.webp" alt="" fill sizes="100vw" priority />
        </div>
        <div className="h-portada__ancho">
          <h1 className="g-display">Maquinaria, fierro y obra en el Maule</h1>
          <p className="h-portada__baja">Tres negocios JURMAQ, desde 2000.</p>

          <ul className="h-empresas" id="empresas">
            {EMPRESAS.map((e) => (
              <li key={e.negocio} data-marca={e.negocio}>
                <a className="h-empresa" href={NEGOCIOS[e.negocio].url}>
                  <div className="h-empresa__foto">
                    <Image src={e.foto} alt={e.alt} width={800} height={600} sizes="(min-width: 768px) 34vw, 100vw" priority />
                  </div>
                  <div className="h-empresa__panel">
                    <span className="h-empresa__marca">JURMAQ</span>
                    <h2 className="h-empresa__nombre">{e.nombre}</h2>
                    <p className="h-empresa__detalle">{e.texto}</p>
                    <div className="h-empresa__pie">
                      <span className="h-empresa__ir">{e.ir}</span>
                      {e.nota && <span className="h-empresa__nota">{e.nota}</span>}
                    </div>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="h-grupo">
        <div>
          <h2 className="g-display">En el Maule desde 2000</h2>
          <p>
            Vendemos fierro en Molina, arrendamos maquinaria y construimos obras civiles e
            industriales en toda la región.
          </p>
          <Link className="g-enlace" href="/nosotros">Conoce JURMAQ</Link>
        </div>
        <div className="h-grupo__foto">
          <Image src="/images/grupo/barraca-frontal.jpg" alt="Frente del local JURMAQ en Av. Poniente 2157, Molina" width={1100} height={825} sizes="(min-width: 900px) 55vw, 100vw" />
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
