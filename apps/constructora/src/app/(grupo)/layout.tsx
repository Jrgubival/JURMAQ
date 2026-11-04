import Link from 'next/link';
import '@jurmaq/shared/styles/grupo.css';
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';
import { CONTACTO_GRUPO, MarcaGrupo, NEGOCIOS, type Negocio } from '@jurmaq/shared/ui/grupo';
import { grafoGrupo } from '@/lib/grupo-jsonld';
import NavGrupo from './NavGrupo';
import './hub.css';

const ORDEN: Negocio[] = ['barraca', 'arriendo', 'constructora'];
const NOMBRES: Record<Negocio, string> = {
  barraca: 'Barraca',
  arriendo: 'Arriendo',
  constructora: 'Constructora',
};

/**
 * Hub del Grupo JURMAQ en jurmaq.cl: portada, Nosotros y Contacto. Es un route
 * group: `(grupo)` no aparece en la URL. El arriendo vive en rental.jurmaq.cl,
 * así que estas páginas no llevan el Navbar de `(hub)`.
 */
export default function GrupoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-raiz" data-marca="hub">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(grafoGrupo()) }}
      />
      <header className="h-cabecera" data-tema="marino">
        <div className="h-cabecera__fila">
          <MarcaGrupo />
          <NavGrupo />
        </div>
      </header>
      <main className="h-main">{children}</main>
      <footer className="h-pie" data-tema="marino">
        <div className="h-pie__ancho">
          <div className="h-pie__columnas">
            <div className="h-pie__marca"><MarcaGrupo /></div>
            <nav aria-label="Empresas">
              <h2>Empresas</h2>
              <ul>
                {ORDEN.map((n) => (
                  <li key={n}><a href={NEGOCIOS[n].url}>{NOMBRES[n]}</a></li>
                ))}
              </ul>
            </nav>
            <nav aria-label="El grupo">
              <h2>El grupo</h2>
              <ul>
                <li><Link href="/nosotros">Nosotros</Link></li>
                <li><Link href="/contacto">Contacto</Link></li>
              </ul>
            </nav>
            <nav aria-label="Accesos">
              <h2>Accesos</h2>
              <ul>
                <li><a href={`mailto:${CONTACTO_GRUPO}`}>{CONTACTO_GRUPO}</a></li>
                <li><Link href="/privacidad">Privacidad</Link></li>
                <li><Link href="/terminos">Términos</Link></li>
              </ul>
            </nav>
          </div>
          <ul className="h-pie__legal">
            {ORDEN.map((n) => (
              <li key={n}>
                {NOMBRES[n]}: {NEGOCIOS[n].razonSocial}, RUT {NEGOCIOS[n].rut}, {NEGOCIOS[n].direccion}
              </li>
            ))}
          </ul>
        </div>
      </footer>
    </div>
  );
}
