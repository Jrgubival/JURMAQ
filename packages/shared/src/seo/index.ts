/**
 * SEO landing-page data — used by /arriendo/[tipo], /arriendo-en/[ciudad]
 * and /barraca/en/[ciudad] to generate static landings with unique content
 * for each machine type and city served.
 *
 * Each entry must have unique copy / facts / context so Google does NOT treat
 * them as doorway pages.
 */

import { TIPOS_DB_CON_OPERADOR } from "./operador";

// Re-export del lookup table de distancias auto-generado.
// Para regenerar: `node scripts/calc-distancias.mjs`
export {
  DISTANCIAS_BARRACA,
  DISTANCIAS_CONSTRUCTORA,
} from "./distancias.generated";

// Helper compartido para construir Next.js Metadata sin repetir boilerplate.
// Ver `metadata.ts` para uso, decisiones de diseño y cuándo NO usarlo.
export {
  buildPageMetadata,
  type Brand,
  type BuildPageMetadataOptions,
} from "./metadata";

export interface CiudadSEO {
  slug: string;
  nombre: string;
  comuna: string;
  provincia: string;
  region: string;
  poblacion?: number;
  /** WGS84 lat/lng del centro de la comuna. Usado en JSON-LD HardwareStore.geo
   *  para SEO local (Google Maps Pack, Knowledge Graph). */
  lat: number;
  lng: number;
  comunasVecinas: string[];
  contextoLocal: string; // para usar en H1 / descripciones
  rubroLocal: string[]; // sectores económicos donde típicamente trabajamos
}

/**
 * Lista de ciudades servidas — fuente de verdad para LANDINGS SEO.
 *
 * Distancia y tiempo de despacho NO viven aquí: están en
 * `distancias.generated.ts` (auto-generado por scripts/calc-distancias.mjs
 * usando OSRM, mismo motor que el calculador de flete runtime).
 * Importar `DISTANCIAS_BARRACA` o `DISTANCIAS_CONSTRUCTORA` y hacer
 * lookup por `ciudad.slug`.
 */
export const CIUDADES: CiudadSEO[] = [
  {
    slug: "curico",
    lat: -34.9853,
    lng: -71.2367,
    nombre: "Curicó",
    comuna: "Curicó",
    provincia: "Curicó",
    region: "Maule",
    poblacion: 149136,
    comunasVecinas: ["Romeral", "Teno", "Sagrada Familia", "Molina"],
    contextoLocal:
      "Capital de la Provincia de Curicó. Fuerte actividad agroindustrial (vinícolas, conserveras, jugos), retail y construcción habitacional/comercial.",
    rubroLocal: ["agroindustria", "construcción inmobiliaria", "retail", "vitivinícola"],
  },
  {
    slug: "molina",
    lat: -35.1147,
    lng: -71.2839,
    nombre: "Molina",
    comuna: "Molina",
    provincia: "Curicó",
    region: "Maule",
    poblacion: 47148,
    comunasVecinas: ["Lontué", "Sagrada Familia", "Curicó"],
    contextoLocal:
      "Sede de JURMAQ. Zona vitivinícola con presencia de viñas históricas, agroindustria frutícola y obras de infraestructura vial.",
    rubroLocal: ["vitivinícola", "agroindustria frutícola", "infraestructura vial"],
  },
  {
    slug: "teno",
    lat: -34.8744,
    lng: -71.1644,
    nombre: "Teno",
    comuna: "Teno",
    provincia: "Curicó",
    region: "Maule",
    poblacion: 28796,
    comunasVecinas: ["Curicó", "Romeral", "Rauco"],
    contextoLocal:
      "Comuna agrícola con producción frutícola intensiva (manzanas, kiwis, cerezas). Obras rurales, packing y bodegaje frecuentes.",
    rubroLocal: ["frutícola", "packing y bodegaje", "obras rurales"],
  },
  {
    slug: "romeral",
    lat: -34.9667,
    lng: -71.1417,
    nombre: "Romeral",
    comuna: "Romeral",
    provincia: "Curicó",
    region: "Maule",
    poblacion: 14600,
    comunasVecinas: ["Curicó", "Teno"],
    contextoLocal:
      "Comuna precordillerana con fuerte presencia agroindustrial (Surfrut, secaderos), turismo rural y movimiento de tierras en proyectos de regadío.",
    rubroLocal: ["agroindustria", "turismo rural", "regadío y movimiento de tierras"],
  },
  {
    slug: "sagrada-familia",
    lat: -35.0019,
    lng: -71.3853,
    nombre: "Sagrada Familia",
    comuna: "Sagrada Familia",
    provincia: "Curicó",
    region: "Maule",
    poblacion: 18472,
    comunasVecinas: ["Molina", "Curicó", "Hualañé"],
    contextoLocal:
      "Comuna agrícola con tradición vitivinícola (Lontué, Caune). Obras menores de infraestructura rural y conservación de caminos.",
    rubroLocal: ["vitivinícola", "agrícola", "infraestructura rural"],
  },
  {
    slug: "hualane",
    lat: -34.9744,
    lng: -71.8,
    nombre: "Hualañé",
    comuna: "Hualañé",
    provincia: "Curicó",
    region: "Maule",
    poblacion: 9740,
    comunasVecinas: ["Sagrada Familia", "Licantén", "Vichuquén"],
    contextoLocal:
      "Comuna del valle del Mataquito, conexión hacia la costa. Trabajos en infraestructura caminera, agroindustria y proyectos habitacionales rurales.",
    rubroLocal: ["agrícola", "infraestructura vial", "habitacional rural"],
  },
  {
    slug: "licanten",
    lat: -34.9819,
    lng: -72.0072,
    nombre: "Licantén",
    comuna: "Licantén",
    provincia: "Curicó",
    region: "Maule",
    poblacion: 6534,
    comunasVecinas: ["Hualañé", "Vichuquén"],
    contextoLocal:
      "Comuna costera-rural con producción forestal (eucaliptus, pino) y desembocadura del río Mataquito. Obras de caminos forestales y agrícolas.",
    rubroLocal: ["forestal", "agrícola", "caminos rurales"],
  },
  {
    slug: "vichuquen",
    lat: -34.8814,
    lng: -72.05,
    nombre: "Vichuquén",
    comuna: "Vichuquén",
    provincia: "Curicó",
    region: "Maule",
    poblacion: 4916,
    comunasVecinas: ["Hualañé", "Licantén"],
    contextoLocal:
      "Comuna costera turística con desarrollos habitacionales en Lago Vichuquén e Iloca. Obras estacionales de construcción habitacional y caminos.",
    rubroLocal: ["turismo costero", "habitacional", "caminos rurales"],
  },
  {
    slug: "rauco",
    lat: -34.9322,
    lng: -71.3092,
    nombre: "Rauco",
    comuna: "Rauco",
    provincia: "Curicó",
    region: "Maule",
    poblacion: 9670,
    comunasVecinas: ["Curicó", "Teno"],
    contextoLocal:
      "Comuna agrícola del valle central, fuerte producción frutícola (manzanas, kiwis, peras). Obras menores de infraestructura agrícola.",
    rubroLocal: ["frutícola", "agrícola", "infraestructura agrícola"],
  },
  {
    slug: "talca",
    lat: -35.4264,
    lng: -71.6553,
    nombre: "Talca",
    comuna: "Talca",
    provincia: "Talca",
    region: "Maule",
    poblacion: 220357,
    comunasVecinas: ["San Clemente", "Maule", "Pelarco"],
    contextoLocal:
      "Capital regional. Centro económico, industrial y comercial del Maule. Construcción inmobiliaria, retail, vitivinícola, infraestructura pública.",
    rubroLocal: ["inmobiliaria", "retail", "vitivinícola", "infraestructura pública"],
  },
  {
    slug: "linares",
    lat: -35.8475,
    lng: -71.5933,
    nombre: "Linares",
    comuna: "Linares",
    provincia: "Linares",
    region: "Maule",
    poblacion: 96680,
    comunasVecinas: ["Yerbas Buenas", "San Javier", "Longaví"],
    contextoLocal:
      "Centro agroindustrial al sur del Maule. Producción vitivinícola y frutícola, retail comercial y obras viales de la Ruta 5 Sur.",
    rubroLocal: ["agroindustria", "vitivinícola", "obras viales"],
  },
  {
    slug: "constitucion",
    lat: -35.3331,
    lng: -72.415,
    nombre: "Constitución",
    comuna: "Constitución",
    provincia: "Talca",
    region: "Maule",
    poblacion: 50166,
    comunasVecinas: ["Empedrado", "Maule"],
    contextoLocal:
      "Comuna costera con industria forestal y celulosa (Arauco). Reconstrucción post-tsunami con obras de infraestructura permanente.",
    rubroLocal: ["forestal", "celulosa", "infraestructura costera"],
  },
];

