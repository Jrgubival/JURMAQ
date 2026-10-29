import { esComprable } from '@/lib/stock';

/**
 * Cómo se muestra el precio en la tienda web (reglas del 29-10-2026):
 *   · "Precio normal" tachado = el de Softmad, el que se cobra en el local.
 *   · "Precio web" = lo que paga el cliente en la página.
 *   · El tachado sólo se muestra si el ahorro es de 5% o más.
 *   · Producto que no se puede comprar: "No disponible", sin precio ni tachado,
 *     para que nadie diga "en la página sale más barato".
 * Nunca "antes / ahora".
 */

export const AHORRO_MINIMO_PCT = 5;

export interface ProductoConPrecio {
  precio: number;
  precio_original?: number | null;
  en_oferta?: boolean | null;
  stock: number | null;
  solo_cotizar?: boolean | null;
  activo?: boolean | null;
}

export interface VistaPrecio {
  disponible: boolean;
  /** Lo que se cobra. */
  precioWeb: number;
  /** Tachado, sólo si el ahorro llega al mínimo. */
  precioNormal: number | null;
  ahorroPct: number | null;
}

/** Precio que se cobra: en oferta, el menor de los dos (ver lib/pricing.ts). */
export function precioDeVenta(p: Pick<ProductoConPrecio, 'precio' | 'precio_original' | 'en_oferta'>): number {
  if (p.en_oferta && p.precio_original && p.precio_original > 0) return Math.min(p.precio, p.precio_original);
  return p.precio;
}

/** Arma la vista a partir del precio cobrado y el de lista (si hay). */
export function vistaDesde(disponible: boolean, precioWeb: number, precioLista: number | null): VistaPrecio {
  if (!disponible) return { disponible: false, precioWeb: 0, precioNormal: null, ahorroPct: null };
  const pct = precioLista && precioLista > precioWeb ? Math.round((1 - precioWeb / precioLista) * 100) : 0;
  return pct >= AHORRO_MINIMO_PCT
    ? { disponible: true, precioWeb, precioNormal: precioLista, ahorroPct: pct }
    : { disponible: true, precioWeb, precioNormal: null, ahorroPct: null };
}

export function vistaPrecio(p: ProductoConPrecio): VistaPrecio {
  const venta = precioDeVenta(p);
  const lista = p.en_oferta && p.precio_original && p.precio_original > 0 ? Math.max(p.precio, p.precio_original) : null;
  return vistaDesde(esComprable({ precio: venta, stock: p.stock, solo_cotizar: p.solo_cotizar, activo: p.activo }), venta, lista);
}
