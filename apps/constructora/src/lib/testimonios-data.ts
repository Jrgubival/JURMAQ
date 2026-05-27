/**
 * Testimonios/reviews públicos de clientes B2B de JURMAQ Constructora.
 *
 * # Estado actual: PLACEHOLDER ESTÁTICO
 *
 * Esta lista es la fuente de datos provisional para el componente
 * `<TestimoniosGrid />` mientras la tabla `constructora_testimonios` no se
 * crea en Supabase. Una vez que la migration
 * `supabase/migrations/2026_05_27_constructora_testimonios.sql` se aplique
 * y se carguen testimonios reales, el componente debe cambiar a leer desde
 * la BD vía `supabasePublic.from('constructora_testimonios').select(...)`.
 *
 * # IMPORTANTE
 *
 * Los textos a continuación son ejemplos REALISTAS pero NO atribuidos a
 * personas reales que hayan firmado el testimonio. Antes de publicar en
 * producción Jorge debe confirmar:
 *   1. Que tiene autorización escrita de cada autor para usar su nombre y cargo.
 *   2. O reemplazar con testimonios reales que sí estén firmados.
 *
 * Mientras tanto el grid se ve poblado y la maquetación es navegable.
 */

export interface ConstructoraTestimonio {
  id: string;
  autorNombre: string;
  autorCargo: string;
  autorEmpresa: string;
  /** Path al logo de la empresa en `/images/clientes/`. */
  empresaLogo?: string;
  /** Texto del testimonio. Ideal 40-90 palabras. */
  texto: string;
  /** Rating 1-5. Casi todos 5 — testimonios negativos no van en marketing. */
  rating: number;
  /** Si el testimonio refiere a una obra específica, link al case study. */
  proyectoSlug?: string;
  /** ISO date — la "fecha del testimonio" para schema.org. */
  fecha: string;
  /** Marcar `true` para mostrar primero en la grilla. Solo 1-2 destacados máximo. */
  destacado?: boolean;
}

export const TESTIMONIOS: ConstructoraTestimonio[] = [
  {
    id: "nestle-2024",
    autorNombre: "Equipo de Proyectos · Planta Teno",
    autorCargo: "Inspección Técnica de Obra",
    autorEmpresa: "Nestlé Chile",
    empresaLogo: "/images/clientes/nestle.png",
    texto:
      "Coordinaron las fundaciones de silos y la expansión de batcheo sin detener un solo día la producción. Cumplieron plazo y entregaron la obra sin observaciones técnicas. Esa combinación de capacidad operativa y disciplina de plazos es lo que buscamos en un partner industrial.",
    rating: 5,
    proyectoSlug: "nestle-teno-fundaciones-silos",
    fecha: "2024-12-15",
    destacado: true,
  },
  {
    id: "miguel-torres-2024",
    autorNombre: "Gerencia de Operaciones",
    autorCargo: "Vinícola Miguel Torres",
    autorEmpresa: "Vinícola Miguel Torres",
    empresaLogo: "/images/clientes/miguel-torres.png",
    texto:
      "El traslado de las cubas de 50.000 litros fue impecable. Lograron coordinar la maniobra en la ventana de 72 horas que necesitábamos fuera de vendimia, sin un solo daño. La bodega quedó habilitada antes del inicio de la temporada siguiente.",
    rating: 5,
    proyectoSlug: "miguel-torres-bodega-cubas",
    fecha: "2024-10-02",
  },
  {
    id: "iansagro-2024",
    autorNombre: "Jefatura de Mantención",
    autorCargo: "Planta Iansagro Maule",
    autorEmpresa: "Iansagro S.A.",
    empresaLogo: "/images/clientes/iansa.webp",
    texto:
      "Llevamos varios años con JURMAQ como contratista de mantención permanente. Lo que más valoramos es la respuesta rápida ante emergencias — tienen cuadrilla y maquinaria disponible siempre, sin depender de terceros. Ese tipo de confiabilidad es difícil de encontrar.",
    rating: 5,
    proyectoSlug: "iansagro-mantencion-industrial",
    fecha: "2024-08-20",
    destacado: true,
  },
  {
    id: "surfrut-2024",
    autorNombre: "Gerencia Técnica",
    autorCargo: "Surfrut Romeral",
    autorEmpresa: "Surfrut",
    empresaLogo: "/images/clientes/surfrut.svg",
    texto:
      "La bodega refrigerada de 1.800 m² se entregó antes del inicio de la cosecha. Coordinaron impecablemente con nuestros instaladores de equipos de refrigeración — cero retrabajos. Las cámaras certificaron -25°C en la primera medición.",
    rating: 5,
    proyectoSlug: "surfrut-romeral-obras",
    fecha: "2024-11-25",
  },
  {
    id: "cbb-2025",
    autorNombre: "Equipo de Ingeniería",
    autorCargo: "Cementos Biobío Curicó",
    autorEmpresa: "Cementos Biobío (CBB)",
    empresaLogo: "/images/clientes/cbb-cementos.png",
    texto:
      "Modernizamos los silos y la nueva tolva sin detener el despacho de camiones. JURMAQ supo coordinar sus intervenciones con nuestras paradas técnicas programadas. Plazo de 4 meses cumplido exactamente.",
    rating: 5,
    proyectoSlug: "cementos-biobio-mantencion",
    fecha: "2025-03-10",
  },
  {
    id: "constructora-general-2023",
    autorNombre: "Gerencia",
    autorCargo: "Empresa Agroindustrial · Curicó",
    autorEmpresa: "Cliente histórico",
    texto:
      "Trabajamos con JURMAQ desde hace más de 8 años. Lo que los diferencia es que cubren todas las áreas: obra civil, arriendo de máquinas, maestranza y materiales desde su barraca. Un solo proveedor responde por el ciclo completo de cada obra. Reduce coordinación a la mitad.",
    rating: 5,
    fecha: "2023-11-05",
  },
];

/**
 * Helpers de agregación — usados en JSON-LD AggregateRating y el subtítulo
 * del componente.
 */
export function getTestimoniosStats() {
  const total = TESTIMONIOS.length;
  const promedioRating =
    total > 0
      ? Number((TESTIMONIOS.reduce((s, t) => s + t.rating, 0) / total).toFixed(1))
      : 0;
  return { total, promedioRating };
}

/**
 * Subset destacado para la home (3 testimonios — los marcados como `destacado:true`
 * más el primero adicional para completar 3).
 */
export function getTestimoniosDestacados(limite = 3): ConstructoraTestimonio[] {
  const destacados = TESTIMONIOS.filter((t) => t.destacado);
  if (destacados.length >= limite) return destacados.slice(0, limite);
  const resto = TESTIMONIOS.filter((t) => !t.destacado);
  return [...destacados, ...resto].slice(0, limite);
}
