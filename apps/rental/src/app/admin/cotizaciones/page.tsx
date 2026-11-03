import Link from 'next/link';
import { formatCLP } from '@jurmaq/shared/format';
import { escapeLikePattern, escapeOrFilter } from '@jurmaq/shared/sanitize';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { ESTADOS_COTIZACION } from '@/lib/esquemas';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export default async function Cotizaciones({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { q = '', estado = '', desde = '', hasta = '' } = await searchParams;
  let consulta = supabaseAdmin
    .from('cotizaciones_arriendo')
    .select('id, numero, cliente_nombre, fecha_emision, total, estado')
    .eq('origen', 'panel')
    .order('id', { ascending: false })
    .limit(100);
  const texto = q.trim().slice(0, 80);
  if (texto) {
    const patron = escapeOrFilter(`%${escapeLikePattern(texto)}%`);
    consulta = consulta.or(`cliente_nombre.ilike.${patron},numero.ilike.${patron}`);
  }
  if ((ESTADOS_COTIZACION as readonly string[]).includes(estado)) consulta = consulta.eq('estado', estado);
  if (FECHA.test(desde)) consulta = consulta.gte('fecha_emision', desde);
  if (FECHA.test(hasta)) consulta = consulta.lte('fecha_emision', hasta);
  const { data } = await consulta;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl">Cotizaciones</h1>
        <Link href="/admin/cotizaciones/nueva" prefetch={false} className="boton boton-principal">Nueva</Link>
      </div>
      <form className="mt-4 grid gap-3 sm:grid-cols-2">
        <input name="q" aria-label="Buscar" className="campo sm:col-span-2" placeholder="Buscar cliente o número" defaultValue={texto} />
        <select name="estado" aria-label="Estado" className="campo" defaultValue={estado}>
          <option value="">Todos los estados</option>
          {ESTADOS_COTIZACION.map((e) => <option key={e} value={e}>{e[0].toUpperCase() + e.slice(1)}</option>)}
        </select>
        <button className="boton boton-suave">Buscar</button>
        <label className="text-sm">Desde<input name="desde" type="date" className="campo mt-1" defaultValue={FECHA.test(desde) ? desde : ''} /></label>
        <label className="text-sm">Hasta<input name="hasta" type="date" className="campo mt-1" defaultValue={FECHA.test(hasta) ? hasta : ''} /></label>
      </form>
      {(data ?? []).length === 0 ? <p className="mt-6 text-ink-muted">No hay cotizaciones.</p> : (
        <ul className="mt-4 space-y-2">
          {(data ?? []).map((c) => (
            <li key={c.id}>
              <Link href={`/admin/cotizaciones/${c.id}`} prefetch={false} className="presionable block rounded-xl border border-hairline bg-surface p-4">
                <span className="flex justify-between gap-3"><span className="font-semibold">N.º {c.numero}</span><span>{formatCLP(Number(c.total))}</span></span>
                <span className="block">{c.cliente_nombre}</span>
                <span className="block text-sm capitalize text-ink-muted">{c.estado} · {c.fecha_emision}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
