import type { Comuna } from '../comunas';
import type { Pedido } from '@/lib/pedidos';

export interface Bulto {
  pesoKg: number;
  largoCm: number;
  anchoCm: number;
  altoCm: number;
  cantidad: number;
}

export interface CotizacionCourier {
  costo: number;
  /** Días hábiles prometidos, si el courier los informa. */
  dias: number | null;
  servicio: string;
}

export interface EnvioEmitido {
  seguimiento: string;
  /** URL de la etiqueta para imprimir, si el courier la entrega. */
  etiquetaUrl: string | null;
}

export interface EventoSeguimiento {
  fecha: string;
  descripcion: string;
}

/**
 * Un courier que cotiza, emite y rastrea envíos. Para sumar otro (Starken,
 * Chilexpress) basta otro archivo con esta forma y su caso en index.ts.
 */
export interface Courier {
  id: string;
  nombre: string;
  cotizar(datos: { origen: Comuna; destino: Comuna; bultos: Bulto[]; valorDeclarado: number }): Promise<CotizacionCourier>;
  emitir(pedido: Pedido, datos: { origen: Comuna; destino: Comuna; bultos: Bulto[] }): Promise<EnvioEmitido>;
  seguimiento(codigo: string): Promise<{ estado: string; eventos: EventoSeguimiento[] }>;
}
