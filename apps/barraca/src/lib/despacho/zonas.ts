/**
 * Zonas del camión de la barraca y lo que se cobra por despachar a cada una.
 * ES EL ÚNICO LUGAR DONDE SE TOCAN LOS MONTOS DEL DESPACHO.
 *
 * Fuente: TARIFAS_DESPACHO_30-10.xlsx (hoja "Despachos"):
 *   costo       = "Cobrar al cliente"
 *   gratisDesde = "Gratis desde (sugerido)" (monto de productos desde el que
 *                 el despacho no se cobra; null = nunca es gratis)
 * PROVISORIAS: la mamá de Jorge puede corregirlas. Para cambiar un monto se
 * edita la línea; para dejar de despachar a un lugar, se borra la línea.
 *
 * `comuna` es el código de la comuna a la que pertenece el lugar (ver
 * comunas.ts): Lontué e Itahue son de Molina, Cumpeo de Río Claro y Villa
 * Prat de Sagrada Familia. Lo usan el panel y los correos.
 *
 * Sin `server-only`: también lo leen el selector del header y el checkout.
 * El monto que se cobra igual lo vuelve a calcular el servidor.
 */

export interface ZonaDespacho {
  /** Identificador estable (va en el carrito y en el navegador). */
  id: string;
  nombre: string;
  comuna: string;
  costo: number;
  gratisDesde: number | null;
}

export const ZONAS_DESPACHO: ZonaDespacho[] = [
  { id: 'molina', nombre: 'Molina', comuna: 'ZMO', costo: 0, gratisDesde: null }, // gratis siempre (Jorge, 31-10-2026)
  { id: 'lontue', nombre: 'Lontué', comuna: 'ZMO', costo: 8000, gratisDesde: 250000 },
  { id: 'itahue', nombre: 'Itahue', comuna: 'ZMO', costo: 8000, gratisDesde: 250000 },
  { id: 'cumpeo', nombre: 'Cumpeo', comuna: 'RCL', costo: 10000, gratisDesde: 350000 },
  { id: 'curico', nombre: 'Curicó', comuna: 'CCO', costo: 12000, gratisDesde: 350000 },
  { id: 'sagrada-familia', nombre: 'Sagrada Familia', comuna: 'SFA', costo: 12000, gratisDesde: 350000 },
  { id: 'villa-prat', nombre: 'Villa Prat', comuna: 'SFA', costo: 15000, gratisDesde: 450000 },
  { id: 'rauco', nombre: 'Rauco', comuna: 'RAU', costo: 15000, gratisDesde: 450000 },
  { id: 'san-rafael', nombre: 'San Rafael', comuna: 'SRF', costo: 15000, gratisDesde: 450000 },
  { id: 'romeral', nombre: 'Romeral', comuna: 'RML', costo: 18000, gratisDesde: 450000 },
  { id: 'teno', nombre: 'Teno', comuna: 'TEN', costo: 18000, gratisDesde: 500000 },
  { id: 'pelarco', nombre: 'Pelarco', comuna: 'PLC', costo: 22000, gratisDesde: 600000 },
  { id: 'talca', nombre: 'Talca', comuna: 'ZCA', costo: 25000, gratisDesde: 650000 },
];

const porId = new Map(ZONAS_DESPACHO.map((z) => [z.id, z]));

export function zonaPorId(id: string | null | undefined): ZonaDespacho | null {
  return (id && porId.get(id)) || null;
}

/** Comunas que tienen al menos una zona del camión (no se ofrecen aparte). */
export const COMUNAS_CON_ZONA = new Set(ZONAS_DESPACHO.map((z) => z.comuna));

/** Lo que cuesta el despacho a una zona para un monto de productos. */
export function costoZona(z: ZonaDespacho, subtotal: number): number {
  return z.gratisDesde != null && subtotal >= z.gratisDesde ? 0 : z.costo;
}

/** Elección de zona guardada en el navegador (selector del header y checkout). */
export const CLAVE_ZONA = 'barraca_zona_despacho';
export const EVENTO_ZONA = 'barraca:zona-despacho';
