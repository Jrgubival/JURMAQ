import Link from 'next/link';
import { formatCLP } from '@jurmaq/shared/format';
import { supabaseAdmin } from '@jurmaq/shared/supabase';

export default async function Hoy() {
  const [{ data: solicitudes }, { data: abiertas }] = await Promise.all([
    supabaseAdmin
      .from('cotizaciones_arriendo')
      .select('id, numero, cliente_nombre, ubicacion_servicio, created_at, maquinarias(nombre)')
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

      <h1 className="mt-8 text-3xl">Solicitudes de la web</h1>
      {pendientes.length === 0 ? <p className="mt-2 text-ink-muted">No hay solicitudes nuevas.</p> : (
        <ul className="mt-3 space-y-2">
          {pendientes.map((s) => {
            const maquina = (s.maquinarias as unknown as { nombre?: string } | null)?.nombre;
            return (
              <li key={s.id}>
                <Link href={`/admin/cotizaciones/nueva?solicitud=${s.id}`} prefetch={false} className="presionable block rounded-xl border border-hairline bg-surface p-4">
                  <p className="font-semibold">{s.cliente_nombre}</p>
                  <p className="text-ink-muted">{maquina} · {s.ubicacion_servicio}</p>
                  <p className="mt-1 text-sm underline underline-offset-4">Hacer cotización</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="mt-8 text-3xl">Cotizaciones abiertas</h2>
      {(abiertas ?? []).length === 0 ? <p className="mt-2 text-ink-muted">No hay cotizaciones abiertas.</p> : (
        <ul className="mt-3 space-y-2">
          {(abiertas ?? []).map((c) => (
            <li key={c.id}>
              <Link href={`/admin/cotizaciones/${c.id}`} prefetch={false} className="presionable flex items-center justify-between gap-3 rounded-xl border border-hairline bg-surface p-4">
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
