import type { ComponentProps, ReactNode } from 'react';
import { CONTACTO_GRUPO, NEGOCIOS, URL_HUB, type Marca, type Negocio } from './negocios';

export { CONTACTO_GRUPO, NEGOCIOS, URL_HUB };
export type { Marca, Negocio };

/*
 * Componentes de la línea del grupo. Usan las clases de styles/grupo.css y
 * <a> normales, porque casi todos los enlaces cruzan de un sitio a otro.
 * Son de servidor: no necesitan JavaScript en el navegador.
 */

/**
 * Logo de texto del grupo, igual al de barraca.jurmaq.cl: JURMAQ grande en
 * blanco y, al lado, el negocio más chico en su color. Con `href` es enlace; sin
 * él es texto (por ejemplo, dentro de una tarjeta que ya es un enlace).
 */
export function MarcaGrupo({ href = '/', negocio, soloTexto = false }: { href?: string; negocio?: string; soloTexto?: boolean }) {
  const contenido = (
    <>
      <span className="g-marca__grupo">JURMAQ</span>
      {negocio && <span className="g-marca__negocio">{negocio}</span>}
    </>
  );
  if (soloTexto) return <span className="g-marca">{contenido}</span>;
  return (
    <a className="g-marca" href={href}>
      {contenido}
    </a>
  );
}

export function Boton({
  variante = 'relleno',
  className = '',
  ...props
}: ComponentProps<'button'> & { variante?: 'relleno' | 'linea' }) {
  return <button className={clases(variante, className)} {...props} />;
}

export function BotonEnlace({
  variante = 'relleno',
  className = '',
  ...props
}: ComponentProps<'a'> & { variante?: 'relleno' | 'linea' }) {
  return <a className={clases(variante, className)} {...props} />;
}

function clases(variante: 'relleno' | 'linea', className: string) {
  return ['g-boton', variante === 'linea' && 'g-boton--linea', className].filter(Boolean).join(' ');
}

export function Campo({ id, etiqueta, children }: { id: string; etiqueta: string; children: ReactNode }) {
  return (
    <div className="g-campo">
      <label htmlFor={id}>{etiqueta}</label>
      {children}
    </div>
  );
}

const ORDEN_NEGOCIOS: Negocio[] = ['arriendo', 'barraca', 'constructora'];

/** Línea para pasar de un sitio a otro. La barraca no la usa todavía (Merchant Center). */
export function FranjaGrupo({ actual }: { actual: Marca }) {
  return (
    <nav className="g-franja" aria-label="Sitios del Grupo JURMAQ">
      <ul>
        <li>
          <a href={URL_HUB} aria-current={actual === 'hub' ? 'page' : undefined}>
            Grupo JURMAQ
          </a>
        </li>
        {ORDEN_NEGOCIOS.map((n) => (
          <li key={n}>
            <a href={NEGOCIOS[n].url} aria-current={actual === n ? 'page' : undefined}>
              {NEGOCIOS[n].nombre}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Pie con los datos legales. En un sitio de un negocio van sólo los suyos; en
 * el hub, los tres por separado, cada uno con su razón social y RUT.
 */
export function PieLegal({ marca, children }: { marca: Marca; children?: ReactNode }) {
  const negocios = marca === 'hub' ? ORDEN_NEGOCIOS : [marca];
  return (
    <footer className="g-pie" data-tema="oscuro">
      <div className="g-pie__ancho">
        <ul className="g-pie__negocios">
          {negocios.map((n) => {
            const d = NEGOCIOS[n];
            return (
              <li key={n}>
                <p className="g-pie__nombre">{d.nombre}</p>
                <p>{d.razonSocial}</p>
                <p>RUT {d.rut}</p>
                <p>{d.direccion}</p>
                <p>
                  <a href={`tel:${d.telefono}`}>{d.telefonoDisplay}</a>
                </p>
              </li>
            );
          })}
        </ul>
        <div className="g-pie__legal">
          <a href={`mailto:${CONTACTO_GRUPO}`}>{CONTACTO_GRUPO}</a>
          {children}
        </div>
      </div>
    </footer>
  );
}
