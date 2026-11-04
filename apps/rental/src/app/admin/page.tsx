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
      <Link href="/admin/cotizaciones/nueva" prefetch={false} className="boton boton-principal w-full">Nueva cotización</Link>
      {e1 || e2 ? <ErrorCarga /> : null}

      <h1 className="mt-8 text-3xl">Solicitudes de la web</h1>
      {e1 ? null : pendientes.length === 0 ? <p className="mt-2 text-ink-muted">No hay solicitudes nuevas.</p> : (
        <ul className="mt-3 space-y-2">
          {pendientes.map((s) => {
            const maquina = (s.maquinarias as unknown as { nombre?: string } | null)?.nombre;
            return (
              <li key={s.id} className="rounded-[var(--g-radio)] border border-hairline bg-surface p-4">
                <p className="font-semibold">{s.cliente_nombre}</p>
                <p className="text-ink-muted">{maquina ?? 'Sin máquina'}, {s.ubicacion_servicio}</p>
                <p className="text-lg text-ink-muted">Llegó {hace(s.created_at)}{s.fecha_servicio ? `, para el ${new Date(`${s.fecha_servicio}T12:00`).toLocaleDateString('es-CL')}` : ''}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Link href={`/admin/cotizaciones/nueva?solicitud=${s.id}`} prefetch={false} className="boton boton-principal">Hacer cotización</Link>
                  {s.cliente_telefono ? <a href={`tel:${s.cliente_telefono}`} className="boton boton-suave">Llamar</a> : null}
                </div>
                <div className="mt-1"><Descartar id={s.id} /></div>
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="mt-8 text-3xl">Cotizaciones abiertas</h2>
      {e2 ? null : (abiertas ?? []).length === 0 ? <p className="mt-2 text-ink-muted">No hay cotizaciones abiertas.</p> : (
        <ul className="mt-3 space-y-2">
          {(abiertas ?? []).map((c) => (
            <li key={c.id}>
              <Link href={`/admin/cotizaciones/${c.id}`} prefetch={false} className="presionable flex items-center justify-between gap-3 rounded-[var(--g-radio)] border border-hairline bg-surface p-4">
                <span><span className="font-semibold">N.º {c.numero}</span> · {c.cliente_nombre}</span>
                <span className="whitespace-nowrap">{formatCLP(Number(c.total))}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
