import type { ComponentProps, ElementType, ReactNode } from 'react';
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

export type EnlaceGrupo = { href: string; texto: string };

/**
 * Cabecera común: los mismos valores de barraca.jurmaq.cl. Sólo cambian los datos
 * y el color del negocio (data-marca en un contenedor superior). `actual` marca la
 * página abierta; `Enlace` permite pasar next/link. En celular usa <details>, así
 * funciona sin JavaScript.
 */
export function CabeceraGrupo({
  negocio,
  enlaces,
  actual,
  inicio = '/',
  Enlace = 'a',
  children,
}: {
  negocio?: string;
  enlaces: EnlaceGrupo[];
  actual?: string;
  inicio?: string;
  Enlace?: ElementType;
  children?: ReactNode;
}) {
  return (
    <header className="g-cab" role="banner">
      <div className="g-cab__fila">
        <MarcaGrupo href={inicio} negocio={negocio} />
        <nav className="g-cab__nav" aria-label="Principal">
          {enlaces.map((e) => (
            <Enlace key={e.href} className="g-cab__enlace" href={e.href} aria-current={actual === e.href ? 'page' : undefined}>
              {e.texto}
            </Enlace>
          ))}
          {children}
        </nav>
        <details className="g-cab__menu">
          <summary aria-label="Abrir menú">
            <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </summary>
          <nav className="g-cab__panel" aria-label="Menú">
            {enlaces.map((e) => (
              <Enlace key={e.href} href={e.href} aria-current={actual === e.href ? 'page' : undefined}>
                {e.texto}
              </Enlace>
            ))}
            {children}
          </nav>
        </details>
      </div>
    </header>
  );
}

/**
 * Pie común, claro como el de barraca.jurmaq.cl: marca con texto y contacto, tres
 * columnas y barra legal. Cada sitio pasa sus datos; `legal` lleva la razón social y
 * el RUT que correspondan a ese sitio, sin mezclar sociedades.
 */
export function PieGrupo({
  negocio,
  texto,
  telefono,
  telefonoDisplay,
  correo,
  direccion,
  horario,
  columnas,
  legal,
  enlacesLegales,
  inicio = '/',
  Enlace = 'a',
}: {
  negocio?: string;
  texto: string;
  telefono?: string;
  telefonoDisplay?: string;
  correo?: string;
  direccion?: string;
  horario?: string[];
  columnas: { titulo: string; enlaces: EnlaceGrupo[] }[];
  legal: string[];
  enlacesLegales: EnlaceGrupo[];
  inicio?: string;
  Enlace?: ElementType;
}) {
  return (
    <footer className="g-piec" role="contentinfo">
      <div className="g-piec__ancho">
        <div className="g-piec__grilla">
          <div>
            <MarcaGrupo href={inicio} negocio={negocio} />
            <p className="g-piec__texto">{texto}</p>
            <div className="g-piec__contacto">
              {telefono && <a className="g-piec__fuerte" href={`tel:${telefono}`}>{telefonoDisplay}</a>}
              {correo && <a className="g-piec__fuerte" href={`mailto:${correo}`}>{correo}</a>}
              {direccion && <p>{direccion}</p>}
              {horario && <div className="g-piec__chico">{horario.map((h) => <p key={h}>{h}</p>)}</div>}
            </div>
          </div>
          {columnas.map((c) => (
            <nav key={c.titulo} aria-label={c.titulo}>
              <h3>{c.titulo}</h3>
              <ul>
                {c.enlaces.map((e) => (
                  <li key={e.href}>
                    <Enlace className="g-piec__enlace" href={e.href}>{e.texto}</Enlace>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="g-piec__barra">
        <div className="g-piec__legal">
          <div>{legal.map((l) => <p key={l}>{l}</p>)}</div>
          <div className="g-piec__legales">
            {enlacesLegales.map((e) => <Enlace key={e.href} href={e.href}>{e.texto}</Enlace>)}
          </div>
        </div>
      </div>
    </footer>
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
