/**
 * SISTEMA DE PRECIOS JURMAQ BARRACA
 * ==================================
 *
 * Hay 3 tipos de precio, en orden de prioridad:
 *
 * 1. OFERTA (precio_original en DB, en_oferta=true)
 *    → Admin la setea manualmente con respaldo del precio vigente en los ultimos 30 dias.
 *    → El cliente paga precio_original.
 *    → Se muestra: precio tachado → precio_original como oferta.
 *
 * 2. PROMOCION TEMPORAL / DEL DIA (virtual, no toca DB)
 *    → Sistema de promociones diarias rotativas.
 *    → Calcula descuento % sobre el precio base vigente.
 *    → Se muestra: precio tachado → precio con descuento.
 *    → Requiere que el precio base tachado haya sido el precio efectivo
 *      de venta durante los 30 dias previos (Ley 19.496 art. 28).
 *
 * 3. PRECIO NORMAL (precio en DB)
 *    → Sin descuento. Se muestra tal cual.
 *
 * REGLA PARA EL CARRITO:
 * - Si hay oferta  → cobrar precio_original
 * - Si hay promo del dia → cobrar precio con descuento (precioOverride)
 * - Si no hay nada → cobrar precio
 *
 * La oferta real SIEMPRE tiene prioridad sobre la promocion temporal.
 */

export interface PrecioProducto {
  precio: number;
  precio_original?: number | null; // oferta real (column name in DB)
  en_oferta?: boolean;
  solo_cotizar?: boolean;
}

export interface PrecioResuelto {
  /** El precio que se cobra al cliente */
  precioFinal: number;
  /** El precio tachado (null si no hay descuento) */
  precioTachado: number | null;
  /** Porcentaje de descuento (null si no hay) */
  porcentajeDescuento: number | null;
  /** Tipo: 'oferta_real' | 'promo_dia' | 'normal' | 'cotizar' */
  tipo: 'oferta_real' | 'promo_dia' | 'normal' | 'cotizar';
  /** Label para mostrar */
  label: string | null;
}

/**
 * Resuelve el precio de un producto considerando ofertas reales y promos del día.
 *
 * @param producto - Datos del producto de la DB
 * @param promoDescuento - Porcentaje de descuento de promo del día (null si no aplica)
 * @param promoTitulo - Título de la promo del día (null si no aplica)
 */
export function resolvePrice(
  producto: PrecioProducto,
  promoDescuento: number | null = null,
  promoTitulo: string | null = null,
): PrecioResuelto {
  // Solo cotizar → no mostrar precio
  if (producto.solo_cotizar) {
    return {
      precioFinal: 0,
      precioTachado: null,
      porcentajeDescuento: null,
      tipo: 'cotizar',
      label: null,
    };
  }

  // Prioridad 1: Oferta real (admin la setea en DB)
  if (producto.en_oferta && producto.precio_original && producto.precio_original > 0) {
    const pctDesc = producto.precio > producto.precio_original
      ? Math.round((1 - producto.precio_original / producto.precio) * 100)
      : null;
    return {
      precioFinal: producto.precio_original,
      precioTachado: producto.precio,
      porcentajeDescuento: pctDesc,
      tipo: 'oferta_real',
      label: 'OFERTA',
    };
  }

  // Prioridad 2: Promocion temporal / del dia (virtual, no modifica DB)
  if (promoDescuento && promoDescuento > 0 && producto.precio > 0) {
    return {
      precioFinal: Math.round(producto.precio * (1 - promoDescuento / 100)),
      precioTachado: producto.precio,
      porcentajeDescuento: promoDescuento,
      tipo: 'promo_dia',
      label: promoTitulo || 'OFERTA DEL DÍA',
    };
  }

  // Prioridad 3: Precio normal
  return {
    precioFinal: producto.precio,
    precioTachado: null,
    porcentajeDescuento: null,
    tipo: 'normal',
    label: null,
  };
}

/**
 * Calcula el precio que se debe cobrar en el carrito.
 * Misma lógica que resolvePrice pero solo devuelve el número.
 */
export function getCartPrice(
  producto: PrecioProducto,
  precioOverride?: number | null,
): number {
  // Si viene un override (de promo card), usarlo
  if (precioOverride && precioOverride > 0) {
    return Math.round(precioOverride);
  }
  // Oferta real
  if (producto.en_oferta && producto.precio_original && producto.precio_original > 0) {
    return producto.precio_original;
  }
  // Precio normal
  return producto.precio;
}
