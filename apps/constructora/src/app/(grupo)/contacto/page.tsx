import type { Metadata } from 'next';
import { CONTACTO_GRUPO, NEGOCIOS, type Negocio } from '@jurmaq/shared/ui/grupo';
import FormularioContacto from './FormularioContacto';

const TITULO = 'Contacto · Grupo JURMAQ';
const DESCRIPCION = 'Escríbenos a contacto@jurmaq.cl o llama directo al negocio que necesitas.';

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: 'https://jurmaq.cl/contacto' },
  openGraph: { title: TITULO, description: DESCRIPCION, url: 'https://jurmaq.cl/contacto', siteName: 'Grupo JURMAQ', locale: 'es_CL', type: 'website', images: [{ url: '/og-image-1200x630.jpg', width: 1200, height: 630 }] },
};

export default function Contacto() {
  return (
    <>
      <section className="h-banda" data-tema="marino">
        <div className="h-banda__texto">
          <h1 className="g-display">Contacto</h1>
          <p>
            Escríbenos a <a className="g-enlace" href={`mailto:${CONTACTO_GRUPO}`}>{CONTACTO_GRUPO}</a>{' '}
            o llama directo al negocio que necesitas.
          </p>
        </div>
      </section>

      <div className="h-contacto">
        <section className="h-contacto__form h-tarjeta">
          <h2>Déjanos tu mensaje</h2>
          <FormularioContacto />
        </section>
        <section className="h-contacto__lado" aria-labelledby="telefonos">
          <h2 id="telefonos">Llama directo</h2>
          <ul className="h-telefonos">
            {(Object.keys(NEGOCIOS) as Negocio[]).map((clave) => (
              <li key={clave} className="h-tarjeta" data-marca={clave}>
                <p>{NEGOCIOS[clave].nombre}</p>
                <a href={`tel:${NEGOCIOS[clave].telefono}`}>{NEGOCIOS[clave].telefonoDisplay}</a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
