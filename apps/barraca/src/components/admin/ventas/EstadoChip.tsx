import { ETIQUETA_ESTADO, TONO_ESTADO, type Tono } from '@/lib/admin/ventas';
import type { EstadoPedido } from '@/lib/pedidos';

/**
 * Estado del pedido. El color dice cuánto apura: rojo de marca = hay que
 * revisar plata ahora; azul marino = hay que preparar; ámbar = esperando al
 * cliente; el resto, calmo.
 */
export const CLASE_TONO: Record<Tono, string> = {
  urgente: 'bg-marca-600 text-white',
  trabajo: 'bg-navy-950 text-white',
  atencion: 'bg-[#FBF0D5] text-[#7A4E00] ring-1 ring-inset ring-[#EBD39A]',
  camino: 'bg-[#E8EDF5] text-navy-800',
  listo: 'bg-[#EAF2E8] text-[#2F5D33]',
  cerrado: 'bg-[#F0EEE9] text-[#66645F]',
};

export default function EstadoChip({ estado, grande = false }: { estado: EstadoPedido; grande?: boolean }) {
  const tono = TONO_ESTADO[estado];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md font-semibold whitespace-nowrap ${
        grande ? 'px-2.5 py-1 text-[13.5px]' : 'px-2 py-[3px] text-[12px]'
      } ${CLASE_TONO[tono]}`}
    >
      {tono === 'urgente' && <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-white animate-pulse motion-reduce:animate-none" />}
      {ETIQUETA_ESTADO[estado]}
    </span>
  );
}