export interface TipoMaquinaSEO {
  slug: string;
  nombre: string;
  nombrePlural: string;
  tipoDb: string; // valor en columna "tipo" de tabla maquinarias
  /**
   * true = la tarifa publicada incluye operador/conductor de JURMAQ.
   * false = NO afirmamos operador incluido; para afirmar que lo opera el
   * cliente usar operaElCliente() de ./operador — rodillo/placa_compactadora
   * quedan sin afirmación alguna. El valor se deriva de TIPOS_DB_CON_OPERADOR
   * (fuente de verdad única en ./operador).
   */
  operadorIncluido: boolean;
  descripcionCorta: string;
  descripcionLarga: string;
  casosDeUso: string[];
  especificacionesClave: string[];
  preguntasFrecuentes: { q: string; a: string }[];
}

export const TIPOS_MAQUINA: TipoMaquinaSEO[] = [
  {
    slug: "retroexcavadora",
    nombre: "Retroexcavadora",
    nombrePlural: "Retroexcavadoras",
    tipoDb: "retroexcavadora",
    operadorIncluido: TIPOS_DB_CON_OPERADOR.has("retroexcavadora"),
    descripcionCorta:
      "Movimiento de tierras pesado, zanjas, fundaciones, carga de camiones.",
    descripcionLarga:
      "La retroexcavadora es la máquina más versátil para movimiento de tierras: combina cargador frontal y brazo retroexcavador. En JURMAQ contamos con retroexcavadoras HMK 102B y similares para obras de fundación, instalación de redes (agua potable, alcantarillado, fibra), apertura de zanjas, carga de áridos y demolición menor.",
    casosDeUso: [
      "Excavación de fundaciones para casas, edificios y galpones",
      "Apertura de zanjas para redes de agua potable, alcantarillado, electricidad o fibra",
      "Carga de camiones tolva con áridos, escombros o tierra",
      "Demolición ligera y movimiento de escombros",
      "Instalación de cámaras, fosas sépticas y tubos colectores",
    ],
    especificacionesClave: [
      "Profundidad de excavación: hasta 5,5 m",
      "Capacidad balde frontal: 1 m³ aprox",
      "Peso operacional: 7.500 – 8.500 kg",
      "Motor: 75–95 HP turbodiesel",
    ],
    preguntasFrecuentes: [
      {
        q: "¿Cuánto cuesta arrendar una retroexcavadora en Curicó?",
        a: "La tarifa es por hora (con mínimo de horas) e incluye operador certificado — no pagas el operador aparte. Cotiza por WhatsApp y te pasamos el valor exacto con disponibilidad inmediata.",
      },
      {
        q: "¿La retroexcavadora viene con operador?",
        a: "Sí, siempre. El arriendo incluye operador certificado con experiencia en obra, y su costo ya está dentro de la tarifa. La retroexcavadora la opera únicamente personal de JURMAQ — no se arrienda sola ni es posible operarla con personal propio.",
      },
      {
        q: "¿Hay traslado al sitio de obra?",
        a: "Sí. Llevamos la máquina directo a tu obra en Curicó, Molina, Teno, Romeral, Sagrada Familia, Talca y toda la Región del Maule. Coordinamos el traslado contigo al confirmar el arriendo.",
      },
    ],
  },
  {
    slug: "miniexcavadora",
    nombre: "Miniexcavadora",
    nombrePlural: "Miniexcavadoras",
    tipoDb: "miniexcavadora",
    operadorIncluido: TIPOS_DB_CON_OPERADOR.has("miniexcavadora"),
    descripcionCorta:
      "Excavación en espacios reducidos, jardines y pasajes estrechos. Modelos XCMG XE35U y similares.",
    descripcionLarga:
      "La miniexcavadora resuelve donde la retro no entra: pasajes angostos, jardines, ampliaciones internas y trabajos urbanos sin daño al entorno. En JURMAQ contamos con miniexcavadoras XCMG XE35U y modelos equivalentes — excelente precisión en excavación, bajo consumo de combustible y disponibles para arriendo en Curicó, Molina, Teno, Talca y toda la Región del Maule.",
    casosDeUso: [
      "Apertura de zanjas en pasajes y jardines",
      "Ampliaciones internas, piscinas y fosas sépticas",
      "Trabajos en obra urbana donde el espacio es limitado",
      "Reposición de redes en zonas residenciales",
      "Movimiento de tierra en obras de paisajismo",
    ],
    especificacionesClave: [
      "Peso operacional: 1.500 – 3.500 kg",
      "Profundidad excavación: 2,2 – 3,0 m",
      "Ancho de paso: desde 0,9 m (entra por puertas y portones)",
      "Combustible: diésel bajo consumo",
    ],
    preguntasFrecuentes: [
      {
        q: "¿Cuál es la diferencia entre miniexcavadora y retroexcavadora?",
        a: "La miniexcavadora es más compacta (1,5–3,5 ton vs 7,5+ ton de la retro), entra en pasajes angostos y opera sobre cualquier piso. La retro tiene más fuerza pero requiere mayor espacio.",
      },
      {
        q: "¿La miniexcavadora puede entrar a un patio residencial?",
        a: "Sí, las miniexcavadoras pequeñas pasan por puertas estándar (0,9 m de ancho) y trabajan en patios sin dañar el piso si se usa con planchas de protección.",
      },
      {
        q: "¿Necesito operador especializado?",
        a: "No necesitas conseguir uno: el arriendo incluye operador certificado de JURMAQ y su costo ya viene dentro de la tarifa. La miniexcavadora la opera únicamente nuestro operador — no se arrienda para operarla tú mismo.",
      },
    ],
  },
  {
    slug: "minicargador",
    nombre: "Minicargador",
    nombrePlural: "Minicargadores",
    tipoDb: "minicargador",
    operadorIncluido: TIPOS_DB_CON_OPERADOR.has("minicargador"),
    descripcionCorta:
      "Carga, transporte de áridos y multi-implementos en obra.",
    descripcionLarga:
      "El minicargador (Bobcat o similar) es el caballito de batalla en obra: carga áridos, transporta materiales, nivela, perfora con auger, limpia escombros y acepta múltiples implementos intercambiables. Versátil en construcción, agricultura y logística.",
    casosDeUso: [
      "Carga de áridos, escombros y materiales en obra",
      "Nivelación de terrenos para radieres y bases",
      "Perforación de hoyos con auger (postes, fundaciones cilíndricas)",
      "Limpieza y traslado de escombros en demolición",
      "Trabajos agrícolas (limpieza de canales, traslado de fardos)",
    ],
    especificacionesClave: [
      "Capacidad de carga: 800 – 1.150 kg",
      "Peso operacional: 2.500 – 3.300 kg",
      "Implementos: balde, horquillas, auger, escoba, retroexcavador",
      "Ancho: 1,8 m (cabe en obras estrechas)",
    ],
    preguntasFrecuentes: [
      {
        q: "¿Qué implementos vienen con el minicargador?",
        a: "Como base viene con balde estándar. Pueden agregarse horquillas, auger, escoba mecánica o retroexcavador con costo adicional según implemento.",
      },
      {
        q: "¿Cuánta carga levanta un Bobcat S650?",
        a: "El S650 levanta hasta 1.135 kg de carga útil. Para cargas mayores conviene un minicargador más grande o una retroexcavadora.",
      },
      {
        q: "¿Sirve para trabajos agrícolas?",
        a: "Sí. En viñas y huertos lo usan para limpieza de canales, traslado de cajas y mantención de caminos internos. Disponemos de modelos compactos para hileras estrechas.",
      },
      {
        q: "¿El minicargador incluye operador?",
        a: "Sí, siempre. La tarifa por hora incluye operador certificado de JURMAQ. El minicargador no se arrienda sin operador: lo opera únicamente nuestro personal.",
      },
    ],
  },
  {
    slug: "brazo-articulado",
    nombre: "Brazo articulado",
    nombrePlural: "Brazos articulados",
    tipoDb: "brazo_articulado",
    operadorIncluido: TIPOS_DB_CON_OPERADOR.has("brazo_articulado"),
    descripcionCorta:
      "Trabajos en altura con plataforma móvil para mantención industrial.",
    descripcionLarga:
      "El brazo articulado (boom lift) permite trabajar a 12–14 metros de altura con plataforma de seguridad. Ideal para mantención industrial, instalaciones eléctricas en altura, podas de altura y trabajos en bodegas y galpones.",
    casosDeUso: [
      "Mantención industrial en bodegas y plantas",
      "Instalación y reparación de iluminación / cableado en altura",
      "Pintura y mantención de fachadas",
      "Limpieza de canaletas y trabajos en techumbre",
      "Poda de árboles altos en parques o plantas",
    ],
    especificacionesClave: [
      "Altura de trabajo: 12 – 14 m",
      "Capacidad plataforma: 230 kg (2 personas + herramientas)",
      "Diésel o eléctrico (interior)",
      "Estabilizadores hidráulicos para nivelar en piso irregular",
    ],
    preguntasFrecuentes: [
      {
        q: "¿Hasta qué altura llega el brazo articulado?",
        a: "Nuestro brazo articulado alcanza hasta 14 metros de trabajo (12 m de altura más alcance lateral).",
      },
      {
        q: "¿Necesito operador certificado?",
        a: "Sí. El brazo articulado lo opera tu propio personal, que debe contar con curso de operación de plataforma elevadora vigente (Sernageomin o entidad equivalente). El equipo se entrega listo para operar.",
      },
      {
        q: "¿Sirve para trabajo en interior?",
        a: "Tenemos modelos eléctricos para interior (bodegas, plantas). Los diésel solo se usan en exteriores ventilados.",
      },
    ],
  },
  {
    slug: "plataforma-elevadora",
    nombre: "Plataforma elevadora",
    nombrePlural: "Plataformas elevadoras",
    tipoDb: "plataforma_elevadora",
    operadorIncluido: TIPOS_DB_CON_OPERADOR.has("plataforma_elevadora"),
    descripcionCorta:
      "Plataforma tijera o vertical para trabajos en altura con superficie amplia.",
    descripcionLarga:
      "La plataforma elevadora (scissor lift o vertical mast) entrega una superficie de trabajo amplia para 1–4 personas con herramientas. Ideal para instalación de cielos, mantención eléctrica masiva y trabajos donde se requiera espacio.",
    casosDeUso: [
      "Instalación de cielos y luminarias en bodegas grandes",
      "Trabajos eléctricos masivos en plantas industriales",
      "Pintura interior en altura",
      "Instalación de letreros y publicidad",
    ],
    especificacionesClave: [
      "Altura de trabajo: 8 – 12 m",
      "Plataforma: 2,3 x 1,1 m (espacio para 4 personas + herramientas)",
      "Capacidad: 320 – 450 kg",
      "Eléctrica o diésel según modelo",
    ],
    preguntasFrecuentes: [
      {
        q: "¿Diferencia entre plataforma tijera y brazo articulado?",
        a: "La tijera sube vertical y entrega superficie amplia. El brazo articulado tiene alcance lateral pero plataforma más pequeña. Si trabajas en línea recta arriba, tijera. Si necesitas llegar lateralmente o sobre obstáculos, brazo articulado.",
      },
      {
        q: "¿Cabe en una puerta industrial estándar?",
        a: "Sí, el ancho típico es 1,2 – 1,5 m, pasa por portones de 1,8 m sin problema.",
      },
      {
        q: "¿La plataforma elevadora incluye operador?",
        a: "No — se entrega lista para que la opere tu propio personal, que debe contar con curso de operación de plataforma elevadora vigente.",
      },
    ],
  },
  {
    slug: "camion-tolva",
    nombre: "Camión tolva",
    nombrePlural: "Camiones tolva",
    tipoDb: "camion",
    operadorIncluido: TIPOS_DB_CON_OPERADOR.has("camion"),
    descripcionCorta:
      "Transporte de áridos, escombros y materiales a granel.",
    descripcionLarga:
      "Camión tolva para transporte de áridos (gravilla, arena, ripio), escombros, tierra de excavación y materiales a granel. Servicio con conductor incluido en la tarifa y capacidad acorde al volumen de la obra.",
    casosDeUso: [
      "Transporte de áridos desde planta a obra",
      "Retiro de escombros y tierra excedente",
      "Distribución de materiales en grandes obras",
      "Movimiento de tierra de relleno y compactación",
    ],
    especificacionesClave: [
      "Capacidad: 8 – 14 m³",
      "Tracción 6x4 para acceso a zonas rurales",
      "Operador con licencia A4/A5 vigente",
    ],
    preguntasFrecuentes: [
      {
        q: "¿Cuánto carga un camión tolva?",
        a: "Entre 8 y 14 m³ según el modelo (entre 12 y 22 toneladas según densidad del material).",
      },
      {
        q: "¿Cobran por viaje o por día?",
        a: "Ambas modalidades: por viaje con cubicaje fijo si es traslado puntual, por día si la obra requiere camión a disposición.",
      },
      {
        q: "¿El camión tolva incluye conductor?",
        a: "Sí, siempre. El servicio incluye conductor con licencia A4/A5 vigente y su costo ya está dentro de la tarifa. El camión no se arrienda solo ni lo puede conducir personal del cliente.",
      },
    ],
  },
  {
    slug: "alzahombre",
    nombre: "Alzahombre",
    nombrePlural: "Alzahombres",
    tipoDb: "alzahombre",
    operadorIncluido: TIPOS_DB_CON_OPERADOR.has("alzahombre"),
    descripcionCorta:
      "Plataforma compacta para mantención eléctrica y trabajo en altura puntual.",
    descripcionLarga:
      "El alzahombre (también llamado canastillo elevador o cherrypicker) es la solución más compacta para subir 1 persona con herramientas a alturas medias (6–10 m). Pasa por puertas, opera en interior y se traslada fácilmente entre obras.",
    casosDeUso: [
      "Mantención de luminarias en pasillos y oficinas",
      "Reparaciones eléctricas puntuales en altura",
      "Instalación de letreros y señalética",
      "Mantención en bodegas pequeñas",
    ],
    especificacionesClave: [
      "Altura de trabajo: 6 – 10 m",
      "Capacidad: 1 persona + 100 kg de herramientas",
      "Eléctrico (apto interior)",
      "Cabe en puertas estándar",
    ],
    preguntasFrecuentes: [
      {
        q: "¿Cuál es la diferencia con un brazo articulado?",
        a: "El alzahombre es para 1 persona, más compacto y barato. El brazo articulado es para 2 personas y mayor alcance.",
      },
      {
        q: "¿Sirve para uso interior?",
        a: "Sí, los alzahombres eléctricos están diseñados para interior — no emiten gases.",
      },
      {
        q: "¿El alzahombre incluye operador?",
        a: "No — se entrega listo para que lo opere tu propio personal con curso de operación vigente. Es un equipo simple de operar.",
      },
    ],
  },
  {
    slug: "rodillo",
    nombre: "Rodillo compactador",
    nombrePlural: "Rodillos compactadores",
    tipoDb: "rodillo",
    operadorIncluido: TIPOS_DB_CON_OPERADOR.has("rodillo"),
    descripcionCorta:
      "Compactación de bases para radieres, pavimentos y caminos.",
    descripcionLarga:
      "Rodillo compactador vibratorio para compactar bases granulares antes de hormigonar radieres, pavimentos asfálticos o caminos rurales. Disponible en versiones tándem (2 rodillos) o de un solo rodillo más grande.",
    casosDeUso: [
      "Compactación de base para radier de hormigón",
      "Compactación de subbase para asfalto",
      "Caminos rurales y privados",
      "Cancha de fútbol, paseos peatonales",
    ],
    especificacionesClave: [
      "Peso operacional: 1.500 – 7.000 kg según modelo",
      "Ancho de compactación: 0,9 – 1,4 m",
      "Vibratorio (frecuencia ajustable)",
    ],
    preguntasFrecuentes: [
      {
        q: "¿Qué tamaño de rodillo necesito?",
        a: "Depende del espesor a compactar. Para bases delgadas (10–15 cm), un rodillo manual o mini de 1,5 ton basta. Para bases gruesas (>30 cm) necesitas rodillo de 5–7 ton.",
      },
      {
        q: "¿Sirve para compactar suelo natural?",
        a: "Sí, pero el resultado depende del tipo de suelo y humedad. Para suelos arcillosos conviene placa compactadora.",
      },
    ],
  },
  {
    slug: "placa-compactadora",
    nombre: "Placa compactadora",
    nombrePlural: "Placas compactadoras",
    tipoDb: "placa_compactadora",
    operadorIncluido: TIPOS_DB_CON_OPERADOR.has("placa_compactadora"),
    descripcionCorta:
      "Compactación de áreas pequeñas y bases de adoquines.",
    descripcionLarga:
      "La placa compactadora vibratoria (rana) es ideal para áreas pequeñas: zanjas, bases de adoquines, áreas donde el rodillo no entra. Manual, manejada por un operador.",
    casosDeUso: [
      "Compactación de relleno en zanjas",
      "Bases de adoquines y palmetas",
      "Áreas pequeñas en jardines y patios",
      "Instalación de pisos exteriores",
    ],
    especificacionesClave: [
      "Peso: 70 – 200 kg",
      "Fuerza centrífuga: 10 – 30 kN",
      "Combustible: bencina (motor pequeño)",
    ],
    preguntasFrecuentes: [
      {
        q: "¿Una persona puede operar la placa?",
        a: "Sí, está diseñada para operación manual. Recomendamos el uso de protectores auditivos y faja lumbar.",
      },
      {
        q: "¿Cuántos m² compacta por hora?",
        a: "Entre 100 y 300 m² por hora según el tamaño de la placa y el espesor a compactar.",
      },
    ],
  },
];

