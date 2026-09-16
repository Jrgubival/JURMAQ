import { buildJsonLdGraph, safeJsonLd } from '@jurmaq/shared/seo/jsonld';
import Navbar from '@/components/public/Navbar';
import Footer from '@/components/public/Footer';

/**
 * Layout del hub jurmaq.cl — arriendo de maquinaria + puerta de entrada a las
 * otras dos unidades (constructora y barraca) vía el switcher del Navbar.
 *
 * Es un route group: `(hub)` no aparece en la URL. `/(hub)/maquinarias` sigue
 * sirviéndose en `jurmaq.cl/maquinarias`.
 */
export default function HubLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Grafo de marca del HUB (Organization + LocalBusiness + WebSite con
          @id en jurmaq.cl). Vive acá y no en el layout raíz para que no se
          inyecte también en constructora.jurmaq.cl, que tiene el suyo. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(buildJsonLdGraph('constructora')) }}
      />
      <Navbar vertical="arriendo" />
      {children}
      <Footer vertical="arriendo" />
    </>
  );
}
