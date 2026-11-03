import type { Metadata } from 'next';
import { CONTACTO_GRUPO, NEGOCIOS, type Negocio } from '@jurmaq/shared/ui/grupo';
import FormularioContacto from './FormularioContacto';

const TITULO = 'Contacto · Grupo JURMAQ';
const DESCRIPCION = 'Escríbenos a contacto@jurmaq.cl o llama directo al negocio que necesitas.';

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: 'https://jurmaq.cl/contacto' },
  openGraph: { title: TITULO, description: DESCRIPCION, url: 'https://jurmaq.cl/contacto', siteName: 'Grupo JURMAQ', locale: 'es_CL', type: 'website' },
};

export default function Contacto() {
  return (
    <article className="h-pagina">
      <h1 className="h-titular">Contacto</h1>
      <p className="h-entradilla">
        Escríbenos a <a className="g-enlace" href={`mailto:${CONTACTO_GRUPO}`}>{CONTACTO_GRUPO}</a>{' '}
        o llama directo al negocio que necesitas.
      </p>

      <section className="h-seccion">
        <dl className="h-datos">
          {(Object.keys(NEGOCIOS) as Negocio[]).map((clave) => (
            <div key={clave} style={{ display: 'contents' }}>
              <dt>{NEGOCIOS[clave].nombre}</dt>
              <dd>
                <a className="g-enlace" href={`tel:${NEGOCIOS[clave].telefono}`}>
                  {NEGOCIOS[clave].telefonoDisplay}
                </a>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="h-seccion">
        <h2>Déjanos tu mensaje</h2>
        <FormularioContacto />
      </section>
    </article>
  );
}