// Quién opera cada tipo: vive en ./operador (módulo liviano, client-safe,
// importable sin arrastrar este dataset al bundle). Se re-exporta acá por
// conveniencia para código server-side.
export {
  TIPOS_DB_CON_OPERADOR,
  TIPOS_DB_OPERA_CLIENTE,
  tieneOperadorIncluido,
  operaElCliente,
} from "./operador";

export interface ProductoBarracaSEO {
  slug: string;
  nombre: string;
  nombrePlural: string;
  categoriaSlug: string; // mapea a barraca_categorias.slug
  searchKeywords: string[];
  descripcionCorta: string;
  descripcionLarga: string;
  usosTipicos: string[];
  variantesComunes: string[];
  faq: { q: string; a: string }[];
}

export const TOP_PRODUCTOS_BARRACA: ProductoBarracaSEO[] = [
  {
    slug: "fierro-estriado",
    nombre: "Fierro estriado",
    nombrePlural: "Fierros estriados",
    categoriaSlug: "fierros-construccion",
    descripcionCorta:
      "Fierro estriado A63-42H para hormigón armado. Calibres 8, 10, 12, 16, 22 mm. Largo estándar 6 m.",
    descripcionLarga:
      "El fierro estriado (también llamado barra corrugada) es el refuerzo estructural por excelencia para hormigón armado: columnas, vigas, muros, radieres y losas. En JURMAQ Barraca trabajamos con fierro A63-42H certificado, en los calibres más usados (8 a 22 mm) y largo estándar de 6 m. Stock continuo y precio publicado.",
    usosTipicos: [
      "Refuerzo de columnas y vigas en hormigón armado",
      "Mallas de radier para piso y sobrelosa",
      "Estribos para columnas (calibre 8 mm doblado)",
      "Refuerzo de muros y fundaciones",
      "Estructuras de hormigón armado en general",
    ],
    variantesComunes: [
      "Fierro estriado 8 mm × 6 m",
      "Fierro estriado 10 mm × 6 m",
      "Fierro estriado 12 mm × 6 m",
      "Fierro estriado 16 mm × 6 m",
      "Fierro estriado 22 mm × 6 m",
    ],
    searchKeywords: [
      "fierro estriado precio",
      "fierro estriado 8mm",
      "fierro estriado 10mm",
      "fierro estriado 12mm",
      "fierro estriado 16mm",
      "fierro estriado 22mm",
      "fierro A63-42H",
      "barra corrugada",
      "fierro construccion",
    ],
    faq: [
      {
        q: "¿Cuál es el calibre más usado en construcción de casas?",
        a: "Para columnas estructurales en casas de 1-2 pisos lo más común es 12 mm con estribos de 8 mm. Para muros y radieres se usa malla acma o estriado 8-10 mm.",
      },
      {
        q: "¿En cuánto tiempo despachan?",
        a: "En Curicó, Molina y Teno despachamos el mismo día o al siguiente. Para Talca, Romeral y Sagrada Familia entre 24-48h. Confirma stock por WhatsApp.",
      },
      {
        q: "¿Tienen otro calibre diferente al publicado?",
        a: "Sí. Lo que publicamos es el stock continuo. Para 6 mm, 18 mm o 25 mm pídelos por WhatsApp y confirmamos disponibilidad y plazo.",
      },
    ],
  },
  {
    slug: "cemento",
    nombre: "Cemento",
    nombrePlural: "Cementos",
    categoriaSlug: "aridos-y-morteros",
    descripcionCorta:
      "Cemento Polpaico Especial y Melón Extra en sacos de 25 kg y 42,5 kg. Despacho a obra el mismo día.",
    descripcionLarga:
      "El cemento es la base de cualquier obra. En JURMAQ Barraca trabajamos las marcas más confiables del mercado chileno (Polpaico Especial, Melón Extra) en los formatos más vendidos: saco de 25 kg para obra menor y 42,5 kg para obra estructural. Stock siempre, precio publicado y despacho a Curicó, Molina, Teno, Romeral, Talca y toda la Región del Maule.",
    usosTipicos: [
      "Hormigón armado para columnas, vigas y muros estructurales",
      "Radier y sobrelosa de hormigón",
      "Mortero de pega para albañilería de ladrillo",
      "Estuco interior y exterior",
      "Fundaciones corridas y aisladas",
    ],
    variantesComunes: [
      "Cemento Polpaico Especial 25 kg",
      "Cemento Melón Extra 25 kg",
      "Cemento Polpaico 42.5 kg",
      "Mortero pre-mezclado 25 kg",
    ],
    searchKeywords: [
      "cemento Polpaico precio",
      "cemento Melón precio",
      "saco cemento 25kg",
      "saco cemento 42.5kg",
      "cemento estructural",
      "cemento albañilería",
      "comprar cemento",
      "cemento construccion",
    ],
    faq: [
      {
        q: "¿Cuántos sacos de cemento necesito por m² de radier?",
        a: "Regla rápida: 1 m² de radier de 5 cm de espesor = 1 saco de cemento de 25 kg + 3 partes de arena gruesa. Para 10 m² → 10 sacos. Para volumen mayor cotiza por m³.",
      },
      {
        q: "¿Cuál es la diferencia entre Polpaico y Melón?",
        a: "Funcionalmente son equivalentes para uso estructural y albañilería. Polpaico es más común en la zona central, Melón más en el sur. Ambas marcas cumplen la NCh 148.",
      },
      {
        q: "¿Despachan cemento a granel o solo en saco?",
        a: "Trabajamos sacos. Para volúmenes >50 sacos te coordinamos despacho directo a obra con descarga en pallet.",
      },
    ],
  },
  {
    slug: "planchas-zinc",
    nombre: "Planchas de zinc",
    nombrePlural: "Planchas de zinc",
    categoriaSlug: "techumbre",
    descripcionCorta:
      "Planchas de zinc acanalado 0.35 y 0.40 mm. Largos 2.0, 2.5, 3.0 y 3.66 m. Despacho a obra.",
    descripcionLarga:
      "La plancha de zinc acanalado es la solución estándar para techumbres y cierres de bodega en Chile. En JURMAQ trabajamos espesores 0.35 mm (uso doméstico/galpones) y 0.40 mm (uso industrial), en los largos más vendidos (2.0 a 3.66 m). Stock continuo y despacho con cuidado para que llegue a obra sin abolladuras.",
    usosTipicos: [
      "Techumbre residencial e industrial",
      "Cierres perimetrales de obra",
      "Bodegas, galpones y cobertizos",
      "Coberturas para estacionamientos y patios",
      "Reparación de techumbres existentes",
    ],
    variantesComunes: [
      "Plancha zinc 0.35 × 2.5 m",
      "Plancha zinc 0.35 × 3.0 m",
      "Plancha zinc 0.35 × 3.66 m",
      "Plancha zinc 0.40 × 3.0 m",
    ],
    searchKeywords: [
      "plancha zinc precio",
      "plancha zinc 0.35",
      "plancha zinc 0.40",
      "plancha acanalada",
      "techumbre zinc",
      "zinc galvanizado",
      "comprar plancha zinc",
    ],
    faq: [
      {
        q: "¿Qué espesor de zinc necesito para una techumbre de casa?",
        a: "Para casa habitación 0.35 mm es suficiente y es lo más usado. Para galpón industrial o expuesto a granizo conviene 0.40 mm.",
      },
      {
        q: "¿Cuál es el largo más conveniente?",
        a: "Depende de la pendiente del techo. Lo más vendido es 3.0 m. Si el aguacero es largo, 3.66 m evita traslapos. Si tienes la medida exacta, te ayudamos a calcular cuántas planchas necesitas.",
      },
      {
        q: "¿Despachan con tornillos para zinc?",
        a: "Sí. Tornillo autoperforante para zinc va aparte. Cotiza ambos juntos por WhatsApp y armamos un kit techumbre.",
      },
    ],
  },
  {
    slug: "malla-acma",
    nombre: "Malla Acma",
    nombrePlural: "Mallas Acma",
    categoriaSlug: "fierros-construccion",
    descripcionCorta:
      "Malla electrosoldada Acma C92, C188, C257 para radieres, sobrelosas y muros. Por m².",
    descripcionLarga:
      "La malla Acma (electrosoldada estándar Acma o equivalente Inchalam) reemplaza el armado manual con barras estriadas en radieres, sobrelosas y muros. Calibres más usados: C92 (radier doméstico), C188 (sobrelosa, vivienda), C257 (industrial). Trabajamos por m² o paño completo según necesidad.",
    usosTipicos: [
      "Radier de hormigón en casa habitación",
      "Sobrelosa para segundo piso",
      "Muros de hormigón armado livianos",
      "Refuerzo de pavimentos peatonales",
      "Reemplazo de armado manual con fierro",
    ],
    variantesComunes: [
      "Malla Acma C92 (5 mm × 15 cm)",
      "Malla Acma C188 (6 mm × 15 cm)",
      "Malla Acma C257 (7 mm × 15 cm)",
      "Malla Acma C385 (8 mm × 15 cm)",
    ],
    searchKeywords: [
      "malla acma precio",
      "malla acma C92",
      "malla acma C188",
      "malla acma C257",
      "malla electrosoldada",
      "malla radier",
      "malla hormigon",
    ],
    faq: [
      {
        q: "¿Cuál malla Acma uso para un radier de casa?",
        a: "Para radier de casa habitación (5-8 cm de espesor sobre cama de gravilla) la C92 es estándar. Para sobrelosa o pisos con tránsito vehicular, C188 o C257.",
      },
      {
        q: "¿La malla viene en rollo o en paño?",
        a: "Trabajamos en paños rectangulares estándar (2.6 m × 5 m aprox). Te calculamos cuántos paños y cuánto traslape necesitas para tu m² de obra.",
      },
    ],
  },
  {
    slug: "pinturas",
    nombre: "Pinturas",
    nombrePlural: "Pinturas",
    categoriaSlug: "pinturas",
    descripcionCorta:
      "Pinturas Sherwin-Williams, Soquina, Tricolor y Tajamar. Esmalte, látex, anticorrosivos, selladores.",
    descripcionLarga:
      "Para pintura de obra trabajamos las marcas más confiables del mercado chileno: Sherwin-Williams, Soquina, Tricolor y Tajamar. Línea completa: esmalte sintético, látex interior y exterior, anticorrosivos para metal, selladores y pinturas de piso. Asesoramos en color y rendimiento por m².",
    usosTipicos: [
      "Pintura interior de casa o oficina (látex)",
      "Pintura exterior fachadas y muros (látex acrílico)",
      "Esmalte sintético en metal y madera",
      "Anticorrosivo previo a esmalte sobre fierro",
      "Pinturas de piso para galpones y bodegas",
    ],
    variantesComunes: [
      "Sherwin-Williams Pro Mate galón",
      "Soquina Súper Vinilo galón",
      "Tricolor Tricovinilo galón",
      "Anticorrosivo Tajamar galón",
    ],
    searchKeywords: [
      "Sherwin Williams precio",
      "Soquina precio",
      "Tricolor pintura",
      "látex precio",
      "esmalte sintetico",
      "anticorrosivo precio",
      "pintura para casa",
      "pintura fachada",
    ],
    faq: [
      {
        q: "¿Cuántos m² rinde un galón de látex?",
        a: "Un galón de látex Sherwin-Williams Pro Mate rinde aprox 35-40 m² en una mano sobre superficie sellada. Para fachada en cemento poroso considera 25-30 m² por mano.",
      },
      {
        q: "¿Qué pintura uso sobre fierro?",
        a: "Primero anticorrosivo (Tajamar o equivalente), espera secado completo, luego esmalte sintético al aceite. Sin anticorrosivo el esmalte se oxida en meses.",
      },
    ],
  },
  {
    slug: "perfiles-metalicos",
    nombre: "Perfiles metálicos",
    nombrePlural: "Perfiles metálicos",
    categoriaSlug: "perfiles-y-planchas",
    descripcionCorta:
      "Perfiles cajón, ángulos, tubos cuadrados y rectangulares. Acero negro y galvanizado.",
    descripcionLarga:
      "Para estructura metálica trabajamos perfiles tubulares (cajón cuadrado y rectangular), ángulos doblados, planchas de acero y costaneras. Disponibles en acero negro estándar y galvanizado para exterior. Calibres y dimensiones más vendidos en stock; medidas especiales bajo pedido.",
    usosTipicos: [
      "Estructura para galpones y bodegas",
      "Pilares y vigas metálicas para casas",
      "Marcos de portones y rejas",
      "Cierres perimetrales con perfil galvanizado",
      "Soportes para techumbres livianas",
    ],
    variantesComunes: [
      "Tubo cuadrado 50 × 50 × 2.0 mm",
      "Tubo cuadrado 100 × 100 × 3.0 mm",
      "Ángulo doblado 50 × 50 × 3.0 mm",
      "Ángulo doblado 40 × 40 × 3.0 mm",
      "Perfil costanera C 100 × 50",
    ],
    searchKeywords: [
      "perfil metalico precio",
      "tubo cuadrado precio",
      "tubo rectangular",
      "angulo doblado",
      "perfil costanera",
      "perfil galvanizado",
      "perfil acero negro",
      "estructura metalica",
    ],
    faq: [
      {
        q: "¿Negro o galvanizado?",
        a: "Negro para uso interior protegido o si vas a pintar con anticorrosivo. Galvanizado para exterior, ambientes húmedos o costa.",
      },
      {
        q: "¿Cortan a medida?",
        a: "Trabajamos largos estándar (6 m). Para corte a medida coordinamos con maestranza JURMAQ — pídelo por WhatsApp.",
      },
    ],
  },
  {
    slug: "tubos",
    nombre: "Tubos metálicos",
    nombrePlural: "Tubos metálicos",
    categoriaSlug: "perfiles-y-planchas",
    descripcionCorta:
      "Tubos cuadrados y rectangulares. Calibres 1.5, 2.0, 3.0, 4.0 mm. Acero negro y galvanizado.",
    descripcionLarga:
      "Tubos de acero soldados (cuadrados y rectangulares) para estructura, mobiliario, rejas y cerramientos. Calibres desde 1.5 mm (uso liviano) hasta 4.0 mm (estructura pesada). Acero negro o galvanizado. Largo estándar 6 m.",
    usosTipicos: [
      "Estructuras de galpón liviano",
      "Marcos de puertas, portones, rejas",
      "Mobiliario industrial y comercial",
      "Estructuras decorativas (pérgolas, gazebos)",
      "Bastidores de letreros publicitarios",
    ],
    variantesComunes: [
      "Tubo cuadrado 30 × 30 × 1.5 mm",
      "Tubo cuadrado 50 × 50 × 2.0 mm",
      "Tubo cuadrado 100 × 100 × 3.0 mm",
      "Tubo rectangular 50 × 100 × 2.0 mm",
    ],
    searchKeywords: [
      "tubo cuadrado precio",
      "tubo rectangular precio",
      "tubo galvanizado",
      "tubo acero negro",
      "tubo estructural",
    ],
    faq: [
      {
        q: "¿Qué calibre necesito para una pérgola?",
        a: "Para pérgola residencial estándar (3 × 4 m) tubos 50 × 50 × 2.0 mm en columnas y 40 × 40 × 1.5 mm en vigas son suficientes. Para luces más grandes pasa a 60 × 60.",
      },
    ],
  },
  {
    slug: "angulos",
    nombre: "Ángulos doblados",
    nombrePlural: "Ángulos doblados",
    categoriaSlug: "perfiles-y-planchas",
    descripcionCorta:
      "Ángulos de acero L doblado en frío. Medidas 25 × 25 hasta 100 × 100, calibres 2.0 a 4.0 mm.",
    descripcionLarga:
      "Ángulos doblados en frío (perfil L) en acero negro o galvanizado. Para refuerzos estructurales, uniones, marcos y bastidores. Largo estándar 6 m. Medidas más vendidas en stock.",
    usosTipicos: [
      "Refuerzo de uniones soldadas",
      "Marcos de portones y rejas",
      "Bastidores de mobiliario industrial",
      "Refuerzo de estanterías",
      "Estructura de letreros y bastidores",
    ],
    variantesComunes: [
      "Ángulo doblado 25 × 25 × 2.0 mm",
      "Ángulo doblado 40 × 40 × 3.0 mm",
      "Ángulo doblado 50 × 50 × 3.0 mm",
      "Ángulo doblado 100 × 100 × 4.0 mm",
    ],
    searchKeywords: [
      "angulo doblado precio",
      "angulo acero precio",
      "perfil L acero",
      "angulo galvanizado",
    ],
    faq: [
      {
        q: "¿Sirve el ángulo para hacer estanterías?",
        a: "Sí, es el material clásico para estanterías metálicas. Para carga liviana (~50 kg/repisa) basta 25 × 25. Para carga pesada usa 40 × 40 o 50 × 50.",
      },
    ],
  },
];

