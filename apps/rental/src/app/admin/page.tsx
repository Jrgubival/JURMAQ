import { exigirPermiso, solicitudesPendientes } from '@/lib/panel';
import Link from 'next/link';
import ErrorCarga from '@/components/admin/ErrorCarga';
import FilaSolicitud from '@/components/admin/FilaSolicitud';
import { formatCLP } from '@jurmaq/shared/format';
import { supabaseAdmin } from '@jurmaq/shared/supabase';

function Encabezado({ id, titulo, total, destacar = false }: { id: string; titulo: string; total: number; destacar?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <h2 id={id} className="!text-base">{titulo}</h2>
      <span className={`rounded-full px-2.5 py-0.5 text-[0.8125rem] font-semibold tabular-nums ${destacar && total > 0 ? 'bg-acento text-negro' : 'bg-surface-alt text-ink-soft'}`}>{total}</span>
    </div>
  );
}

export default async function Hoy() {
  await exigirPermiso('cotizaciones', 'read');
  const [{ pendientes, error: e1 }, { data: abiertas, error: e2 }] = await Promise.all([
    solicitudesPendientes(),
    supabaseAdmin
      .from('cotizaciones_arriendo')
      .select('id, numero, cliente_nombre, total, estado')
      .eq('origen', 'panel')
      .in('estado', ['borrador', 'enviada'])
      .order('id', { ascending: false })
      .limit(15),
  ]);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1>Hoy</h1>
        <Link href="/admin/cotizaciones/nueva" prefetch={false} className="boton boton-principal">Nueva cotización</Link>
      </div>
      {e1 || e2 ? <ErrorCarga /> : null}

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[3fr_2fr]">
        <section aria-labelledby="solicitudes" className="tarjeta overflow-hidden">
          <Encabezado id="solicitudes" titulo="Solicitudes de la web" total={pendientes.length} destacar />
          {e1 ? null : pendientes.length === 0 ? <p className="px-4 pb-4 text-ink-muted">No hay solicitudes nuevas.</p> : (
            <ul className="divide-y divide-hairline border-t border-hairline">
              {pendientes.slice(0, 5).map((s) => <FilaSolicitud key={s.id} s={s} />)}
            </ul>
          )}
          {pendientes.length > 5 ? <p className="border-t border-hairline px-4 py-2 text-right"><Link href="/admin/solicitudes" prefetch={false} className="text-[0.8125rem] text-ink-muted underline underline-offset-4">Ver todas</Link></p> : null}
        </section>

        <section aria-labelledby="abiertas" className="tarjeta overflow-hidden">
          <Encabezado id="abiertas" titulo="Cotizaciones abiertas" total={(abiertas ?? []).length} />
          {e2 ? null : (abiertas ?? []).length === 0 ? <p className="px-4 pb-4 text-ink-muted">No hay cotizaciones abiertas.</p> : (
            <ul className="divide-y divide-hairline border-t border-hairline">
              {(abiertas ?? []).map((c) => (
                <li key={c.id}>
                  <Link href={`/admin/cotizaciones/${c.id}`} prefetch={false} className="presionable flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-alt">
                    <span className="min-w-0"><span className="block font-semibold">N.º {c.numero}</span><span className="block truncate text-ink-soft">{c.cliente_nombre}</span></span>
                    <span className="whitespace-nowrap font-medium tabular-nums">{formatCLP(Number(c.total))}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
