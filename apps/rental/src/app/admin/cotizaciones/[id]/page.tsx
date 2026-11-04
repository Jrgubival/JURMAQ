import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatCLP } from '@jurmaq/shared/format';
import AccionesCotizacion from '@/components/admin/AccionesCotizacion';
import { calcularTotales, textoCantidad } from '@/lib/cotizacion';
import { exigirPermiso, datosPdf, leerCotizacion } from '@/lib/panel';
import { SITIO } from '@/lib/sitio';

export default async function VerCotizacion({ params }: { params: Promise<{ id: string }> }) {
  await exigirPermiso('cotizaciones', 'read');
  const id = Number((await params).id);
  const c = Number.isInteger(id) && id > 0 ? await leerCotizacion(id) : null;
  if (!c) notFound();
  const equipo = c.lineas.find((l) => l.tipo === 'maquina')?.descripcion.replace(/^Arriendo de /, '') ?? '';
  const t = calcularTotales(c.lineas, c.descuento_neto);
  return (
    <>
      <p className="text-lg capitalize text-ink-muted">{c.estado}</p>
      <h1 className="text-3xl">Cotización N.º {c.numero}</h1>
      <p className="mt-1 text-lg">{c.cliente_nombre}</p>

      <ul className="mt-4 divide-y divide-hairline border-y border-hairline">
        {c.lineas.map((l, i) => (
          <li key={i} className="flex justify-between gap-3 py-3">
            <span>{l.descripcion}<span className="block text-lg text-ink-muted">{textoCantidad(l.cantidad, l.unidad)} × {formatCLP(l.precio_unitario)}</span></span>
            <span className="whitespace-nowrap font-medium">{formatCLP(Math.round(l.cantidad * l.precio_unitario))}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-3 space-y-1 text-right">
        {c.descuento_neto > 0 ? <div>Descuento: -{formatCLP(c.descuento_neto)}</div> : null}
        <div>Neto: {formatCLP(t.neto)}</div>
        <div>IVA 19%: {formatCLP(t.iva)}</div>
        <div className="font-titulo text-2xl">Total: {formatCLP(t.total)}</div>
      </dl>

      <AccionesCotizacion id={c.id} numero={c.numero} estado={c.estado} cliente={c.cliente_nombre} correo={c.contacto_email} telefono={c.cliente_telefono} pdf={datosPdf(c, equipo, SITIO.correo)} />
      <Link href={`/admin/cotizaciones/${c.id}/editar`} prefetch={false} className="boton boton-suave mt-3 w-full">Editar</Link>
    </>
  );
}