/**
 * Helper para footer copyright unificado entre barraca y constructora.
 *
 * Formato canonical:
 *   © {YYYY} {brand.nombre} · RUT {rut} · {brand.direccion}. Todos los derechos reservados.
 *
 * El año se calcula dinámicamente (`new Date().getFullYear()`), así que no
 * necesitamos actualizarlo cada enero.
 *
 * @example
 *   <p>{buildFooterCopyright('barraca')}</p>
 *   <p>{buildFooterCopyright('constructora')}</p>
 */
export function buildFooterCopyright(brand: 'constructora' | 'barraca'): string {
  const b = LEGAL_INFO.brands[brand];
  const year = new Date().getFullYear();
  return `© ${year} ${b.nombre} · RUT ${LEGAL_INFO.rut} · ${b.direccion}. Todos los derechos reservados.`;
}

export const HQ = {
  ciudad: "Molina",
  region: "Maule",
  direccion: "Av. Poniente 2157, Molina, Maule",
  telefono: "+56976673577",
  telefonoDisplay: "+56 9 7667 3577",
  whatsapp: "https://wa.me/56976673577",
  email: "contacto@jurmaq.cl",
};

/**
 * Coordenadas físicas de despacho — fuente única de verdad para ruteo OSRM.
 *
 * - Barraca: Av. Poniente 2157, Molina (sucursal materiales).
 * - Constructora: Maquehua, sector rural ~5km al este del centro de Curicó.
 *
 * Consumidores: apps/constructora/src/lib/flete-pricing.ts (cálculo runtime
 * de flete a dirección libre) y scripts/calc-distancias.mjs (genera el
 * lookup table estático para landings SEO).
 *
 * NO confundir con `LEGAL_INFO.brands.*.geo` — esos son las coords usadas
 * en JSON-LD LocalBusiness y pueden estar deliberadamente cerca del
 * centroide de la ciudad para SEO Pack (Maquehua no aparecería en Google
 * Pack como tal).
 */
