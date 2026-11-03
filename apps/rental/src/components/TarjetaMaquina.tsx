import Link from 'next/link';
import { tieneOperadorIncluido } from '@jurmaq/shared/seo/operador';
import { fichaHref, type Maquina } from '@/lib/maquinas';
import Foto from './Foto';
import { PrecioCorto } from './Precios';

export function textoOperador(tipo: string): string {
  if (tipo === 'camion') return 'Con conductor';
  return tieneOperadorIncluido(tipo) ? 'Con operador' : 'Sin operador';
}

/** Foto a todo el bloque; el texto se apoya en la sombra de la propia foto. */
export default function TarjetaMaquina({ maquina, className = '', alto = 'aspect-[4/3]', prioridad = false }: { maquina: Maquina; className?: string; alto?: string; prioridad?: boolean }) {
  return (
    <Link href={fichaHref(maquina)} prefetch={false} className={`tile presionable revela relative block overflow-hidden bg-negro text-white ${className}`}>
      <Foto maquina={maquina} className={`${alto} h-full w-full`} prioridad={prioridad} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent p-5 pt-20">
        <h3 className="text-[clamp(1.5rem,2.6vw,2.25rem)]">{maquina.nombre}</h3>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-white/85">
          <PrecioCorto precios={maquina.precios} />
          <p className="text-sm">{textoOperador(maquina.tipo)}</p>
        </div>
      </div>
    </Link>
  );
}

/** Mosaico con ritmo: nunca tres cuadros iguales en fila. */
export function MosaicoFlota({ flota }: { flota: Maquina[] }) {
  const PATRON = ['md:col-span-7 md:row-span-2', 'md:col-span-5', 'md:col-span-5', 'md:col-span-4', 'md:col-span-4', 'md:col-span-4', 'md:col-span-6', 'md:col-span-6'];
  return (
    <div className="grid grid-cols-1 gap-1 md:auto-rows-[300px] md:grid-cols-12">
      {flota.map((m, i) => (
        <TarjetaMaquina key={m.id} maquina={m} className={PATRON[i % PATRON.length]} alto="aspect-[4/3] md:aspect-auto" />
      ))}
    </div>
  );
}
