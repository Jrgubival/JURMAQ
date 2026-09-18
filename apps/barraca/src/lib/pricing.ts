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
  //
  // El par (precio, precio_original) llega en los DOS órdenes posibles según
  // quién lo haya escrito, y eso es una bomba en el camino del dinero:
  //   · promotions.ts y este archivo asumen precio_original = el con descuento.
  //   · bulk-action del admin y el import de Excel escriben lo contrario:
  //     precio = el con descuento, precio_original = el de lista.
  // Con la segunda convención se tachaba el precio barato, se destacaba el caro
  // y el carrito cobraba el caro. En vez de elegir una convención y confiar en
  // que todos los escritores la respeten, resolvemos por valor: en una oferta
  // el que se cobra es SIEMPRE el menor de los dos.
  if (producto.en_oferta && producto.precio_original && producto.precio_original > 0) {
    const venta = Math.min(producto.precio, producto.precio_original);
    const antes = Math.max(producto.precio, producto.precio_original);
    const pctDesc = antes > venta ? Math.round((1 - venta / antes) * 100) : null;
    return {
      precioFinal: venta,
      precioTachado: antes > venta ? antes : null,
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
 * Precio EFECTIVO de cobro de un ítem (carrito o cotización). Fuente ÚNICA de
 * verdad para GET /api/carrito y POST /api/cotizaciones (audit 2.8): el cliente
 * nunca paga más que el menor entre lo que vio congelado (`stored`) y el estado
 * vivo (oferta real > promo del día > precio base). Antes cada ruta calculaba
 * distinto → el total del carrito podía no cuadrar con el de la cotización.
 */
export function resolveCartItemPrice(args: {
  /** precio_unitario congelado del carrito (0 si no hay) */
  stored: number;
  precio: number;
  precio_original?: number | null;
  en_oferta?: boolean | null;
  /** % de descuento de promo del día para la categoría del producto (si aplica) */
  promoDescuento?: number | null;
}): number {
  const { stored, precio, precio_original, en_oferta, promoDescuento } = args;
  let livePrice: number;
  if (en_oferta && precio_original && precio_original > 0) {
    // Mismo criterio que resolvePrice: en oferta se cobra el MENOR de los dos,
    // porque los escritores de la DB no coinciden en cuál de los dos campos
    // guarda el precio con descuento.
    livePrice = Math.min(precio, precio_original);
  } else if (promoDescuento && promoDescuento > 0 && precio > 0) {
    livePrice = Math.round(precio * (1 - promoDescuento / 100));
  } else {
    livePrice = precio || 0;
  }
  const candidates = [stored, livePrice].filter((n) => n > 0);
  if (candidates.length > 0) return Math.min(...candidates);
  return getCartPrice({ precio, precio_original, en_oferta: en_oferta ?? undefined });
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
  // Oferta real: el menor de los dos (ver la nota en resolvePrice).
  if (producto.en_oferta && producto.precio_original && producto.precio_original > 0) {
    return Math.min(producto.precio, producto.precio_original);
  }
  // Precio normal
  return producto.precio;
}