export const HQ_BARRACA = {
  lat: -35.1147,
  lng: -71.2839,
} as const;

export const HQ_CONSTRUCTORA = {
  lat: -34.9785,
  lng: -71.1985,
} as const;

/**
 * Información legal y comercial por brand.
 *
 * Mismo RUT (sociedad única) pero presentación con NOMBRE COMERCIAL para el
 * footer público — el user no quiere razón social en la cara visible del sitio.
 *
 * Direcciones distintas: la barraca está en Molina (sucursal materiales), la
 * constructora opera desde Maquehua, Curicó (oficina central + maestranza).
 *
 * Teléfonos distintos por brand: la constructora atiende en un número propio,
 * la barraca usa el número HQ histórico. NUNCA hardcodear un número de móvil
 * fuera de este archivo — importar siempre desde aquí o desde HQ.
 *
 * ## Nombres legales
 *
 * - **`nombreComercial`** (`'JURMAQ'`): marca visible. Úsalo en marketing,
 *   footer público, headers visuales, JSON-LD `name`, asuntos de email,
 *   logos textuales, copy publicitario.
 *
 * - **`nombreLegal`** (`'Constructora Jorge Ubilla Rivera E.I.R.L.'`):
 *   razón social. Úsalo en documentos vinculantes — contratos, términos y
 *   condiciones, política de privacidad, PDFs de cotización legalmente
 *   vinculantes, JSON-LD `legalName`, firma de contratos.
 *
 * - **`JURMAQ E.I.R.L.`**: ❌ NO usar — híbrido confuso (mezcla brand y
 *   forma societaria sin la razón social completa). Si necesitas mostrar
 *   la forma legal junto al brand, usa `nombreLegal` completo.
 */
