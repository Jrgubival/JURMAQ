import Link from 'next/link';
import '@jurmaq/shared/styles/grupo.css';
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';
import { MarcaGrupo, PieLegal } from '@jurmaq/shared/ui/grupo';
import { grafoGrupo } from '@/lib/grupo-jsonld';
import './hub.css';

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
      <header className="h-cabecera">
        <MarcaGrupo />
        <nav aria-label="Principal">
          <Link href="/nosotros">Nosotros</Link>
          <Link href="/contacto">Contacto</Link>
        </nav>
      </header>
      <main className="h-main">{children}</main>
      <PieLegal marca="hub">
        <Link href="/privacidad">Privacidad</Link>
        <Link href="/terminos">Términos</Link>
      </PieLegal>
    </div>
  );
}
