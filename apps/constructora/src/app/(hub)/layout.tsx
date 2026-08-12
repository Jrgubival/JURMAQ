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
      <Navbar vertical="arriendo" />
      {children}
      <Footer />
    </>
  );
}
