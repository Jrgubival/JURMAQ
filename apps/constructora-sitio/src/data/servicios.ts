/**
 * Servicios de obra. Las partidas vienen del brochure 2026 de la empresa: no se
 * agregan normas, plazos ni capacidades que no estén ahí.
 */
import medidas from "./fotos.json";

export interface Servicio {
  slug: string;
  nombre: string;
  corto: string;
  /** Título SEO, máximo 45 caracteres antes de la marca. */
  tituloSeo: string;
  descripcion: string;
  intro: string;
  incluye: string[];
  /** Foto de cabecera, en `public/obras`. */
  foto: keyof typeof medidas;
}

export const SERVICIOS: Servicio[] = [
  {
    slug: "fundaciones-y-obra-civil-industrial",
    foto: "silos-moldaje",
    nombre: "Fundaciones y obra civil industrial",
    corto: "Fundaciones y obra civil",
    tituloSeo: "Fundaciones industriales en el Maule",
    descripcion:
      "Fundaciones especiales, hormigón armado y muros de contención para plantas industriales en Curicó, Teno y la Región del Maule.",
    intro:
      "Ejecutamos fundaciones especiales y hormigón armado para plantas agroindustriales y de alimentos, también con la planta en operación.",
    incluye: [
      "Fundaciones especiales",
      "Hormigón armado",
      "Muros de contención",
      "Obras en planta activa",
    ],
  },
  {
    slug: "estructuras-metalicas-y-montaje-industrial",
    foto: "batcheo-pasarela",
    nombre: "Estructuras metálicas y maestranza",
    corto: "Estructuras y maestranza",
    tituloSeo: "Estructuras metálicas y maestranza, Maule",
    descripcion:
      "Maestranza propia en la zona de Curicó: fabricación y montaje de vigas, columnas, pasarelas y soportes para equipos industriales.",
    intro:
      "Con maestranza propia fabricamos y montamos estructura de acero para plantas: vigas de gran sección, columnas, pasarelas y soportes de equipos.",
    incluye: [
      "Fabricación estructural",
      "Montaje de vigas y columnas",
      "Pasarelas industriales",
      "Soportes para equipos",
      "Soldadura y fabricación",
    ],
  },
  {
    slug: "montaje-e-izado-de-equipos",
    foto: "batcheo-izado",
    nombre: "Montaje e izado de equipos",
    corto: "Montaje e izado",
    tituloSeo: "Montaje e izado de equipos industriales",
    descripcion:
      "Izado y posicionamiento de silos, tanques y equipos industriales dentro de plantas activas en la Región del Maule y O'Higgins.",
    intro:
      "Izamos y posicionamos silos, tanques y recipientes de proceso dentro de plantas activas. Es un trabajo que exige planificación, equipos de izado y protocolos de seguridad.",
    incluye: [
      "Izado de equipos y maquinaria",
      "Posicionamiento de silos",
      "Montaje de estanques industriales",
      "Instalación de estructuras",
      "Maniobras industriales",
    ],
  },
  {
    slug: "bodegas-y-ampliaciones-industriales",
    foto: "alero-bodega",
    nombre: "Bodegas y ampliaciones industriales",
    corto: "Bodegas y ampliaciones",
    tituloSeo: "Bodegas y ampliaciones industriales, Maule",
    descripcion:
      "Construcción de bodegas, ampliaciones, cobertizos y aleros para plantas industriales, con mínimo impacto en la línea productiva.",
    intro:
      "Construimos y ampliamos bodegas, cobertizos y aleros en plantas que siguen operando, cuidando el impacto en la línea productiva.",
    incluye: [
      "Construcción de bodegas y ampliaciones",
      "Cobertizos y aleros industriales",
      "Obras complementarias a la medida",
      "Mínimo impacto en línea productiva",
    ],
  },
  {
    slug: "pavimentos-industriales",
    foto: "alero-lateral",
    nombre: "Pavimentos industriales",
    corto: "Pavimentos",
    tituloSeo: "Pavimentos industriales en el Maule",
    descripcion:
      "Pavimentos industriales y veredas para plantas en Curicó, Teno y la Región del Maule, como parte de obras civiles y mantención.",
    intro:
      "Ejecutamos pavimentos y veredas dentro de plantas industriales, como obra propia o como parte de contratos de obra civil y mantención.",
    incluye: ["Pavimentos industriales", "Pavimentos y veredas en planta", "Demoliciones y reposición"],
  },
  {
    slug: "cubiertas-y-revestimientos-industriales",
    foto: "revestimiento-brazo",
    nombre: "Cubiertas y revestimientos industriales",
    corto: "Cubiertas y revestimientos",
    tituloSeo: "Cubiertas y revestimientos industriales",
    descripcion:
      "Cambio de cubiertas, revestimientos de fachada y cierres perimetrales para galpones, silos y bodegas industriales en el Maule.",
    intro:
      "Cambiamos cubiertas y revestimos fachadas de galpones, silos y bodegas, con equipos de trabajo en altura y la planta en operación.",
    incluye: ["Cambio de cubiertas", "Revestimientos de fachada", "Cierres perimetrales"],
  },
  {
    slug: "mantencion-industrial-y-refuerzo-estructural",
    foto: "batcheo-interior",
    nombre: "Mantención industrial",
    corto: "Mantención industrial",
    tituloSeo: "Mantención industrial en Curicó y Maule",
    descripcion:
      "Mantención permanente de estructuras, pavimentos e infraestructura para plantas industriales en Curicó y la Región del Maule.",
    intro:
      "Atendemos contratos de mantención permanente de estructuras, pavimentos e infraestructura, con coordinación directa con la operación del cliente.",
    incluye: ["Mantención de estructuras", "Mantención de pavimentos", "Mantención de infraestructura industrial"],
  },
  {
    slug: "movimiento-de-tierras-y-preparacion-de-terreno",
    foto: "silos-excavacion",
    nombre: "Movimiento de tierras y preparación de terreno",
    corto: "Movimiento de tierras",
    tituloSeo: "Movimiento de tierras en Curicó y Maule",
    descripcion:
      "Excavaciones, nivelaciones, compactaciones y preparación de terreno para obras industriales en Curicó, Teno y la Región del Maule.",
    intro:
      "Preparamos el terreno de la obra con equipos propios: excavación, nivelación, compactación y demolición.",
    incluye: [
      "Excavaciones",
      "Nivelaciones",
      "Compactaciones",
      "Preparación de terreno",
      "Demoliciones y reposición",
    ],
  },
];

export function getServicio(slug: string): Servicio | undefined {
  return SERVICIOS.find((s) => s.slug === slug);
}
