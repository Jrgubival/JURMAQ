import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react/dist/ssr';
import { formatCLP } from '@jurmaq/shared/format';
import { UNIDAD_LABEL, fichaHref, type Maquina } from '@/lib/maquinas';
import Foto from './Foto';

/** Primera oración de la descripción: la tarjeta lleva una sola línea de uso. */
function lineaDeUso(texto: string) {
  const t = texto.trim();
  const fin = t.search(/[.!?](\s|$)/);
  return fin > 0 ? t.slice(0, fin + 1) : t;
}

function Desde({ maquina }: { maquina: Maquina }) {
  const p = maquina.precios[0];
  if (!p) return <p className="font-titulo text-2xl leading-tight">Valor a cotizar</p>;
  return (
    <div>
      <p className="text-sm text-ink-muted">Desde</p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2 leading-tight">
        <span className="font-titulo text-[1.75rem] tabular-nums">{formatCLP(p.valor)}</span>
        <span className="text-[0.9375rem] font-medium text-ink-soft">/ {UNIDAD_LABEL[p.unidad].uno} + IVA</span>
      </p>
      {p.incluye ? <p className="mt-1 text-sm text-ink-muted">{p.incluye}</p> : null}
    </div>
  );
}

export default function TarjetaMaquina({ maquina, prioridad = false }: { maquina: Maquina; prioridad?: boolean }) {
  const uso = maquina.descripcion ? lineaDeUso(maquina.descripcion) : '';
  return (
    <Link href={fichaHref(maquina)} prefetch={false} className="tile tarjeta presionable fila-trabajo group flex h-full flex-col overflow-hidden border border-hairline bg-surface">
      <Foto maquina={maquina} className="aspect-[4/3]" fondo="bg-[var(--fondo-foto)]" prioridad={prioridad} />
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-2xl">{maquina.nombre}</h3>
        {uso ? <p className="mt-2 line-clamp-1 text-[0.9375rem] text-ink-soft" title={uso}>{uso}</p> : null}
        <div className="mt-auto pt-6">
          <Desde maquina={maquina} />
          <span className="tarjeta-cta mt-6 flex min-h-12 items-center justify-center gap-2 rounded-[12px] border border-[#c9ced6] font-semibold text-negro">
            Ver equipo y cotizar <ArrowRight size={18} weight="bold" className="flecha" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function MosaicoFlota({ flota }: { flota: Maquina[] }) {
  return (
    <div className="grid gap-6 px-4 sm:grid-cols-2 md:px-0 lg:grid-cols-3">
      {flota.map((m, i) => <TarjetaMaquina key={m.id} maquina={m} prioridad={i < 2} />)}
    </div>
  );
}
