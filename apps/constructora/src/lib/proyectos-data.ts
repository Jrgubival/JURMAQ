/**
 * Case studies de obras destacadas JURMAQ Constructora.
 *
 * Fuente única de verdad para:
 *   - `/proyectos` (hub) — grid de cards
 *   - `/proyectos/[slug]` — detail page por obra
 *   - `sitemap.ts` — URLs para indexar
 *
 * Reglas:
 * - Los slugs son URL-permanentes; cambiarlos rompe links indexados.
 * - `montoUF` y `duracion` deben coincidir con lo declarado en la home o
 *   quedar como `undefined`. Nunca inventar números que no estén
 *   públicamente respaldados.
 * - `imagenes` apunta a archivos en `public/images/proyectos/{slug}/`. Los
 *   archivos físicos deben subirse manualmente — Next dará 404 hasta que
 *   se carguen las fotos reales.
 */
import { LEGAL_INFO } from "@jurmaq/shared/seo";

export interface ProyectoCaseStudy {
  slug: string;
  cliente: string;
  /** Path al logo del cliente en `public/images/clientes/`. */
  clienteLogo?: string;
  titulo: string;
  ubicacion: string;
  ubicacionGeo?: { lat: number; lng: number };
  /** Año de inicio de la obra (string para soportar "2018" o "2023"). */
  anoInicio: string;
  /** Texto humano: "8 meses", "14 meses", "Contrato permanente". */
  duracion: string;
  /** Monto UF — solo declarado si la home lo respalda. */
  montoUF?: number;
  descripcionCorta: string;
  /** Markdown ~300-600 palabras. Renderizado plain en el detail. */
  descripcionLarga: string;
  /** Servicios entregados (chips en el hero). */
  servicios: string[];
  /** Tipos de maquinaria usados. Linkean a `/arriendo/{slug}` si el slug matchea TIPOS_MAQUINA. */
  maquinariaUsada: Array<{ nombre: string; tipoSlug?: string }>;
  /** Materiales principales suministrados desde barraca o adquiridos. */
  materialesPrincipales: string[];
  desafiosTecnicos: string[];
  resultados: string[];
  testimonio?: {
    autor: string;
    cargo: string;
    texto: string;
    rating: number;
  };
  /** Path a la imagen hero. Si el archivo no existe, el detail muestra placeholder navy. */
  imagenHero?: string;
  /** Galería 4-6 imágenes adicionales. */
  galeria?: string[];
  fechaPublicacion: string;
  destacado?: boolean;
  estado: "completado" | "en_curso";
}

/**
 * Obras reales documentadas.
 *
 * NOTA SOBRE FOTOS: Los paths `/images/proyectos/<slug>/*.jpg` están declarados
 * pero los archivos NO existen aún. Deben subirse manualmente por el cliente
 * (Jorge tiene las fotos reales de obra). Mientras tanto el detail page muestra
 * un placeholder navy con patrón geométrico.
 */
