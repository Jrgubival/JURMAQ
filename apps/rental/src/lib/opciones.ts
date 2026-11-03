/** Listas del panel, sin dependencias: también las usa el navegador. */
export const TIPOS_PANEL = [
  { valor: 'retroexcavadora', texto: 'Retroexcavadora' },
  { valor: 'miniexcavadora', texto: 'Miniexcavadora' },
  { valor: 'minicargador', texto: 'Minicargador' },
  { valor: 'camion', texto: 'Camión tolva' },
  { valor: 'brazo_articulado', texto: 'Brazo articulado' },
  { valor: 'alzahombre', texto: 'Alzahombre o plataforma' },
] as const;

export const ESTADOS_MAQUINA = [
  { valor: 'disponible', texto: 'Disponible' },
  { valor: 'arrendada', texto: 'Arrendada' },
  { valor: 'mantencion', texto: 'En mantención' },
] as const;

export const ESTADOS_COTIZACION = ['borrador', 'enviada', 'aceptada', 'rechazada', 'cancelada'] as const;
export type EstadoCotizacion = (typeof ESTADOS_COTIZACION)[number];
