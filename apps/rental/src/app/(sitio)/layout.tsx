import Cabecera from '@/components/Cabecera';
import Pie from '@/components/Pie';
import { TIPOS } from '@/lib/landings';

export default function SitioLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Cabecera />
      <main>{children}</main>
      <Pie tipos={TIPOS.map((t) => ({ slug: t.slug, nombre: t.nombre }))} />
    </>
  );
}
