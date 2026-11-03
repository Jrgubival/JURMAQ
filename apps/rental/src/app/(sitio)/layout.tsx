import Cabecera from '@/components/Cabecera';
import Movimiento from '@/components/Movimiento';
import Pie from '@/components/Pie';
import { CIUDADES_RENTAL, TIPOS_MENU } from '@/lib/landings';

export default function SitioLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Cabecera />
      <Movimiento />
      <main>{children}</main>
      <Pie tipos={TIPOS_MENU.map(({ slug, nombre }) => ({ slug, nombre }))} comunas={CIUDADES_RENTAL.map(({ slug, nombre }) => ({ slug, nombre }))} />
    </>
  );
}