export const PROYECTOS: ProyectoCaseStudy[] = [
  {
    slug: "nestle-teno-fundaciones-silos",
    cliente: "Nestlé Chile",
    clienteLogo: "/images/clientes/nestle.png",
    titulo: "Fundaciones y Silos · Nestlé Teno",
    ubicacion: "Planta Nestlé, Teno · Región del Maule",
    ubicacionGeo: { lat: -34.8744, lng: -71.1644 },
    anoInicio: "2023",
    duracion: "14 meses",
    montoUF: 76000,
    descripcionCorta:
      "Fundaciones para silos de granos, expansión del área de batcheo y molienda, montaje de equipos, pavimentos y movimiento de tierras en planta operativa.",
    descripcionLarga:
      "Obra de gran envergadura ejecutada para Nestlé Chile en su planta de Teno, una de las instalaciones agroindustriales más relevantes del Maule. El proyecto contempló tres frentes paralelos: fundaciones especiales para los nuevos silos de almacenamiento de granos, expansión del área de batcheo y molienda, y montaje de equipos industriales con pavimentación complementaria.\n\nEl desafío principal fue coordinar el avance de obra con producción operativa: la planta no podía detener procesos críticos durante los 14 meses de ejecución, por lo que cada hito —desde el movimiento de tierras hasta el hormigonado masivo de las losas de fundación— se planificó en ventanas de bajo flujo. La cubicación final superó los UF 76.000, posicionándolo como uno de nuestros proyectos industriales más relevantes en la región.\n\nLa entrega final incluyó silos calibrados, batcheo expandido en un 35% sobre la capacidad original, y pavimentos industriales certificados para tráfico de camiones pesados. La obra fue recibida sin observaciones por la inspección técnica de Nestlé.",
    servicios: [
      "Movimiento de tierras",
      "Fundaciones especiales",
      "Hormigón armado",
      "Montaje estructural",
      "Pavimentos industriales",
    ],
    maquinariaUsada: [
      { nombre: "Retroexcavadora CAT 420F", tipoSlug: "retroexcavadora" },
      { nombre: "Camión tolva 14m³", tipoSlug: "camion-tolva" },
      { nombre: "Plataforma elevadora 16m", tipoSlug: "plataforma-elevadora" },
      { nombre: "Rodillo compactador 7T", tipoSlug: "rodillo" },
      { nombre: "Minicargador Bobcat S650", tipoSlug: "minicargador" },
    ],
    materialesPrincipales: [
      "Fierro estriado A63-42H",
      "Hormigón H-30",
      "Malla Acma C-188",
      "Perfiles metálicos IPE 200",
    ],
    desafiosTecnicos: [
      "Coordinación de obra sin detener producción operativa de la planta.",
      "Excavaciones profundas en sector con napa freática alta — requirió bombeo continuo.",
      "Hormigonado masivo de losas (>40 m³ por jornada) con curado controlado.",
      "Montaje de silos con tolerancias milimétricas para alineación con cintas transportadoras existentes.",
    ],
    resultados: [
      "+35% en capacidad de batcheo respecto a la planta original.",
      "Cero días de detención de producción durante los 14 meses de obra.",
      "Recepción final sin observaciones por la inspección técnica.",
      "Habilitación de 3 silos nuevos con capacidad combinada >8.000 toneladas.",
    ],
    imagenHero: "/images/proyectos/nestle-teno-fundaciones-silos/hero.jpg",
    galeria: [
      "/images/proyectos/nestle-teno-fundaciones-silos/01-fundaciones.jpg",
      "/images/proyectos/nestle-teno-fundaciones-silos/02-montaje.jpg",
      "/images/proyectos/nestle-teno-fundaciones-silos/03-pavimentos.jpg",
      "/images/proyectos/nestle-teno-fundaciones-silos/04-silos-final.jpg",
    ],
    fechaPublicacion: "2024-12-01",
    destacado: true,
    estado: "completado",
  },
  {
    slug: "miguel-torres-bodega-cubas",
    cliente: "Vinícola Miguel Torres",
    clienteLogo: "/images/clientes/miguel-torres.png",
    titulo: "Bodega de Cubas · Vinícola Miguel Torres",
    ubicacion: "Curicó · Región del Maule",
    ubicacionGeo: { lat: -34.9853, lng: -71.2367 },
    anoInicio: "2023",
    duracion: "8 meses",
    montoUF: 21000,
    descripcionCorta:
      "Construcción de bodega de cubas, traslado de cubas de 50.000 litros, portería central y obras civiles complementarias.",
    descripcionLarga:
      "Para Vinícola Miguel Torres ejecutamos la construcción completa de una bodega destinada a cubas de fermentación con capacidad de 50.000 litros cada una. El proyecto incluyó fundaciones especiales calculadas para soportar la carga estática de las cubas llenas, el traslado físico de las cubas existentes desde la antigua bodega, una nueva portería central de control de acceso y obras civiles complementarias.\n\nLa complejidad logística fue significativa: el traslado de las cubas se ejecutó durante una ventana de 72 horas fuera de la vendimia, coordinado con grúa de gran tonelaje y maniobras de precisión. El resto de la obra avanzó sin afectar el ciclo productivo de la viña.\n\nLa bodega quedó habilitada antes del inicio de la vendimia siguiente, con todas las cubas operativas y certificación sanitaria conforme.",
    servicios: [
      "Obras civiles",
      "Fundaciones especiales",
      "Traslado de equipos pesados",
      "Estructura metálica",
      "Cubierta industrial",
    ],
    maquinariaUsada: [
      { nombre: "Brazo articulado 18m", tipoSlug: "brazo-articulado" },
      { nombre: "Minicargador Bobcat S570", tipoSlug: "minicargador" },
      { nombre: "Retroexcavadora", tipoSlug: "retroexcavadora" },
    ],
    materialesPrincipales: [
      "Cemento alta resistencia",
      "Acero estructural",
      "Planchas zincalum",
      "Aislación térmica",
    ],
    desafiosTecnicos: [
      "Fundaciones calculadas para carga estática de cubas llenas (50.000 lts cada una).",
      "Traslado de cubas en ventana de 72 horas fuera de vendimia.",
      "Coordinación con producción vinícola activa durante 7 de los 8 meses.",
      "Aislación térmica para mantener temperatura controlada durante fermentación.",
    ],
    resultados: [
      "Bodega entregada antes del inicio de la vendimia siguiente.",
      "Cubas trasladadas sin daños y operativas al 100%.",
      "Cero impacto sobre el ciclo productivo de la viña.",
      "Portería central habilitada para control de acceso 24/7.",
    ],
    imagenHero: "/images/proyectos/miguel-torres-bodega-cubas/hero.jpg",
    galeria: [
      "/images/proyectos/miguel-torres-bodega-cubas/01-fundaciones.jpg",
      "/images/proyectos/miguel-torres-bodega-cubas/02-traslado.jpg",
      "/images/proyectos/miguel-torres-bodega-cubas/03-cubas-instaladas.jpg",
    ],
    fechaPublicacion: "2024-09-15",
    estado: "completado",
  },
  {
    slug: "iansagro-mantencion-industrial",
    cliente: "Iansagro S.A.",
    clienteLogo: "/images/clientes/iansa.webp",
    titulo: "Mantención Industrial · Iansagro",
    ubicacion: "Linares · Región del Maule",
    ubicacionGeo: { lat: -35.8475, lng: -71.5933 },
    anoInicio: "2020",
    duracion: "Contrato permanente",
    montoUF: 6000,
    descripcionCorta:
      "Mantención permanente de estructuras, pavimentos, cubierta silos y obras complementarias para Iansagro en la zona del Maule.",
    descripcionLarga:
      "Iansagro S.A. confía a JURMAQ la mantención permanente de obras civiles e industriales en sus instalaciones del Maule. El contrato cubre intervenciones recurrentes sobre estructuras de hormigón, pavimentos industriales, cubierta de silos azucareros y obras complementarias que aparecen como necesidad de mantención durante la operación diaria.\n\nEsta modalidad de contrato permanente requiere disponibilidad inmediata de cuadrillas, maquinaria propia y stock de materiales — exactamente lo que JURMAQ ofrece desde su base en Maquehua, a menos de 60 km de la planta. La cubicación anual supera de forma sostenida las UF 6.000.\n\nA diferencia de una obra puntual, este tipo de contrato exige relación de confianza de largo plazo, respuesta rápida ante eventualidades y conocimiento profundo de las instalaciones del cliente. Llevamos varios años acumulados de operación sin interrupciones.",
    servicios: [
      "Mantención estructural",
      "Reparación de pavimentos",
      "Cubierta de silos",
      "Obras civiles complementarias",
      "Respuesta de emergencia",
    ],
    maquinariaUsada: [
      { nombre: "Retroexcavadora", tipoSlug: "retroexcavadora" },
      { nombre: "Brazo articulado", tipoSlug: "brazo-articulado" },
      { nombre: "Plataforma elevadora", tipoSlug: "plataforma-elevadora" },
      { nombre: "Minicargador", tipoSlug: "minicargador" },
    ],
    materialesPrincipales: [
      "Hormigón pavimento industrial",
      "Acero estructural reparación",
      "Sellantes industriales",
      "Pinturas anticorrosivas",
    ],
    desafiosTecnicos: [
      "Intervenciones siempre con planta en operación — ventanas estrechas.",
      "Stock de respuesta inmediata para emergencias sin programación previa.",
      "Trabajos en altura sobre silos con protocolos de seguridad estrictos.",
      "Coordinación con múltiples áreas operativas internas del cliente.",
    ],
    resultados: [
      "Contrato renovado anualmente desde el inicio de la relación.",
      "Cero accidentes graves registrados en obras de mantención.",
      "Tiempos de respuesta ante emergencias <24 horas.",
      "Stock de materiales y maquinaria propia para no depender de terceros.",
    ],
    imagenHero: "/images/proyectos/iansagro-mantencion-industrial/hero.jpg",
    galeria: [
      "/images/proyectos/iansagro-mantencion-industrial/01-cubierta.jpg",
      "/images/proyectos/iansagro-mantencion-industrial/02-pavimentos.jpg",
      "/images/proyectos/iansagro-mantencion-industrial/03-estructura.jpg",
    ],
    fechaPublicacion: "2024-06-01",
    estado: "en_curso",
  },
  {
    slug: "surfrut-romeral-obras",
    cliente: "Surfrut",
    clienteLogo: "/images/clientes/surfrut.svg",
    titulo: "Bodega Refrigerada · Surfrut Romeral",
    ubicacion: "Romeral · Región del Maule",
    ubicacionGeo: { lat: -34.9667, lng: -71.1417 },
    anoInicio: "2024",
    duracion: "5 meses",
    montoUF: 14200,
    descripcionCorta:
      "Construcción de bodega refrigerada de 1.800 m² con cámaras a -25°C para almacenamiento de fruta congelada.",
    descripcionLarga:
      "Surfrut, uno de los principales procesadores de fruta del Maule, requería una nueva bodega refrigerada de gran escala para complementar su capacidad de almacenamiento de fruta congelada. JURMAQ ejecutó la obra civil completa: fundaciones, estructura, cubierta, pisos industriales con tratamiento epóxico, y los muelles de carga para camiones refrigerados.\n\nLa coordinación con los instaladores de equipos de refrigeración fue clave: cada partida —pisos, paredes con paneles aislantes, cubierta— debía entregarse en secuencia precisa para que el sistema de cámaras frigoríficas pudiera instalarse sin retrabajos.\n\nLa bodega quedó operativa con 1.800 m² útiles y cámaras certificadas a -25°C, permitiendo a Surfrut ampliar significativamente su capacidad de almacenamiento durante la temporada alta de cosecha.",
    servicios: [
      "Obras civiles",
      "Fundaciones",
      "Pisos industriales epóxicos",
      "Estructura metálica",
      "Muelles de carga",
    ],
    maquinariaUsada: [
      { nombre: "Plataforma articulada 22m", tipoSlug: "brazo-articulado" },
      { nombre: "Minicargador Caterpillar 232D", tipoSlug: "minicargador" },
      { nombre: "Retroexcavadora", tipoSlug: "retroexcavadora" },
      { nombre: "Camión tolva", tipoSlug: "camion-tolva" },
    ],
    materialesPrincipales: [
      "Paneles aislantes 200mm",
      "Piso epóxico industrial",
      "Hormigón H-30 con fibras",
      "Acero estructural",
    ],
    desafiosTecnicos: [
      "Pisos industriales con tratamiento epóxico — secado controlado por humedad ambiente.",
      "Aislación térmica continua sin puentes térmicos para mantener -25°C.",
      "Coordinación con instaladores de equipos de refrigeración en cada partida.",
      "Muelles de carga con sellos para camiones refrigerados.",
    ],
    resultados: [
      "1.800 m² útiles entregados certificados a -25°C.",
      "Cero retrabajos coordinados con instalación de equipos de refrigeración.",
      "Habilitación previa al inicio de la temporada alta de cosecha.",
      "Capacidad de almacenamiento ampliada significativamente sobre la planta original.",
    ],
    imagenHero: "/images/proyectos/surfrut-romeral-obras/hero.jpg",
    galeria: [
      "/images/proyectos/surfrut-romeral-obras/01-estructura.jpg",
      "/images/proyectos/surfrut-romeral-obras/02-paneles.jpg",
      "/images/proyectos/surfrut-romeral-obras/03-pisos.jpg",
      "/images/proyectos/surfrut-romeral-obras/04-final.jpg",
    ],
    fechaPublicacion: "2024-11-10",
    estado: "completado",
  },
  {
    slug: "cementos-biobio-mantencion",
    cliente: "Cementos Biobío (CBB)",
    clienteLogo: "/images/clientes/cbb-cementos.png",
    titulo: "Modernización Silos · Cementos Biobío",
    ubicacion: "Curicó · Región del Maule",
    ubicacionGeo: { lat: -34.9853, lng: -71.2367 },
    anoInicio: "2024",
    duracion: "4 meses",
    montoUF: 9800,
    descripcionCorta:
      "Modernización de silos de cemento, instalación de nueva tolva de descarga y obras civiles complementarias en planta CBB.",
    descripcionLarga:
      "Cementos Biobío encargó a JURMAQ la modernización de sus silos en la planta de Curicó. El proyecto contempló refuerzo estructural de los silos existentes, instalación de una nueva tolva de descarga y obras civiles complementarias para mejorar la operación logística de carga de camiones.\n\nTrabajar en una planta cementera activa exige planificación rigurosa: cada intervención sobre los silos debía coordinarse con paradas técnicas programadas, y las obras civiles complementarias avanzaron en paralelo sin afectar el flujo de camiones de despacho.\n\nLa obra se entregó dentro del plazo de 4 meses, con la nueva tolva operativa y los silos reforzados estructuralmente para extender su vida útil otra década.",
    servicios: [
      "Refuerzo estructural",
      "Montaje industrial",
      "Obras civiles",
      "Estructuras metálicas",
    ],
    maquinariaUsada: [
      { nombre: "Brazo articulado 26m", tipoSlug: "brazo-articulado" },
      { nombre: "Camión tolva 12m³", tipoSlug: "camion-tolva" },
      { nombre: "Plataforma elevadora", tipoSlug: "plataforma-elevadora" },
    ],
    materialesPrincipales: [
      "Perfiles estructurales",
      "Fierro estriado especial",
      "Hormigón armado",
      "Anticorrosivos industriales",
    ],
    desafiosTecnicos: [
      "Trabajos en altura sobre silos en operación.",
      "Coordinación con paradas técnicas programadas para intervenciones críticas.",
      "Refuerzo estructural sin descargar los silos completamente.",
      "Continuidad del despacho de camiones durante toda la obra.",
    ],
    resultados: [
      "Silos con vida útil extendida estructuralmente.",
      "Nueva tolva de descarga operativa al final del plazo.",
      "Cero detenciones imprevistas durante la obra.",
      "Entrega dentro de los 4 meses comprometidos.",
    ],
    imagenHero: "/images/proyectos/cementos-biobio-mantencion/hero.jpg",
    galeria: [
      "/images/proyectos/cementos-biobio-mantencion/01-silos.jpg",
      "/images/proyectos/cementos-biobio-mantencion/02-tolva.jpg",
      "/images/proyectos/cementos-biobio-mantencion/03-refuerzo.jpg",
    ],
    fechaPublicacion: "2025-02-20",
    estado: "completado",
  },
];

