/**
 * Portafolio de obras. Contenido estático: no hay panel ni tabla detrás.
 *
 * Cada dato sale de un documento de Jorge (portafolio y presentación Agrozzi,
 * brochure 2026, carta de presentación, contrato y acta de riles). Lo que no
 * tiene respaldo queda `null` y se anota en `pendiente`; nunca se completa a mano.
 *
 * - Sin montos: publicarlos es decisión de Jorge.
 * - Clientes en texto, sin logos: Jorge autorizó nombrarlos y usar las fotos de
 *   obra; los logos esperan su permiso (03-11-2026).
 * - Los slugs ya indexados no se cambian.
 */
import medidas from "./fotos.json";

export interface FotoObra {
  /** Nombre en `public/obras`, sin ancho ni extensión. */
  nombre: keyof typeof medidas;
  /** Describe lo que se ve, no la keyword. */
  alt: string;
}

export interface Obra {
  slug: string;
  titulo: string;
  /** Título SEO, máximo 45 caracteres antes de la marca. */
  tituloSeo: string;
  mandante: string;
  comuna: string;
  region: string;
  /** Texto de periodo con respaldo, por ejemplo "Desde 2017". */
  periodo: string | null;
  m2: number | null;
  resumen: string;
  alcance: string[];
  /** Slugs de `servicios.ts`. */
  servicios: string[];
  /** Slug de `zonas.ts`, si la comuna tiene página. */
  zona: string | null;
  fotos: FotoObra[];
  /** Datos por pedir a Jorge. No se publica. */
  pendiente: string[];
}

const NESTLE_TENO = {
  mandante: "Nestlé Chile S.A.",
  comuna: "Teno",
  region: "Región del Maule",
  periodo: null,
  m2: null,
  zona: "teno",
} as const;

