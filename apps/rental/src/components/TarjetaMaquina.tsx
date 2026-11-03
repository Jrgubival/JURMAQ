import Link from 'next/link';
import { tieneOperadorIncluido } from '@jurmaq/shared/seo/operador';
import { fichaHref, type Maquina } from '@/lib/maquinas';
import Foto from './Foto';
import { PrecioCorto } from './Precios';

export function textoOperador(tipo: string): string {
  if (tipo === 'camion') return 'Con conductor';
  return tieneOperadorIncluido(tipo) ? 'Con operador' : 'Sin operador';
}

export default function TarjetaMaquina({ maquina }: { maquina: Maquina }) {
  return (
    <Link
      href={fichaHref(maquina)}
      prefetch={false}
      className="tarjeta-maquina presionable block overflow-hidden rounded-xl border border-hairline bg-surface"
    >
      <Foto maquina={maquina} />
      <div className="p-4">
        <h3 className="text-xl">{maquina.nombre}</h3>
        <p className="mt-1 text-sm text-ink-muted">{textoOperador(maquina.tipo)}</p>
        <div className="mt-3">
          <PrecioCorto precios={maquina.precios} />
        </div>
      </div>
    </Link>
  );
}
