/**
 * Catálogo de servicios de obra civil e industrial — constructora.jurmaq.cl
 *
 * ## Por qué estos 6 servicios y no otros
 *
 * Cada servicio está respaldado por al menos un proyecto REAL en
 * `proyectos-data.ts`. No inventamos capacidades: el listado se derivó de los
 * campos `servicios[]` de los 5 case studies ejecutados (Nestlé Teno, Miguel
 * Torres, Iansagro, Surfrut Romeral, Cementos Biobío).
 *
 * Eso posiciona a JURMAQ donde realmente compite —**obra civil industrial y
 * agroindustrial en la Región del Maule**— y no en urbanización/loteos, donde
 * no tenemos obra ejecutada que mostrar. Un mandante industrial que llega
 * buscando "fundaciones para silos" encuentra la obra de Nestlé; eso convierte.
 * Prometer urbanización sin respaldo habría traído leads que no cerramos.
 *
 * ## Cómo se usa
 *
 * - `/servicios` (índice) y `/servicios/[slug]` (landing por servicio).
 * - `proyectosSlugs` cruza con `PROYECTOS` para renderizar prueba real.
 * - `faq` alimenta el JSON-LD `FAQPage` (rich results en Google).
 * - `keywords` NO va al `<meta keywords>` (obsoleto): alimenta el copy y los
 *   H2, que es donde Google sí lee intención.
 */

export interface ServicioObra {
  slug: string;
  /** H1 y title base. Lleva la keyword principal al frente. */
  nombre: string;
  /** Etiqueta corta para nav, breadcrumbs y cards. */
  nombreCorto: string;
  /** Eyebrow sobre el H1. */
  eyebrow: string;
  /** Meta description (150-160 chars). */
  metaDescription: string;
  /** Párrafo de apertura, 2-3 frases. Habla al mandante, no a Google. */
  intro: string;
  /** Qué incluye concretamente el servicio. */
  incluye: string[];
  /** Para qué tipo de mandante / obra aplica. */
  aplicaA: string[];
  /** Diferenciadores verificables (no marketing hueco). */
  diferenciadores: { titulo: string; detalle: string }[];
  /** Slugs de PROYECTOS que demuestran este servicio. */
  proyectosSlugs: string[];
  faq: { pregunta: string; respuesta: string }[];
  /** Intención de búsqueda que ataca esta landing. */
  keywords: string[];
  /** Orden en el índice. */
  orden: number;
}

