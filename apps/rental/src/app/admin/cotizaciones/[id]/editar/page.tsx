import { notFound } from 'next/navigation';
import FormCotizacion from '@/components/admin/FormCotizacion';
import { catalogoPanel } from '@/lib/catalogo-panel';
import { exigirPermiso, leerCotizacion } from '@/lib/panel';

export default async function EditarCotizacion({ params }: { params: Promise<{ id: string }> }) {
  await exigirPermiso('cotizaciones', 'update');
  const id = Number((await params).id);
  const c = Number.isInteger(id) && id > 0 ? await leerCotizacion(id) : null;
  if (!c) notFound();
  return (
    <>
      <h1 className="text-3xl">Cotización N.º {c.numero}</h1>
      <FormCotizacion
        id={c.id}
        catalogo={await catalogoPanel()}
        inicial={{ ...c, entrega_at: c.entrega_at?.slice(0, 16).replace(' ', 'T') ?? null }}
      />
    </>
  );
}
