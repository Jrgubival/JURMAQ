/** Cálculo de una cotización. Lo usan el formulario y el servidor: el servidor manda. */
import { IVA } from './sitio';

export const TIPOS_LINEA = ['maquina', 'traslado', 'alojamiento', 'operador', 'otro'] as const;
export type TipoLinea = (typeof TIPOS_LINEA)[number];

export const UNIDADES_LINEA = ['hora', 'dia', 'semana', 'mes', 'viaje', 'noche', 'global'] as const;
export type UnidadLinea = (typeof UNIDADES_LINEA)[number];

export const UNIDAD_LINEA_LABEL: Record<UnidadLinea, { uno: string; varios: string }> = {
  hora: { uno: 'hora', varios: 'horas' },
  dia: { uno: 'día', varios: 'días' },
  semana: { uno: 'semana', varios: 'semanas' },
  mes: { uno: 'mes', varios: 'meses' },
  viaje: { uno: 'viaje', varios: 'viajes' },
  noche: { uno: 'noche', varios: 'noches' },
  global: { uno: '', varios: '' },
};

export interface LineaCalculo {
  tipo: TipoLinea;
  cantidad: number;
  precio_unitario: number;
}

export function subtotalLinea(l: Pick<LineaCalculo, 'cantidad' | 'precio_unitario'>): number {
  return Math.round(l.cantidad * l.precio_unitario);
}

export interface Totales {
  maquinas: number;
  traslados: number;
  otros: number;
  bruto: number;
  neto: number;
  iva: number;
  total: number;
}

export function calcularTotales(lineas: LineaCalculo[], descuento: number): Totales {
  let maquinas = 0;
  let traslados = 0;
  let otros = 0;
  for (const l of lineas) {
    const s = subtotalLinea(l);
    if (l.tipo === 'maquina') maquinas += s;
    else if (l.tipo === 'traslado') traslados += s;
    else otros += s;
  }
  const bruto = maquinas + traslados + otros;
  const neto = Math.max(0, bruto - Math.max(0, Math.round(descuento)));
  const iva = Math.round(neto * IVA);
  return { maquinas, traslados, otros, bruto, neto, iva, total: neto + iva };
}

export function textoCantidad(cantidad: number, unidad: UnidadLinea): string {
  const n = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(cantidad);
  const u = UNIDAD_LINEA_LABEL[unidad];
  return `${n}${u.uno ? ` ${cantidad === 1 ? u.uno : u.varios}` : ''}`.trim();
}