export const SERVICIOS_OBRAS: ServicioObra[] = [
  {
    slug: 'fundaciones-y-obra-civil-industrial',
    nombre: 'Fundaciones y obra civil industrial',
    nombreCorto: 'Fundaciones y obra civil',
    eyebrow: 'Hormigón armado · Fundaciones especiales',
    metaDescription:
      'Fundaciones especiales, radieres y hormigón armado para plantas industriales y agroindustriales en Curicó, Teno, Molina y toda la Región del Maule. Obra ejecutada para Nestlé y Miguel Torres.',
    intro:
      'Ejecutamos la obra civil que sostiene la planta: fundaciones especiales para silos y equipos de proceso, dados de fundación, radieres estructurales y hormigón armado bajo especificación. Trabajamos con planta en operación, coordinando faena con producción para no detener la línea.',
    incluye: [
      'Fundaciones especiales para silos, estanques y equipos de proceso',
      'Dados y pedestales de fundación para estructura metálica',
      'Radieres estructurales y losas de hormigón armado',
      'Excavación, sello de fundación y compactación certificada',
      'Enfierradura según planos de cálculo (A63-42H, malla Acma)',
      'Hormigonado H-25 a H-40 con control de probetas',
    ],
    aplicaA: [
      'Plantas agroindustriales (deshidratado, jugos, packing, frigoríficos)',
      'Bodegas y salas de proceso vitivinícolas',
      'Plantas de alimentos y lácteos',
      'Silos, torres y estructuras de almacenamiento',
      'Ampliaciones sobre planta en operación',
    ],
    diferenciadores: [
      {
        titulo: 'Maquinaria propia, sin subcontrato de movimiento de tierras',
        detalle:
          'Excavadora, retroexcavadora y minicargador propios. La excavación y el sello de fundación los hace el mismo equipo que hormigona, así que no hay ventana muerta esperando a un tercero.',
      },
      {
        titulo: 'Obra sobre planta en operación',
        detalle:
          'La fundación de silos en Nestlé Teno se ejecutó con la planta produciendo. Programamos hormigonados y cierres de faena en torno a los turnos del mandante.',
      },
      {
        titulo: 'Barraca propia para el acero',
        detalle:
          'El fierro estriado y la malla salen de nuestra barraca en Molina. Eso saca al proveedor de la ruta crítica cuando el cálculo cambia a mitad de obra.',
      },
    ],
    proyectosSlugs: ['nestle-teno-fundaciones-silos', 'miguel-torres-bodega-cubas'],
    faq: [
      {
        pregunta: '¿Pueden ejecutar fundaciones con la planta funcionando?',
        respuesta:
          'Sí. Es la modalidad en que trabajamos habitualmente con mandantes agroindustriales. Coordinamos accesos, horarios de hormigonado y cierres de faena con producción y prevención de riesgos del mandante antes de movilizar.',
      },
      {
        pregunta: '¿Trabajan con proyecto de cálculo del mandante o lo proveen ustedes?',
        respuesta:
          'Ambas. Ejecutamos contra planos de cálculo del mandante, y si el proyecto todavía no existe podemos coordinar la ingeniería con calculista antes de presupuestar.',
      },
      {
        pregunta: '¿Qué control de calidad entregan del hormigón?',
        respuesta:
          'Control de probetas por hormigonada con ensayo a 7 y 28 días, registro de sello de fundación y compactación. La documentación se entrega en la carpeta de obra al término.',
      },
      {
        pregunta: '¿Cuál es el plazo típico de una fundación industrial?',
        respuesta:
          'Depende del volumen y de la ventana operativa del mandante. Una fundación de equipos acotada suele ir entre 3 y 8 semanas; obras mayores con silos se planifican por etapas. El plazo va comprometido en la propuesta.',
      },
    ],
    keywords: [
      'fundaciones industriales Curicó',
      'obra civil industrial Maule',
      'fundaciones para silos',
      'radieres industriales Curicó',
      'hormigón armado Región del Maule',
      'constructora obra civil agroindustria',
    ],
    orden: 1,
  },
  {
    slug: 'estructuras-metalicas-y-montaje-industrial',
    nombre: 'Estructuras metálicas y montaje industrial',
    nombreCorto: 'Estructuras metálicas',
    eyebrow: 'Fabricación · Montaje · Maestranza propia',
    metaDescription:
      'Fabricación y montaje de estructuras metálicas industriales en Curicó y la Región del Maule: naves, pasarelas, soportes de equipos y refuerzos. Maestranza propia y obra ejecutada para Nestlé y Surfrut.',
    intro:
      'Fabricamos en maestranza propia y montamos en terreno: naves, marcos rígidos, pasarelas, plataformas de operación y soportes de equipos de proceso. Al tener la maestranza dentro de la empresa, un ajuste dimensional en terreno no se convierte en dos semanas de espera.',
    incluye: [
      'Fabricación de perfiles y marcos en maestranza propia',
      'Montaje de estructura metálica con equipo y grúa',
      'Pasarelas, plataformas y escaleras de operación',
      'Soportes y bancadas para equipos de proceso',
      'Refuerzo estructural sobre estructura existente',
      'Tratamiento anticorrosivo y pintura industrial',
    ],
    aplicaA: [
      'Naves industriales y galpones de proceso',
      'Ampliaciones de planta agroindustrial',
      'Estructuras de soporte para silos y estanques',
      'Pasarelas y accesos de mantención',
      'Refuerzos por cambio de carga o normativa',
    ],
    diferenciadores: [
      {
        titulo: 'Maestranza propia en Curicó',
        detalle:
          'Fabricamos nosotros. El ajuste que en obra aparece un martes se resuelve el miércoles, no cuando el taller externo tenga capacidad.',
      },
      {
        titulo: 'Traslado de equipos pesados incluido',
        detalle:
          'Movilizamos estructura y equipos con medios propios. En la obra de Surfrut en Romeral el traslado de equipos fue parte del alcance contratado.',
      },
      {
        titulo: 'Un solo contrato para civil + metálica',
        detalle:
          'Fundación y estructura van con el mismo contratista. Desaparece la discusión de interfaz entre el que hizo el dado y el que monta encima.',
      },
    ],
    proyectosSlugs: ['nestle-teno-fundaciones-silos', 'surfrut-romeral-obras'],
    faq: [
      {
        pregunta: '¿Fabrican ustedes o subcontratan la maestranza?',
        respuesta:
          'Fabricamos en maestranza propia en Curicó. Es una de las cuatro unidades de JURMAQ junto con constructora, arriendo de maquinaria y barraca de fierros.',
      },
      {
        pregunta: '¿Pueden montar sobre estructura existente sin detener la planta?',
        respuesta:
          'Sí, es lo habitual en mantención y ampliación agroindustrial. Se define ventana de intervención, plan de izaje y medidas de prevención con el mandante antes de entrar.',
      },
      {
        pregunta: '¿Entregan planos de taller?',
        respuesta:
          'Sí. Cuando el alcance incluye fabricación, entregamos planos de taller para aprobación del mandante o su ITO antes de cortar material.',
      },
    ],
    keywords: [
      'estructuras metálicas Curicó',
      'montaje industrial Maule',
      'maestranza Curicó',
      'naves industriales Región del Maule',
      'fabricación estructura metálica agroindustria',
    ],
    orden: 2,
  },
  {
    slug: 'pavimentos-industriales',
    nombre: 'Pavimentos y pisos industriales',
    nombreCorto: 'Pavimentos industriales',
    eyebrow: 'Hormigón · Epóxico · Alto tránsito',
    metaDescription:
      'Pavimentos de hormigón, pisos epóxicos y muelles de carga para plantas industriales en Curicó, Linares y la Región del Maule. Reparación de pavimentos en operación. Obra ejecutada para Iansagro.',
    intro:
      'Ejecutamos y reparamos el piso que aguanta grúa horquilla, camión y lavado diario: pavimentos de hormigón para alto tránsito, pisos epóxicos sanitarios y muelles de carga. También intervenimos pavimento existente por sectores, sin cerrar la planta completa.',
    incluye: [
      'Pavimentos de hormigón para tránsito pesado',
      'Pisos industriales epóxicos y sanitarios',
      'Muelles y rampas de carga',
      'Reparación de pavimentos por paños, en operación',
      'Juntas de dilatación, sellos y terminación antideslizante',
      'Nivelación y preparación de base compactada',
    ],
    aplicaA: [
      'Plantas de alimentos con exigencia sanitaria',
      'Bodegas de despacho y zonas de grúa horquilla',
      'Patios de maniobra y accesos de camión',
      'Salas de proceso con lavado frecuente',
      'Reparación de pavimento deteriorado sin parar la planta',
    ],
    diferenciadores: [
      {
        titulo: 'Reparación por paños con planta operando',
        detalle:
          'En Iansagro (Linares) la reparación de pavimentos se hizo por sectores, coordinada con la operación. La planta nunca paró completa.',
      },
      {
        titulo: 'Piso sanitario para agroindustria alimentaria',
        detalle:
          'Ejecutamos pisos epóxicos donde hay lavado y exigencia sanitaria, no solo hormigón de bodega.',
      },
      {
        titulo: 'Base y pavimento con el mismo equipo',
        detalle:
          'La compactación de base la hace nuestra propia maquinaria. Un piso falla casi siempre por la base, no por el hormigón.',
      },
    ],
    proyectosSlugs: ['iansagro-mantencion-industrial'],
    faq: [
      {
        pregunta: '¿Pueden reparar pavimento sin detener la planta?',
        respuesta:
          'Sí. Se trabaja por paños o sectores con cierre parcial, coordinando con la operación del mandante. Es como ejecutamos la reparación de pavimentos en Iansagro.',
      },
      {
        pregunta: '¿Qué tipo de piso conviene para una sala de proceso de alimentos?',
        respuesta:
          'Habitualmente hormigón con terminación epóxica sanitaria, que resiste lavado frecuente y no acumula. La elección final depende de carga, químicos de limpieza y exigencia del cliente o su auditoría.',
      },
      {
        pregunta: '¿Cuánto tarda en poder usarse el pavimento nuevo?',
        respuesta:
          'El hormigón admite tránsito peatonal a los pocos días y carga pesada al alcanzar resistencia de proyecto, típicamente 28 días. Cuando el plazo es crítico se puede especificar hormigón de alta resistencia inicial; se define en la propuesta.',
      },
    ],
    keywords: [
      'pavimentos industriales Curicó',
      'piso epóxico industrial Maule',
      'reparación de pavimentos planta industrial',
      'radier alto tránsito Región del Maule',
      'muelle de carga industrial',
    ],
    orden: 3,
  },
  {
    slug: 'cubiertas-y-revestimientos-industriales',
    nombre: 'Cubiertas y revestimientos industriales',
    nombreCorto: 'Cubiertas industriales',
    eyebrow: 'Zincalum · Aislación · Cubierta de silos',
    metaDescription:
      'Cubiertas industriales, revestimientos y aislación térmica para plantas y silos en Curicó, Romeral y la Región del Maule. Recambio de cubierta con planta en operación.',
    intro:
      'Instalamos y recambiamos cubierta industrial: zincalum, aislación térmica, cubierta de silos y revestimiento de fachada. Es una obra que casi siempre hay que hacer sobre planta operando y con altura, así que el plan de izaje y la prevención van definidos antes de subir.',
    incluye: [
      'Cubierta de zincalum y paneles con aislación térmica',
      'Cubierta y encamisado de silos',
      'Recambio de cubierta deteriorada por sectores',
      'Revestimiento de fachada y cierres laterales',
      'Canales de aguas lluvia, bajadas y hojalatería',
      'Estructura de soporte y refuerzo de costaneras',
    ],
    aplicaA: [
      'Naves y galpones de proceso agroindustrial',
      'Silos y torres de almacenamiento',
      'Bodegas con exigencia térmica',
      'Recambio de cubierta por corrosión o fin de vida útil',
      'Reparación tras evento climático',
    ],
    diferenciadores: [
      {
        titulo: 'Cubierta de silos ejecutada',
        detalle:
          'La cubierta de silos en Surfrut (Romeral) es obra propia, no referencia de catálogo. Trabajo en altura sobre estructura existente.',
      },
      {
        titulo: 'Estructura y cubierta con el mismo contratista',
        detalle:
          'Si al desmontar aparece costanera corroída, la reforzamos nosotros mismos. No se detiene la obra a buscar quién repare la estructura.',
      },
      {
        titulo: 'Respuesta de emergencia',
        detalle:
          'Atendemos daño de cubierta por evento climático con movilización prioritaria. Es parte del alcance que hemos ejecutado para mandantes industriales de la zona.',
      },
    ],
    proyectosSlugs: ['surfrut-romeral-obras', 'cementos-biobio-mantencion'],
    faq: [
      {
        pregunta: '¿Pueden recambiar cubierta con la planta funcionando abajo?',
        respuesta:
          'Sí, es la situación normal. Se trabaja por paños con protección inferior, plan de izaje y coordinación con prevención de riesgos del mandante para proteger a la gente y al equipamiento de proceso.',
      },
      {
        pregunta: '¿Atienden emergencias por temporal?',
        respuesta:
          'Sí. Tenemos experiencia en respuesta de emergencia para mandantes industriales de la zona. Escríbenos por WhatsApp para una movilización prioritaria.',
      },
      {
        pregunta: '¿Incluyen la aislación térmica?',
        respuesta:
          'Sí, cuando el alcance lo requiere instalamos panel con aislación o aislación bajo cubierta. Se define según la exigencia térmica de la sala de proceso.',
      },
    ],
    keywords: [
      'cubiertas industriales Curicó',
      'recambio cubierta zincalum Maule',
      'cubierta de silos',
      'revestimiento industrial Región del Maule',
      'reparación cubierta planta industrial',
    ],
    orden: 4,
  },
  {
    slug: 'mantencion-industrial-y-refuerzo-estructural',
    nombre: 'Mantención industrial y refuerzo estructural',
    nombreCorto: 'Mantención industrial',
    eyebrow: 'Planta en operación · Contrato anual',
    metaDescription:
      'Mantención industrial, refuerzo estructural y obras civiles complementarias en plantas de Curicó, Linares y la Región del Maule. Contratos de mantención y respuesta de emergencia.',
    intro:
      'Somos el contratista que la planta llama cuando algo se deterioró y no puede parar: refuerzo estructural, reparación de hormigón, obras civiles complementarias y mantención programada. Trabajamos por contrato anual o por evento, con cuadrilla que ya conoce la planta.',
    incluye: [
      'Refuerzo estructural de elementos metálicos y de hormigón',
      'Reparación de hormigón deteriorado y corrosión de armadura',
      'Mantención estructural programada y por evento',
      'Obras civiles complementarias durante detención de planta',
      'Pinturas anticorrosivas y protección de estructura',
      'Respuesta de emergencia con movilización prioritaria',
    ],
    aplicaA: [
      'Plantas industriales con detención programada anual',
      'Estructuras con corrosión o daño por carga',
      'Instalaciones que requieren contratista permanente en zona',
      'Cambio de uso o aumento de carga sobre estructura existente',
      'Emergencias estructurales y de cubierta',
    ],
    diferenciadores: [
      {
        titulo: 'Contratista local, no de Santiago',
        detalle:
          'Estamos en Curicó. Una emergencia en Teno, Molina, Romeral o Linares se atiende el mismo día, no cuando llegue la cuadrilla desde la capital.',
      },
      {
        titulo: 'Ventanas de detención aprovechadas al máximo',
        detalle:
          'Cuando la planta para, el reloj corre. Llegamos con material en cancha —el acero sale de nuestra propia barraca— para no perder horas de la ventana.',
      },
      {
        titulo: 'Continuidad de mandantes industriales',
        detalle:
          'Iansagro y Cementos Biobío son mandantes de mantención, no obras de una vez. La cuadrilla ya conoce el layout y los protocolos de la planta.',
      },
    ],
    proyectosSlugs: ['iansagro-mantencion-industrial', 'cementos-biobio-mantencion'],
    faq: [
      {
        pregunta: '¿Trabajan con contrato anual de mantención?',
        respuesta:
          'Sí. Es la modalidad con varios de nuestros mandantes industriales: un contrato marco con tarifas acordadas y órdenes de trabajo por evento o por detención programada.',
      },
      {
        pregunta: '¿Cuánto se demoran en llegar a una emergencia?',
        respuesta:
          'Operamos desde Curicó, así que Teno, Molina, Romeral, Sagrada Familia y Rauco quedan a menos de una hora. Talca y Linares el mismo día. Escríbenos por WhatsApp para una movilización prioritaria.',
      },
      {
        pregunta: '¿Cumplen requisitos de acreditación de contratistas?',
        respuesta:
          'Sí. Trabajamos regularmente con mandantes que exigen acreditación, documentación laboral al día y protocolos de prevención. Podemos entregar la carpeta de acreditación durante la evaluación.',
      },
    ],
    keywords: [
      'mantención industrial Curicó',
      'refuerzo estructural Maule',
      'contratista mantención planta industrial',
      'reparación estructural Región del Maule',
      'obras civiles complementarias industria',
    ],
    orden: 5,
  },
  {
    slug: 'movimiento-de-tierras-y-preparacion-de-terreno',
    nombre: 'Movimiento de tierras y preparación de terreno',
    nombreCorto: 'Movimiento de tierras',
    eyebrow: 'Maquinaria propia · Escarpe y nivelación',
    metaDescription:
      'Movimiento de tierras, escarpe, nivelación y excavación con maquinaria propia en Curicó, Molina, Teno, Talca y la Región del Maule. Excavadora, retroexcavadora y minicargador sin intermediarios.',
    intro:
      'Preparamos el terreno antes de que llegue el hormigón: escarpe, excavación masiva, nivelación, compactación, accesos y patios de maniobra. La maquinaria es nuestra —el mismo equipo que arrendamos en jurmaq.cl— así que no hay margen de intermediario ni espera de disponibilidad.',
    incluye: [
      'Escarpe y despeje de terreno',
      'Excavación masiva y de fundaciones',
      'Nivelación, perfilado y compactación',
      'Rellenos estructurales controlados',
      'Accesos, patios de maniobra y explanadas',
      'Retiro de escombros y material excedente',
    ],
    aplicaA: [
      'Preparación de plataforma para nave o galpón industrial',
      'Excavación para fundaciones y radieres',
      'Accesos y patios en planta agroindustrial',
      'Habilitación de terreno agrícola e industrial',
      'Obras que requieren maquinaria con operador por período',
    ],
    diferenciadores: [
      {
        titulo: 'Flota propia, sin subcontrato',
        detalle:
          'Excavadora, retroexcavadora Hidromek, minicargador Bobcat y miniexcavadora XCMG son de JURMAQ. El precio no lleva margen de intermediario y la disponibilidad la controlamos nosotros.',
      },
      {
        titulo: 'Continuidad hacia la obra civil',
        detalle:
          'Terminado el movimiento de tierras seguimos con fundación y estructura. No hay entrega de terreno entre contratistas ni discusión sobre quién dejó mal el sello.',
      },
      {
        titulo: 'Mejor precio por obra completa',
        detalle:
          'Si el alcance combina maquinaria, materiales de barraca y obra civil, se presupuesta como paquete único con mejor precio que contratarlo por separado.',
      },
    ],
    proyectosSlugs: ['nestle-teno-fundaciones-silos', 'surfrut-romeral-obras'],
    faq: [
      {
        pregunta: '¿La maquinaria es propia o subcontratada?',
        respuesta:
          'Propia. JURMAQ tiene su propia flota de arriendo de maquinaria, así que en obra civil usamos nuestros equipos con nuestros operadores.',
      },
      {
        pregunta: '¿Puedo contratar solo el movimiento de tierras?',
        respuesta:
          'Sí, se puede contratar como alcance independiente. También puedes arrendar la máquina con operador por período en jurmaq.cl si prefieres administrar tú la faena.',
      },
      {
        pregunta: '¿Entregan certificación de compactación?',
        respuesta:
          'Sí, cuando el proyecto lo exige coordinamos los ensayos de densidad con laboratorio y entregamos los certificados en la carpeta de obra.',
      },
    ],
    keywords: [
      'movimiento de tierras Curicó',
      'escarpe y nivelación Maule',
      'excavación fundaciones Región del Maule',
      'preparación de terreno industrial',
      'compactación certificada Curicó',
    ],
    orden: 6,
  },
];

export function getServicioBySlug(slug: string): ServicioObra | undefined {
  return SERVICIOS_OBRAS.find((s) => s.slug === slug);
}

export function getServiciosOrdenados(): ServicioObra[] {
  return [...SERVICIOS_OBRAS].sort((a, b) => a.orden - b.orden);
}
