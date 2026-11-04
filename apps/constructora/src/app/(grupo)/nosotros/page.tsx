import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

const TITULO = 'Quiénes somos · Grupo JURMAQ';
const DESCRIPCION =
  'JURMAQ trabaja en la Región del Maule desde 2000. Partimos prestando servicios y hoy somos constructora, barraca de fierros y arriendo de maquinaria.';

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: 'https://jurmaq.cl/nosotros' },
  openGraph: { title: TITULO, description: DESCRIPCION, url: 'https://jurmaq.cl/nosotros', siteName: 'Grupo JURMAQ', locale: 'es_CL', type: 'website', images: [{ url: '/og-image-1200x630.jpg', width: 1200, height: 630 }] },
};

/* Historia contada por Jorge. Sólo el inicio lleva año; el resto va en
   orden y sin fechas, porque no las tenemos confirmadas. */
const HISTORIA: { cuando: string; titulo: string; texto: string; marca?: string }[] = [
  { cuando: 'Desde 2000', titulo: 'Prestación de servicios', texto: 'Empezamos prestando servicios en la Región del Maule.' },
  { cuando: 'Luego', titulo: 'Nace la constructora', texto: 'Obras civiles, industriales y metalmecánicas, dentro de plantas en operación.', marca: 'constructora' },
  { cuando: 'Años después', titulo: 'Barraca de Fierros', texto: 'Local en Av. Poniente 2157, Molina, y hoy también tienda en línea.', marca: 'barraca' },
  { cuando: 'Recientemente', titulo: 'Arriendo de maquinaria', texto: 'Retroexcavadoras, minicargadores, camión tolva y equipos de altura desde Maquehua, Curicó.', marca: 'arriendo' },
];

const DATOS: { valor: string; texto: string }[] = [
  { valor: '2000', texto: 'el año en que partimos en el Maule' },
  { valor: '3', texto: 'negocios que se complementan: material, maquinaria y obra' },
  { valor: '13', texto: 'zonas con despacho propio de la barraca, gratis en Molina' },
  { valor: 'Maule y O’Higgins', texto: 'regiones donde la constructora trabaja en plantas' },
];

export default function Nosotros() {
  return (
    <>
      <section className="h-banda" data-tema="marino">
        <div className="h-banda__texto">
          <h1 className="g-display">Quiénes somos</h1>
          <p>
            JURMAQ trabaja en la Región del Maule desde 2000. Partimos prestando servicios y hoy
            somos tres negocios: material, maquinaria y obra.
          </p>
        </div>
      </section>

      <section className="h-historia" aria-labelledby="historia">
        <div className="h-historia__texto">
          <h2 id="historia" className="h-titulo">Cómo crecimos</h2>
          <ol className="h-linea">
            {HISTORIA.map((h) => (
              <li key={h.titulo} data-marca={h.marca}>
                <p className="h-linea__cuando">{h.cuando}</p>
                <h3>{h.titulo}</h3>
                <p>{h.texto}</p>
              </li>
            ))}
          </ol>
        </div>
        <div className="h-historia__foto">
          <Image src="/images/grupo/barraca-frontal.webp" alt="Frente del local JURMAQ en Av. Poniente 2157, Molina" fill sizes="(min-width: 900px) 520px, 100vw" />
        </div>
      </section>

      <section className="h-datos-seccion" aria-labelledby="datos">
        <h2 id="datos" className="h-titulo">JURMAQ en datos</h2>
        <ul className="h-datos">
          {DATOS.map((d) => (
            <li key={d.valor} className="h-dato h-tarjeta">
              <p className="h-dato__valor">{d.valor}</p>
              <p className="h-dato__texto">{d.texto}</p>
            </li>
          ))}
          <li className="h-dato h-dato--ancho h-tarjeta">
            <p className="h-dato__etiqueta">Clientes industriales de la constructora</p>
            <p className="h-dato__clientes">Nestlé, Miguel Torres, Cementos Biobío, Iansagro y Surfrut</p>
          </li>
        </ul>
      </section>

      <section className="h-donde" aria-label="Dónde estamos y a quién atendemos">
        <div>
          <h2 className="h-subtitulo">Dónde estamos</h2>
          <p>La barraca está en Av. Poniente 2157, Molina. El arriendo y la constructora tienen su base en Maquehua, Curicó.</p>
        </div>
        <div>
          <h2 className="h-subtitulo">A quién atendemos</h2>
          <p>Plantas agroindustriales y alimenticias, obras civiles, faenas agrícolas e industriales, y a quien compra fierro y materiales en Molina o en línea.</p>
        </div>
        <div className="h-donde__cta">
          <Link className="g-enlace h-mas" href="/empresas">Ver las tres empresas<span className="h-flecha" aria-hidden="true">→</span></Link>
        </div>
      </section>
    </>
  );
}
