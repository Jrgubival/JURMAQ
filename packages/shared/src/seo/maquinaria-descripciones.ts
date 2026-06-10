/**
 * Descripciones fallback para máquinas sin descripcion-larga en DB.
 *
 * El campo `maquinarias.descripcion` suele venir corto o vacío. Hasta que el
 * admin las enriquezca una por una desde el panel, este módulo proporciona
 * un párrafo descriptivo por TIPO de máquina con value-prop + casos de uso +
 * características técnicas genéricas.
 *
 * Uso:
 *   import { getMaquinariaDescripcion } from '@jurmaq/shared/seo/maquinaria-descripciones';
 *   const desc = getMaquinariaDescripcion(machine.tipo, machine.descripcion);
 */

type Tipo =
  | "retroexcavadora"
  | "miniexcavadora"
  | "brazo_articulado"
  | "alzahombre"
  | "minicargador"
  | "camion"
  | "otro";

interface DescripcionRich {
  intro: string;
  /** Bullets de casos de uso típicos */
  usos: string[];
  /** Bullets de características técnicas que el cliente debe saber */
  caracteristicas: string[];
  /** Incluye sin costo */
  incluye: string[];
}

const FALLBACKS: Record<Tipo, DescripcionRich> = {
  retroexcavadora: {
    intro:
      "Las retroexcavadoras son el equipo más versátil para obras civiles, agroindustriales y movimiento de tierras. Combinan brazo excavador (atrás) y pala cargadora (adelante) en un solo equipo, lo que reduce la cantidad de máquinas en obra.",
    usos: [
      "Excavación de fundaciones, zanjas y cámaras",
      "Carga de áridos sobre camión tolva",
      "Limpieza de terreno + nivelación liviana",
      "Demolición de obras civiles menores",
    ],
    caracteristicas: [
      "Operador certificado incluido en la tarifa",
      "Profundidad de excavación 4-6 m según modelo",
      "Capacidad balde frontal 0.9-1.2 m³",
      "Sistema hidráulico revisado cada 250 hrs",
    ],
    incluye: [
      "Mantención preventiva al día",
      "Seguro de daños a terceros",
      "Capacitación de uso al inicio de la obra",
    ],
  },
  miniexcavadora: {
    intro:
      "Las miniexcavadoras (también llamadas excavadoras compactas) son la solución para obras con acceso reducido: jardines, sótanos, calles angostas, patios interiores. Pesan entre 1.5 y 6 toneladas, lo que les permite trabajar donde una retroexcavadora no entra.",
    usos: [
      "Excavación en espacios confinados (jardines, patios)",
      "Trabajos en remodelaciones urbanas con poco acceso",
      "Zanjas para tendido eléctrico, agua potable y alcantarillado",
      "Movimiento de tierra en obras agrícolas pequeñas",
    ],
    caracteristicas: [
      "Pluma orientable que permite trabajar contra muros",
      "Cuchara intercambiable según faena",
      "Operación con cabina cerrada o canopy",
      "Bajo consumo y bajo impacto sobre pavimento",
    ],
    incluye: [
      "Mantención preventiva al día",
      "Operador certificado incluido en la tarifa",
      "Coordinación de despacho dentro del Maule",
    ],
  },
  brazo_articulado: {
    intro:
      "Los brazos articulados (también conocidos como manlift o boom lift) son plataformas elevadoras móviles diseñadas para alcanzar puntos altos y de difícil acceso. Su brazo extensible permite posicionar al operador con precisión sobre obstáculos.",
    usos: [
      "Mantención de fachadas y estructuras industriales",
      "Instalación de luminarias, cámaras y señalética en altura",
      "Trabajos de pintura y revestimiento en edificios",
      "Podas de árboles altos en parques y predios industriales",
    ],
    caracteristicas: [
      "Alturas de trabajo entre 12 y 26 metros según modelo",
      "Plataforma con baranda perimetral y enganche de arnés",
      "Sistema de auto-nivelación para terrenos irregulares",
      "Controles redundantes en canastilla y base",
    ],
    incluye: [
      "Inspección técnica vigente",
      "Capacitación obligatoria para el operador",
      "Arnés y línea de vida en el equipo",
    ],
  },
  alzahombre: {
    intro:
      "Las plataformas elevadoras tipo tijera (también llamadas alzahombres) son ideales para trabajos en altura sobre superficies planas. Se elevan vertical sin desplazamiento lateral, lo que las hace seguras para tareas prolongadas en un mismo punto.",
    usos: [
      "Instalación y mantención de cielo falso",
      "Trabajos eléctricos en altura interior (bodegas, supermercados)",
      "Pintura y mantención de muros altos",
      "Picking en racks de altura en centros logísticos",
    ],
    caracteristicas: [
      "Alturas de plataforma desde 6 hasta 14 metros",
      "Operación eléctrica (uso interior sin contaminación)",
      "Capacidad de carga 230-450 kg según modelo",
      "Plataforma extensible y baranda batiente",
    ],
    incluye: [
      "Carga de baterías al inicio del arriendo",
      "Inspección visual previa al despacho",
      "Manual de uso en español",
    ],
  },
  minicargador: {
    intro:
      "Los minicargadores (skid-steer loaders) son equipos compactos de gran maniobrabilidad — giran sobre su eje. Cambiando el accesorio (balde, garra, barredora, retroexcavadora) se adaptan a múltiples faenas en obra.",
    usos: [
      "Carga y traslado de áridos en espacios reducidos",
      "Movimiento de escombros en demoliciones",
      "Acopio y distribución de tierra de cultivo",
      "Limpieza de bodegas y patios industriales",
    ],
    caracteristicas: [
      "Capacidad operativa 700-1500 kg según modelo",
      "Accesorios intercambiables en minutos (sistema universal)",
      "Cabina ROPS-FOPS para protección del operador",
      "Bajo perfil para acceder a puertas industriales estándar",
    ],
    incluye: [
      "Operador certificado incluido en la tarifa",
      "Balde estándar incluido en arriendo",
      "Accesorios extra cotizados por separado",
      "Mantención preventiva al día",
    ],
  },
  camion: {
    intro:
      "Los camiones tolva son indispensables para el traslado de áridos (gravilla, arena, ripio, escombros) entre la obra y el sitio de acopio o vertedero. Operamos camiones simples y doble tracción según la accesibilidad del terreno.",
    usos: [
      "Traslado de áridos desde la cantera a la obra",
      "Retiro de escombros y material excavado a botadero autorizado",
      "Suministro de relleno estructural compactado",
      "Traslado de tierra vegetal para áreas verdes",
    ],
    caracteristicas: [
      "Capacidad de 7-15 m³ según modelo",
      "Carrocería de tolva con descarga hidráulica",
      "Disponibilidad de tracción 4×2 y 6×4",
      "Conductor profesional con licencia A4/A5 vigente",
    ],
    incluye: [
      "Conductor incluido en la tarifa",
      "Combustible cotizado por separado o flat-rate por viaje",
      "Documentación SII al día (factura electrónica)",
    ],
  },
  otro: {
    intro:
      "Equipo especializado para faenas específicas. Cotizamos según las características de tu obra y revisamos disponibilidad en menos de 2 horas.",
    usos: [
      "Faenas que requieren equipo no estándar",
      "Proyectos con requerimientos técnicos específicos",
    ],
    caracteristicas: [
      "Especificaciones bajo demanda",
      "Soporte técnico de JURMAQ durante el arriendo",
    ],
    incluye: ["Mantención preventiva al día", "Seguro de daños a terceros"],
  },
};

/**
 * Devuelve la descripción enriquecida combinando la propia + el fallback por
 * tipo. Si la descripción de DB tiene más de 100 caracteres, se mantiene
 * y se le suma usos/caracteristicas/incluye del fallback.
 */
export function getMaquinariaDescripcion(
  tipo: string,
  descripcionDb?: string | null,
): DescripcionRich & { custom?: string } {
  const fallback = FALLBACKS[(tipo as Tipo) ?? "otro"] ?? FALLBACKS.otro;
  const custom = descripcionDb?.trim() && descripcionDb.trim().length > 30 ? descripcionDb.trim() : undefined;
  return {
    intro: custom ?? fallback.intro,
    usos: fallback.usos,
    caracteristicas: fallback.caracteristicas,
    incluye: fallback.incluye,
    custom,
  };
}

export type { DescripcionRich };
