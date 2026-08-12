import type { Metadata } from 'next';
import Navbar from '@/components/public/Navbar';
import Footer from '@/components/public/Footer';
import { CONSTRUCTORA_URL } from '@/lib/constructora-site';

/**
 * Layout de constructora.jurmaq.cl (obras civiles e industriales B2B).
 *
 * Estas rutas viven en `/constructora/*` dentro de la app, pero el middleware
 * las sirve en la raíz del subdominio: `constructora.jurmaq.cl/servicios`.
 * Por eso `metadataBase` apunta al subdominio —así cualquier URL relativa en
 * OpenGraph resuelve al host correcto— y los `<Link>` internos se escriben sin
 * el prefijo `/constructora`.
 */
export const metadata: Metadata = {
  metadataBase: new URL(CONSTRUCTORA_URL),
};

export default function ConstructoraLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar vertical="constructora" />
      {children}
      <Footer />
    </>
  );
}
