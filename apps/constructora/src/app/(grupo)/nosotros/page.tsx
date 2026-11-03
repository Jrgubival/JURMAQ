import type { Metadata } from 'next';
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

const TEXTOS: Record<Negocio, string> = {
  arriendo: 'Maquinaria para obra, faena y trabajos en altura en la Región del Maule.',
  barraca: 'Fierros, perfiles, planchas y materiales de construcción, en local y tienda en línea.',
  constructora: 'Obras civiles e industriales en la Región del Maule.',
};

export default function Nosotros() {
  return (
    <article className="h-pagina">
      <h1 className="h-titular">Quiénes somos</h1>
      <p className="h-entradilla">
        JURMAQ trabaja en la Región del Maule desde 2000. Hoy son tres negocios, cada uno con
        su sitio y sus datos legales.
      </p>

      {(Object.keys(NEGOCIOS) as Negocio[]).map((clave) => {
        const n = NEGOCIOS[clave];
        return (
          <section className="h-seccion" key={clave} data-marca={clave}>
            <h2>{n.nombre}</h2>
            <p>{TEXTOS[clave]}</p>
            <dl className="h-datos">
              <dt>Razón social</dt>
              <dd>{n.razonSocial}</dd>
              <dt>RUT</dt>
              <dd>{n.rut}</dd>
              <dt>Dirección</dt>
              <dd>{n.direccion}</dd>
            </dl>
            <a className="g-enlace" href={n.url}>{n.url.replace('https://', '')}</a>
          </section>
        );
      })}
    </article>
  );
}