export const OBRAS: Obra[] = [
  {
    ...NESTLE_TENO,
    slug: "nestle-teno-fundaciones-silos",
    titulo: "Fundaciones para silos de granos",
    tituloSeo: "Fundaciones de silos en planta Teno",
    resumen:
      "Armado de fierro circular y moldaje radial para fundaciones de silos de gran diámetro, dentro de una planta en operación.",
    alcance: [
      "Excavación con retroexcavadora",
      "Armadura circular y radial, espirales y zunchos",
      "Moldaje radial",
      "Pedestales armados",
    ],
    servicios: ["fundaciones-y-obra-civil-industrial", "movimiento-de-tierras-y-preparacion-de-terreno"],
    fotos: [
      { nombre: "silos-fundacion", alt: "Armadura circular de una fundación junto a tres silos metálicos" },
      { nombre: "silos-armadura", alt: "Trabajadores amarrando la armadura circular de una fundación" },
      { nombre: "silos-moldaje", alt: "Moldaje radial de madera sobre la armadura de fierro" },
      { nombre: "silos-excavacion", alt: "Retroexcavadora trabajando en la excavación de la fundación" },
      { nombre: "silos-pedestal", alt: "Armadura de un pedestal dentro de su excavación" },
    ],
    pendiente: ["Año", "Número y diámetro de silos"],
  },
  {
    ...NESTLE_TENO,
    slug: "expansion-batcheo-molienda-teno",
    titulo: "Expansión de batcheo y molienda",
    tituloSeo: "Expansión de batcheo y molienda en Teno",
    resumen:
      "Izado y posicionamiento de tanques industriales de polietileno y obras interiores en una planta en operación.",
    alcance: [
      "Izado y posicionamiento de tanques",
      "Instalaciones interiores",
      "Plataforma y pasarela industrial",
    ],
    servicios: ["montaje-e-izado-de-equipos", "estructuras-metalicas-y-montaje-industrial"],
    fotos: [
      { nombre: "batcheo-interior", alt: "Interior de la expansión con una plataforma de tijera entre muros en obra" },
      { nombre: "batcheo-izado", alt: "Tanque de polietileno suspendido durante el izado" },
      { nombre: "batcheo-silo", alt: "Silo blanco ya posicionado en el interior de la planta" },
      { nombre: "batcheo-pasarela", alt: "Pasarela industrial con baranda amarilla" },
    ],
    pendiente: ["Año", "Cantidad y capacidad de tanques"],
  },
  {
    ...NESTLE_TENO,
    slug: "alero-bodega-materias-primas-teno",
    titulo: "Alero de bodega de materias primas",
    tituloSeo: "Alero de bodega de materias primas, Teno",
    resumen: "Construcción del alero de la bodega de materias primas de la planta.",
    alcance: ["Construcción de alero", "Trabajo en altura con plataforma y andamio"],
    servicios: ["bodegas-y-ampliaciones-industriales", "cubiertas-y-revestimientos-industriales"],
    fotos: [
      { nombre: "alero-bodega", alt: "Bodega con el alero terminado y accesos de carga" },
      { nombre: "alero-lateral", alt: "Vista lateral de la bodega con equipos elevadores" },
      { nombre: "alero-andamio", alt: "Andamio junto al alero de la bodega" },
    ],
    pendiente: ["Año", "m² de alero"],
  },
  {
    ...NESTLE_TENO,
    slug: "revestimiento-ampliacion-bodega-teno",
    titulo: "Revestimiento de ampliación de bodega",
    tituloSeo: "Revestimiento de ampliación de bodega, Teno",
    resumen: "Revestimiento exterior de la ampliación de bodega, con la planta en operación.",
    alcance: ["Revestimiento de fachada", "Trabajo en altura con brazo articulado"],
    servicios: ["cubiertas-y-revestimientos-industriales", "bodegas-y-ampliaciones-industriales"],
    fotos: [
      { nombre: "revestimiento-brazo", alt: "Brazo articulado junto a la fachada de la ampliación" },
      { nombre: "revestimiento-avance", alt: "Fachada de la ampliación durante el revestimiento" },
      { nombre: "revestimiento-fachada", alt: "Equipo en terreno al pie de la fachada revestida" },
    ],
    pendiente: ["Año", "m² revestidos"],
  },
  {
    slug: "miguel-torres-bodega-cubas",
    titulo: "Bodega de cubas y mantención",
    tituloSeo: "Bodega de cubas Viña Miguel Torres, Curicó",
    mandante: "Vinícola Miguel Torres",
    comuna: "Curicó",
    region: "Región del Maule",
    periodo: "Desde 2000",
    m2: null,
    resumen:
      "Bodega de cubas, traslado de cubas entre plantas, portería central, mejoramiento de riles y mantención permanente.",
    alcance: [
      "Bodega de cubas, segunda etapa",
      "Traslado de 14 cubas de 50.000 litros entre plantas",
      "Portería central",
      "Mejoramiento de riles en plantas 1 y 2, recibido en 2020",
      "Mantención permanente",
    ],
    servicios: [
      "fundaciones-y-obra-civil-industrial",
      "montaje-e-izado-de-equipos",
      "bodegas-y-ampliaciones-industriales",
      "mantencion-industrial-y-refuerzo-estructural",
    ],
    zona: "curico",
    fotos: [],
    pendiente: ["Fotos", "Años de cada obra", "m² de bodega"],
  },
  {
    slug: "cementos-biobio-mantencion",
    titulo: "Obras civiles en planta cementera",
    tituloSeo: "Obras civiles Cementos Biobío, Teno",
    mandante: "Cementos Biobío Centro S.A.",
    comuna: "Teno",
    region: "Región del Maule",
    periodo: "Desde 2002",
    m2: null,
    resumen: "Sala eléctrica, muro de contención, cierres perimetrales, pavimentos y veredas. Contrato activo.",
    alcance: ["Sala eléctrica", "Muro de contención", "Cierres perimetrales", "Pavimentos y veredas"],
    servicios: ["fundaciones-y-obra-civil-industrial", "pavimentos-industriales"],
    zona: "teno",
    fotos: [],
    pendiente: ["Fotos", "Años de cada obra"],
  },
  {
    slug: "iansagro-mantencion-industrial",
    titulo: "Mantención de infraestructura industrial",
    tituloSeo: "Mantención industrial Iansagro",
    mandante: "Iansagro S.A.",
    comuna: "Curicó",
    region: "Región del Maule",
    periodo: null,
    m2: null,
    resumen: "Contrato de mantención permanente de estructuras, pavimentos e infraestructura industrial.",
    alcance: ["Mantención de estructuras", "Pavimentos", "Cubierta de silos"],
    servicios: [
      "mantencion-industrial-y-refuerzo-estructural",
      "pavimentos-industriales",
      "cubiertas-y-revestimientos-industriales",
    ],
    zona: "curico",
    fotos: [],
    pendiente: ["Fotos", "Comuna: Curicó o Linares", "Desde qué año"],
  },
  {
    slug: "surfrut-romeral-obras",
    titulo: "Obras civiles y montajes agroindustriales",
    tituloSeo: "Obras y montajes Surfrut Romeral",
    mandante: "Surfrut",
    comuna: "Romeral",
    region: "Región del Maule",
    periodo: null,
    m2: null,
    resumen:
      "Canalización de ductos, cámaras y piscinas para almacenamiento de fruta, cambio de cubierta de galpón y montajes estructurales.",
    alcance: [
      "Canalización de ductos",
      "Cámaras y piscinas de fruta",
      "Cambio de cubierta de galpón",
      "Montajes estructurales",
    ],
    servicios: ["estructuras-metalicas-y-montaje-industrial", "cubiertas-y-revestimientos-industriales"],
    zona: "romeral",
    fotos: [],
    pendiente: ["Fotos", "Años de cada obra"],
  },
];

export const OBRAS_CON_FOTO = OBRAS.filter((o) => o.fotos.length > 0);
export const OBRAS_SIN_FOTO = OBRAS.filter((o) => o.fotos.length === 0);

export function getObra(slug: string): Obra | undefined {
  return OBRAS.find((o) => o.slug === slug);
}

export function obrasDeServicio(slug: string): Obra[] {
  return OBRAS.filter((o) => o.servicios.includes(slug));
}

export function obrasDeZona(slug: string): Obra[] {
  return OBRAS.filter((o) => o.zona === slug);
}

/** Otros clientes que nombra la presentación, sin ficha propia. */
export const OTROS_CLIENTES = [
  "Constructora Ingevec",
  "Indura S.A.",
  "Impromel Ltda.",
  "Viña Valdivieso, Lontué",
  "T y T Export",
];

/** Obras con respaldo que aún no tienen ficha. */
export const OTRAS_OBRAS = [
  "Nestlé San Fernando y Graneros: galpón de alimentos infantiles, segunda etapa, y fundación de secador Jumbo.",
  "Nestlé Teno: cobertizo de recepción de grasas y aceites, pavimentos y movimiento de tierras.",
];
