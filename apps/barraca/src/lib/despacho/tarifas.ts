/**
 * Reglas y tarifas del despacho. Es el único lugar donde se tocan los montos.
 *
 * Camión propio: el fierro y lo pesado o largo sólo se despacha a las comunas
 * de TARIFAS_PROPIO. Lo chico puede ir por courier a cualquier comuna.
 */

/**
 * Categorías que sólo viajan en el camión propio (ids de barraca_categorias).
 * Se decide por categoría porque el peso está cargado en muy pocos productos.
 */
export const CATEGORIAS_CAMION: Record<number, string> = {
  12: 'Fierros Construcción',
  13: 'Perfiles y Planchas',
  2: 'Techumbre',
  19: 'Tabiquería',
  10: 'Cercos y Mallas',
  1: 'Áridos y Morteros',
};

export interface TarifaPropio {
  /** Lo que se cobra por despachar el pedido a esa comuna. */
  costo: number;
  /** Desde este monto de productos el despacho no se cobra (opcional). */
  gratisDesde?: number;
}

/**
 * Comunas que cubre el camión propio, por código de comuna (ver comunas.ts).
 * Un costo null significa "a coordinar": se ofrece el despacho, pero el costo
 * se acuerda por teléfono y no se suma al total.
 *
 * TODO(Jorge): faltan los montos. Mientras sean null el checkout muestra
 * "a coordinar", como antes.
 */
export const TARIFAS_PROPIO: Record<string, TarifaPropio | null> = {
  ZMO: null, // Molina
  CCO: null, // Curicó
};

/** Comuna de origen de los envíos por courier (la barraca). */
export const COMUNA_ORIGEN = 'ZMO';

/**
 * Peso y caja que se asumen para un producto sin peso cargado, al cotizar el
 * courier. Mejor cargar el peso real en la base: así cotiza justo.
 */
export const BULTO_POR_DEFECTO = { pesoKg: 1, largoCm: 30, anchoCm: 20, altoCm: 15 };
