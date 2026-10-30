import type { Comuna } from '../comunas';
import type { Pedido } from '@/lib/pedidos';

/** Una unidad de producto lista para viajar (por unidad, más su cantidad). */
export interface Bulto {
  pesoKg: number;
  largoCm: number;
  anchoCm: number;
  altoCm: number;
  cantidad: number;
}

/**
 * El pedido entero como una sola caja: es lo que se cotiza y lo que se
 * despacha. Se guarda en el pedido para que el envío salga igual a lo cotizado.
 */
export interface Paquete {
  pesoKg: number;
  largoCm: number;
  anchoCm: number;
  altoCm: number;
  volumenM3: number;
  unidades: number;
}

export interface CotizacionCourier {
  costo: number;
  /** Días hábiles prometidos, si el courier los informa. */
  dias: number | null;
  /** Nombre para el comprador, ej. "Bluexpress · E-Commerce". */
  servicio: string;
  /** Transportista y servicio elegidos, para crear el envío con lo mismo (ej. "BLX:priority"). */
  servicioCodigo: string;
}

export interface EnvioEmitido {
  seguimiento: string;
  /** URL de la etiqueta para imprimir, si el courier la entrega. */
  etiquetaUrl: string | null;
  /** Id del envío en el courier (para consultar el seguimiento). */
  envioId: string | null;
}

export interface EventoSeguimiento {
  fecha: string;
  descripcion: string;
}

/**
 * Un courier que cotiza, emite y rastrea envíos. Para sumar otro basta otro
 * archivo con esta forma y su caso en index.ts.
 */
export interface Courier {
  id: string;
  nombre: string;
  /** true si cotiza con tarifas de ejemplo (modo prueba). */
  simulado: boolean;
  cotizar(datos: { origen: Comuna; destino: Comuna; paquete: Paquete; valorDeclarado: number }): Promise<CotizacionCourier>;
  emitir(pedido: Pedido, datos: { origen: Comuna; destino: Comuna; paquete: Paquete; servicioCodigo: string | null }): Promise<EnvioEmitido>;
  seguimiento(envioId: string): Promise<{ estado: string; eventos: EventoSeguimiento[] }>;
}
