import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react/dist/ssr';
import { formatCLP } from '@jurmaq/shared/format';
import { UNIDAD_LABEL, fichaHref, type Maquina } from '@/lib/maquinas';
import Foto from './Foto';

function Desde({ maquina }: { maquina: Maquina }) {
  const p = maquina.precios[0];
  if (!p) return <p className="font-semibold">Valor a cotizar</p>;
  return <p>Desde <span className="font-semibold">{formatCLP(p.valor)}</span> / {UNIDAD_LABEL[p.unidad].uno}</p>;
}

export default function TarjetaMaquina({ maquina, prioridad = false }: { maquina: Maquina; prioridad?: boolean }) {
  return (
    <Link href={fichaHref(maquina)} prefetch={false} className="tile tarjeta presionable fila-trabajo flex flex-col overflow-hidden rounded-[var(--g-radio)] border border-hairline bg-surface">
      <Foto maquina={maquina} className="aspect-[16/10]" prioridad={prioridad} />
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-2xl">{maquina.nombre}</h3>
        {maquina.descripcion ? <p className="mt-1 text-[0.9375rem] text-ink-soft">{maquina.descripcion}</p> : null}
        <div className="mt-auto pt-3">
          <div className="border-t border-hairline pt-3"><Desde maquina={maquina} /></div>
          <p className="mt-2 flex items-center gap-1.5 font-semibold text-acento-texto">Ver equipo y cotizar <ArrowRight size={18} weight="bold" className="flecha" aria-hidden /></p>
        </div>
      </div>
    </Link>
  );
}

export function MosaicoFlota({ flota }: { flota: Maquina[] }) {
  return (
    <div className="grid gap-4 px-4 sm:grid-cols-2 md:px-0 lg:grid-cols-3">
      {flota.map((m, i) => <TarjetaMaquina key={m.id} maquina={m} prioridad={i < 2} />)}
    </div>
  );
}
