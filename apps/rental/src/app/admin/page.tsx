import { exigirPermiso } from '@/lib/panel';
import Link from 'next/link';
import Descartar from '@/components/admin/Descartar';
import ErrorCarga from '@/components/admin/ErrorCarga';
import { formatCLP } from '@jurmaq/shared/format';
import { supabaseAdmin } from '@jurmaq/shared/supabase';

function hace(fecha: string): string {
  const minutos = Math.max(1, Math.round((Date.now() - new Date(fecha).getTime()) / 60000));
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`;
  const dias = Math.round(horas / 24);
  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

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
  const [{ data: solicitudes, error: e1 }, { data: abiertas, error: e2 }] = await Promise.all([
    supabaseAdmin
      .from('cotizaciones_arriendo')
      .select('id, numero, cliente_nombre, cliente_telefono, ubicacion_servicio, fecha_servicio, created_at, maquinarias(nombre)')
      .eq('origen', 'web')
      .eq('estado', 'enviada')
      .order('created_at', { ascending: false })
      .limit(30),
    supabaseAdmin
      .from('cotizaciones_arriendo')
      .select('id, numero, cliente_nombre, total, estado')
      .eq('origen', 'panel')
      .in('estado', ['borrador', 'enviada'])
      .order('id', { ascending: false })
      .limit(15),
  ]);
  const ids = (solicitudes ?? []).map((s) => s.id);
  const { data: convertidas } = ids.length
    ? await supabaseAdmin.from('cotizaciones_arriendo').select('solicitud_id').in('solicitud_id', ids)
    : { data: [] as { solicitud_id: number | null }[] };
  const hechas = new Set((convertidas ?? []).map((c) => c.solicitud_id));
  const pendientes = (solicitudes ?? []).filter((s) => !hechas.has(s.id));

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
              {pendientes.map((s) => {
                const maquina = (s.maquinarias as unknown as { nombre?: string } | null)?.nombre;
                return (
                  <li key={s.id} className="p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-semibold">{s.cliente_nombre}</p>
                      <p className="shrink-0 text-[0.8125rem] text-ink-muted">{hace(s.created_at)}</p>
                    </div>
                    <p className="text-ink-soft">{maquina ?? 'Sin máquina'}, {s.ubicacion_servicio}{s.fecha_servicio ? `, para el ${new Date(`${s.fecha_servicio}T12:00`).toLocaleDateString('es-CL')}` : ''}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Link href={`/admin/cotizaciones/nueva?solicitud=${s.id}`} prefetch={false} className="boton boton-principal">Hacer cotización</Link>
                      {s.cliente_telefono ? <a href={`tel:${s.cliente_telefono}`} className="boton boton-suave">Llamar</a> : null}
                      <Descartar id={s.id} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
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
