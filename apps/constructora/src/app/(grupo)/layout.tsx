import Link from 'next/link';
import '@jurmaq/shared/styles/grupo.css';
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';
import { CONTACTO_GRUPO, NEGOCIOS, PieGrupo, type Negocio } from '@jurmaq/shared/ui/grupo';
import { grafoGrupo } from '@/lib/grupo-jsonld';
import CabeceraHub from './CabeceraHub';
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
      <CabeceraHub />
      <main className="h-main">{children}</main>
      <PieGrupo
        texto="Arriendo de maquinaria, barraca de fierros y constructora en la Región del Maule, desde 2000."
        correo={CONTACTO_GRUPO}
        columnas={[
          { titulo: 'Empresas', enlaces: ORDEN.map((n) => ({ href: NEGOCIOS[n].url, texto: NOMBRES[n] })) },
          { titulo: 'El grupo', enlaces: [{ href: '/nosotros', texto: 'Nosotros' }, { href: '/contacto', texto: 'Contacto' }] },
          { titulo: 'Teléfonos', enlaces: ORDEN.map((n) => ({ href: `tel:${NEGOCIOS[n].telefono}`, texto: `${NOMBRES[n]}: ${NEGOCIOS[n].telefonoDisplay}` })) },
        ]}
        legal={ORDEN.map((n) => `${NOMBRES[n]}: ${NEGOCIOS[n].razonSocial}, RUT ${NEGOCIOS[n].rut}, ${NEGOCIOS[n].direccion}`)}
        enlacesLegales={[{ href: '/terminos', texto: 'Términos y condiciones' }, { href: '/privacidad', texto: 'Política de privacidad' }]}
        Enlace={Link}
      />
    </div>
  );
}
