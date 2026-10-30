/**
 * Reglas y tarifas del despacho. Es el único lugar donde se tocan los montos.
 *
 * Camión propio: el fierro y lo pesado o largo sólo se despacha a las comunas
 * de TARIFAS_PROPIO. Lo demás puede ir por courier (Envíame) a cualquier
 * comuna, siempre que el producto tenga tamaño de envío o peso y medidas.
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
  ZMO: null, // Molina (incluye Lontué, que es parte de la comuna)
  CCO: null, // Curicó
  SFA: null, // Sagrada Familia
  // RML: null, // Romeral: Jorge lo está pensando. Talca y Linares no van.
};

/** Comuna de origen de los envíos por courier (la barraca). */
export const COMUNA_ORIGEN = 'ZMO';

export type TamanoEnvio = 'chico' | 'mediano' | 'grande';

/**
 * Peso y caja por unidad que se asumen según el tamaño de envío del producto
 * (barraca_productos.tamano_envio), cuando no tiene peso y medidas reales.
 * Son valores de referencia para cotizar: conviene revisarlos con un par de
 * envíos reales. Un producto sin tamaño ni medidas no sale por courier.
 */
export const TAMANOS_ENVIO: Record<TamanoEnvio, { pesoKg: number; largoCm: number; anchoCm: number; altoCm: number }> = {
  chico: { pesoKg: 1, largoCm: 30, anchoCm: 20, altoCm: 15 }, // tornillos, brocas, cerraduras
  mediano: { pesoKg: 5, largoCm: 50, anchoCm: 40, altoCm: 30 }, // galón de pintura, herramienta eléctrica
  grande: { pesoKg: 15, largoCm: 80, anchoCm: 50, altoCm: 40 }, // tineta, caja de cerámica, carretilla desarmada
};

/** Límites de un envío por courier; sobre esto se ofrece retiro o cotizar por WhatsApp. */
export const LIMITE_COURIER = { pesoKg: 50, ladoCm: 150 };