/**
 * Lookup por slug — usado por `/proyectos/[slug]/page.tsx` y `generateStaticParams`.
 */
export function getProyectoBySlug(slug: string): ProyectoCaseStudy | undefined {
  return PROYECTOS.find((p) => p.slug === slug);
}

/**
 * Agregados sobre el set — usado en el hub `/proyectos` para los stats del hero.
 */
export function getProyectosStats() {
  const totalUF = PROYECTOS.reduce((s, p) => s + (p.montoUF ?? 0), 0);
  const totalObras = PROYECTOS.length;
  const clientesUnicos = new Set(PROYECTOS.map((p) => p.cliente)).size;
  return { totalUF, totalObras, clientesUnicos };
}

/**
 * URL canonical de un case study — usado en JSON-LD Article y sitemap.
 *
 * Vive en constructora.jurmaq.cl, no en el hub: los case studies son el activo
 * de conversión B2B del subdominio de obras civiles. jurmaq.cl/proyectos/* hace
 * 301 hacia acá (ver middleware), así que no hay contenido duplicado y el
 * posicionamiento que tenía el hub se traspasa al subdominio.
 */
export function getProyectoUrl(slug: string): string {
  return `https://constructora.jurmaq.cl/proyectos/${slug}`;
}

/**
 * Referencia legal para JSON-LD Organization en cada case study.
 * Importado desde shared para evitar duplicación de nombre/razón social.
 */
export const PROVEEDOR_JSONLD = {
  "@type": "Organization",
  "@id": "https://jurmaq.cl/#organization",
  name: LEGAL_INFO.nombreComercial,
  legalName: LEGAL_INFO.nombreLegal,
  url: "https://jurmaq.cl",
} as const;
