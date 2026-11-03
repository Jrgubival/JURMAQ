/**
 * Fichas de obra del portafolio de constructora.jurmaq.cl.
 *
 * Contenido estático: no hay panel ni tabla detrás. Cada dato sale de un
 * documento de Jorge (`JURMAQ_Portfolio_Agrozzi.pdf`, presentación Agrozzi,
 * brochure 2026). Lo que no tiene respaldo queda como `null` y se anota en
 * `pendiente`; nunca se completa a mano.
 *
 * - Sin montos: la decisión de publicarlos es de Jorge.
 * - `mandante` va en texto, sin logo: Jorge autorizó nombrar clientes y usar las
 *   fotos de obra, pero los logos esperan su permiso (03-11-2026).
 * - `servicios` son slugs de `servicios-obras-data.ts`.
 */

export interface FotoObra {
  src: string;
  /** Describe lo que se ve en la foto, no la keyword. */
  alt: string;
}

export interface FichaObra {
  slug: string;
  titulo: string;
  mandante: string;
  comuna: string;
  region: string;
  /** Año de la obra. `null` hasta que Jorge lo entregue. */
  ano: number | null;
  /** Superficie en m². `null` hasta que Jorge la entregue. */
  m2: number | null;
  /** Una frase: qué se hizo. */
  resumen: string;
  /** Partidas con respaldo documental. */
  alcance: string[];
  servicios: string[];
  fotos: FotoObra[];
  /** Datos que faltan para cerrar la ficha. No se publica. */
  pendiente: string[];
}

const TENO = {
  mandante: 'Nestlé Chile S.A.',
  comuna: 'Teno',
  region: 'Región del Maule',
} as const;

export const FICHAS_OBRA: FichaObra[] = [
  {
    ...TENO,
    // Slug ya indexado: no se cambia.
    slug: 'nestle-teno-fundaciones-silos',
    titulo: 'Fundaciones para silos de granos',
    ano: null,
    m2: null,
    resumen:
      'Armado de fierro circular y moldaje radial para fundaciones de silos de gran diámetro, dentro de una planta en operación.',
    alcance: [
      'Excavación con retroexcavadora',
      'Armadura circular y radial, espirales y zunchos',
      'Moldaje radial',
      'Pedestales armados',
    ],
    servicios: ['fundaciones-y-obra-civil-industrial', 'movimiento-de-tierras-y-preparacion-de-terreno'],
    fotos: [
      { src: '/images/proyectos/nestle-teno-fundaciones-silos/hero.jpg', alt: 'Armadura circular de fundación junto a tres silos metálicos' },
      { src: '/images/obras/fundacion-armadura-circular.jpg', alt: 'Trabajadores amarrando la armadura circular de una fundación' },
      { src: '/images/obras/moldaje-radial.jpg', alt: 'Moldaje radial de madera sobre la armadura de fierro' },
      { src: '/images/obras/enfierradura-espirales.jpg', alt: 'Retroexcavadora trabajando en la excavación de la fundación' },
      { src: '/images/obras/enfierradura-pedestal.jpg', alt: 'Armadura de pedestal dentro de su excavación' },
    ],
    pendiente: ['Año', 'Número y diámetro de silos'],
  },
  {
    ...TENO,
    slug: 'expansion-batcheo-molienda-teno',
    titulo: 'Expansión de batcheo y molienda',
    ano: null,
    m2: null,
    resumen:
      'Izado y posicionamiento de tanques industriales de polietileno y obras interiores en una planta en operación.',
    alcance: [
      'Izado y posicionamiento de tanques',
      'Instalaciones interiores',
      'Plataforma y pasarela industrial',
    ],
    servicios: ['estructuras-metalicas-y-montaje-industrial'],
    fotos: [
      { src: '/images/obras/batcheo-interior.jpg', alt: 'Interior de la expansión con plataforma de tijera entre muros en obra' },
      { src: '/images/obras/batcheo-izado-tanque.jpg', alt: 'Tanque de polietileno suspendido durante el izado' },
      { src: '/images/obras/batcheo-silo-posicionado.jpg', alt: 'Silo blanco ya posicionado en el interior de la planta' },
      { src: '/images/obras/batcheo-pasarela.jpg', alt: 'Pasarela industrial con baranda amarilla' },
    ],
    pendiente: ['Año', 'Cantidad y capacidad de tanques'],
  },
  {
    ...TENO,
    slug: 'alero-bodega-materias-primas-teno',
    titulo: 'Alero de bodega de materias primas',
    ano: null,
    m2: null,
    resumen: 'Construcción del alero de la bodega de materias primas de la planta.',
    alcance: ['Construcción de alero', 'Trabajo en altura con plataforma y andamio'],
    servicios: ['cubiertas-y-revestimientos-industriales'],
    fotos: [
      { src: '/images/obras/alero-bodega-nestle-2.jpg', alt: 'Bodega con alero terminado y accesos de carga' },
      { src: '/images/obras/alero-bodega-nestle-3.jpg', alt: 'Vista lateral de la bodega con equipos elevadores' },
      { src: '/images/proyectos/nestle-teno-fundaciones-silos/04-silos-final.jpg', alt: 'Andamio junto al alero de la bodega' },
    ],
    pendiente: ['Año', 'm² de alero'],
  },
  {
    ...TENO,
    slug: 'revestimiento-ampliacion-bodega-teno',
    titulo: 'Revestimiento de ampliación de bodega',
    ano: null,
    m2: null,
    resumen: 'Revestimiento exterior de la ampliación de bodega, con la planta en operación.',
    alcance: ['Revestimiento de fachada', 'Trabajo en altura con brazo articulado'],
    servicios: ['cubiertas-y-revestimientos-industriales'],
    fotos: [
      { src: '/images/obras/revestimiento-bodega-1.jpg', alt: 'Brazo articulado junto a la fachada de la ampliación' },
      { src: '/images/obras/revestimiento-bodega-2.jpg', alt: 'Fachada de la ampliación durante el revestimiento' },
      { src: '/images/obras/ampliacion-revestimiento-fachada.jpg', alt: 'Equipo en terreno al pie de la fachada revestida' },
    ],
    pendiente: ['Año', 'm² revestidos'],
  },
];

export function getFichaObra(slug: string): FichaObra | undefined {
  return FICHAS_OBRA.find((f) => f.slug === slug);
}