export const LEGAL_INFO = {
  rut: "76.624.872-1",
  nombreComercial: "JURMAQ",
  nombreLegal: "Constructora Jorge Ubilla Rivera E.I.R.L.",
  brands: {
    constructora: {
      nombre: "Constructora JURMAQ",
      direccion: "LT 3 DEL LT A HJ 11, Maquehua, Curicó",
      // Versión formal/legible para contratos legales y documentos jurídicos.
      // Se mantiene separada de `direccion` (formato catastro SII) porque cambiar
      // ese campo afectaría SEO/JSON-LD que matchea con lo indexado en Google Maps.
      direccionLegal: "Lote 3 del lote A, HJ 11, Maquehua, comuna de Curicó, Región del Maule, Chile",
      // Campos estructurados para JSON-LD PostalAddress.
      streetAddress: "LT 3 DEL LT A HJ 11, Maquehua",
      addressLocality: "Curicó",
      addressRegion: "Región del Maule",
      addressCountry: "CL",
      // postalCode omitido: Maquehua es sector rural; sin código verificado.
      comuna: "Curicó",
      region: "Maule",
      telefono: "+56992994452",
      telefonoDisplay: "+56 9 9299 4452",
      whatsapp: "https://wa.me/56992994452",
      // Coordenadas aproximadas (sector Maquehua, comuna Curicó).
      geo: { latitude: -34.9833, longitude: -71.2333 },
    },
    barraca: {
      nombre: "Barraca de Fierros JURMAQ",
      direccion: "Av. Poniente 2157, Molina, Maule",
      streetAddress: "Av. Poniente 2157",
      addressLocality: "Molina",
      addressRegion: "Región del Maule",
      addressCountry: "CL",
      postalCode: "3550000",
      comuna: "Molina",
      region: "Maule",
      telefono: HQ.telefono,
      telefonoDisplay: "+56 9 7667 3577",
      whatsapp: HQ.whatsapp,
      // Coordenadas centro de Molina (sucursal Av. Poniente).
      geo: { latitude: -35.1147, longitude: -71.2839 },
    },
  },
} as const;
