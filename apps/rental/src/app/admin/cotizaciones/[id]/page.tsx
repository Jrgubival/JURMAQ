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
    <div className="mx-auto max-w-2xl">
      <Link href="/admin/cotizaciones" prefetch={false} className="text-[0.8125rem] text-ink-muted underline underline-offset-4">Cotizaciones</Link>
      <h1 className="mt-1">Cotización N.º {c.numero}</h1>
      <p className="text-ink-soft">{c.cliente_nombre}</p>

      <section className="tarjeta mt-3 overflow-hidden">
        <ul className="divide-y divide-hairline">
          {c.lineas.map((l, i) => (
            <li key={i} className="flex justify-between gap-3 px-4 py-2.5">
              <span>{l.descripcion}<span className="block text-[0.8125rem] text-ink-muted">{textoCantidad(l.cantidad, l.unidad)} × {formatCLP(l.precio_unitario)}</span></span>
              <span className="whitespace-nowrap font-medium tabular-nums">{formatCLP(Math.round(l.cantidad * l.precio_unitario))}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-0.5 border-t border-hairline bg-surface-alt px-4 py-3 text-right tabular-nums text-ink-soft">
          {c.descuento_neto > 0 ? <div>Descuento: -{formatCLP(c.descuento_neto)}</div> : null}
          <div>Neto: {formatCLP(t.neto)}</div>
          <div>IVA 19%: {formatCLP(t.iva)}</div>
          <div className="pt-1 font-titulo text-xl text-ink">Total: {formatCLP(t.total)}</div>
        </dl>
      </section>

      <AccionesCotizacion id={c.id} numero={c.numero} estado={c.estado} cliente={c.cliente_nombre} pdf={datosPdf(c, equipo, SITIO.correo)} />
    </div>
  );
}
