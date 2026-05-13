/**
 * Datos de competidores para landings programáticas tipo
 * "Alternativa a {competidor}" en /barraca/alternativa/[competidor].
 *
 * El objetivo SEO es capturar búsquedas con alta intención comercial:
 *   - "alternativa a sodimac curicó"
 *   - "barraca igual o mejor que easy"
 *   - "donde comprar más barato que sodimac"
 *
 * Cada entry contiene comparativos honestos (no atacar al competidor) y
 * énfasis en los diferenciales reales de JURMAQ:
 *   - Despacho local rápido al Maule
 *   - Mejor precio garantizado vs cotización del competidor
 *   - Atención personal por WhatsApp con quien arma tu cotización
 *   - Cuenta empresa con condiciones de pago
 */

export interface CompetidorVentaja {
  /** Título corto del comparativo */
  titulo: string;
  /** Descripción honesta del competidor (sin atacar) */
  competidor: string;
  /** Lo que ofrece JURMAQ */
  jurmaq: string;
}

export interface CompetidorData {
  slug: string;
  nombre: string;
  descripcionCompetidor: string;
  /** Ciudades donde el competidor tiene presencia cerca del Maule */
  ciudadesPresencia: string[];
  /** Tipo de tienda: "retail" (tienda con público), "barraca" (tradicional) */
  tipo: "retail" | "barraca" | "industrial";
  /** Comparativos honestos */
  ventajas: CompetidorVentaja[];
  /** FAQ específicas para el competidor */
  faq: { pregunta: string; respuesta: string }[];
  /** Categorías clave donde JURMAQ es competitivo */
  categoriasFuertes: { slug: string; nombre: string }[];
}

export const COMPETIDORES_DATA: CompetidorData[] = [
  {
    slug: "sodimac",
    nombre: "Sodimac",
    descripcionCompetidor:
      "Cadena de retail de mejoramiento del hogar más grande de Chile, con tiendas en Curicó y Talca. Amplio surtido y atención general; orientado tanto a retail como a profesionales (Constructor).",
    ciudadesPresencia: ["Curicó", "Talca", "Linares"],
    tipo: "retail",
    ventajas: [
      {
        titulo: "Despacho a la obra",
        competidor:
          "Despacho desde tienda con plazos según rango: usualmente 24-72h en Maule, según disponibilidad de logística regional.",
        jurmaq:
          "Despacho directo desde Molina al Maule: Curicó en 30 min, Talca en 1h, Linares y otros coordinados el mismo día.",
      },
      {
        titulo: "Mejora de precio",
        competidor:
          "Política de igualación de precio según términos vigentes y comprobante del competidor en condiciones equivalentes.",
        jurmaq:
          "Mejor precio garantizado contra cotización formal. Subes la cotización en /cotizar y respondemos en menos de 2 horas con un mejor precio.",
      },
      {
        titulo: "Atención personalizada",
        competidor:
          "Atención general en tienda y plataformas digitales, equipos amplios y rotativos.",
        jurmaq:
          "Hablas por WhatsApp directo con la persona que arma tu cotización. Sin call center, sin transferencias.",
      },
      {
        titulo: "Cuenta empresa / Constructor",
        competidor:
          "Sodimac Constructor con condiciones para profesionales y plazos de pago según evaluación.",
        jurmaq:
          "Cuenta empresa con plazos de pago a convenir según historial. Cotizaciones unificadas para múltiples obras.",
      },
    ],
    faq: [
      {
        pregunta: "¿Es JURMAQ más barato que Sodimac?",
        respuesta:
          "No prometemos precio más bajo en todo el catálogo: en algunos productos el retail tiene volumen y márgenes que igualar es difícil. Pero contra una cotización formal te garantizamos mejorar el precio total del pedido específico que estás cotizando.",
      },
      {
        pregunta: "¿Puedo comprar lo mismo que en Sodimac en JURMAQ?",
        respuesta:
          "JURMAQ Barraca cubre las categorías de obra gruesa: fierros, cemento, áridos, perfiles, mallas, terciados, OSB, aislantes, planchas Volcanita, fijaciones, herramientas eléctricas y manuales. No tenemos línea de jardín, decoración ni cocina-baño.",
      },
      {
        pregunta: "¿Cuánto tarda el despacho?",
        respuesta:
          "Desde Molina (Maule): Curicó en 30 minutos, Talca en 1 hora. Para pedidos en stock confirmamos despacho mismo día si la cotización se cierra antes de las 14:00.",
      },
      {
        pregunta: "¿Atienden constructoras y empresas?",
        respuesta:
          "Sí. Tenemos cuenta empresa con plazos de pago, descuentos por volumen y un vendedor asignado que conoce tus obras. Coordinamos múltiples despachos por proyecto.",
      },
    ],
    categoriasFuertes: [
      { slug: "fierros", nombre: "Fierros y Acero" },
      { slug: "cemento-y-aridos", nombre: "Cemento y Áridos" },
      { slug: "perfiles-metalicos", nombre: "Perfiles Metalcon" },
      { slug: "terciados-y-osb", nombre: "Terciados y OSB" },
    ],
  },
  {
    slug: "easy",
    nombre: "Easy",
    descripcionCompetidor:
      "Cadena de retail de mejoramiento del hogar (Cencosud) con tiendas en Talca. Mix de productos de construcción, jardín y hogar.",
    ciudadesPresencia: ["Talca"],
    tipo: "retail",
    ventajas: [
      {
        titulo: "Cobertura local",
        competidor:
          "Tienda Easy más cercana en Talca; trasladarse desde Curicó o Molina implica viaje y carga propia.",
        jurmaq:
          "Despacho directo desde Molina: Curicó 30 min, Talca 1h. No tienes que viajar ni cargar el material tú mismo.",
      },
      {
        titulo: "Mejora de precio sobre cotización",
        competidor: "Promociones puntuales y descuentos según campañas vigentes.",
        jurmaq:
          "Te mejoramos el precio contra cotización formal del competidor. Subes el comprobante en /cotizar y respondemos con un mejor precio en 2 horas.",
      },
      {
        titulo: "Productos de obra grande",
        competidor:
          "Foco mixto retail/profesional. Stock de fierros y cemento orientado al consumidor final.",
        jurmaq:
          "Foco 100% obra: 1.600+ productos para constructoras, contratistas y maestros. Stock para obras chicas, medianas y grandes.",
      },
    ],
    faq: [
      {
        pregunta: "¿JURMAQ es más conveniente que Easy?",
        respuesta:
          "Para una obra en el Maule, sí: te ahorras viaje a Talca, te llevamos el material a la obra, y te mejoramos el precio contra cotización formal. Para compras pequeñas de hogar/jardín, Easy puede ser más práctico.",
      },
      {
        pregunta: "¿Tienen las mismas marcas?",
        respuesta:
          "Cubrimos las marcas core de construcción chilena: cemento Polpaico/Melón/Bío-Bío, fierro CAP/Gerdau, perfiles Cintac, Volcanita, etc. No tenemos las líneas exclusivas de retail (decoración, jardín).",
      },
      {
        pregunta: "¿Despachan a Talca y Linares?",
        respuesta:
          "Sí. Talca en 1h desde Molina, Linares y otros sectores del Maule coordinados el mismo día.",
      },
    ],
    categoriasFuertes: [
      { slug: "fierros", nombre: "Fierros y Acero" },
      { slug: "cemento-y-aridos", nombre: "Cemento y Áridos" },
      { slug: "fijaciones-y-tornilleria", nombre: "Fijaciones y Tornillería" },
      { slug: "pinturas", nombre: "Pinturas" },
    ],
  },
  {
    slug: "construmart",
    nombre: "Construmart",
    descripcionCompetidor:
      "Cadena enfocada en construcción y obra gruesa, con tiendas en Talca y otras ciudades. Mix de materiales pesados (fierros, cemento, áridos) y terminaciones.",
    ciudadesPresencia: ["Talca", "Curicó"],
    tipo: "barraca",
    ventajas: [
      {
        titulo: "Cobertura del Maule rural",
        competidor:
          "Tiendas físicas en Talca y red regional; despacho según logística de cada sucursal.",
        jurmaq:
          "Despacho directo desde Molina con conocimiento del territorio: zonas rurales del Maule incluidas, accesos coordinados con el camionero.",
      },
      {
        titulo: "Atención al constructor",
        competidor:
          "Mostradores con vendedores, tiempos de cotización según carga del local.",
        jurmaq:
          "Cotización armada por WhatsApp directo en horas, no días. Sin filas en mostrador.",
      },
      {
        titulo: "Stock de fierros y áridos",
        competidor:
          "Stock orientado a obra, comparable en las categorías que más se usan en construcción.",
        jurmaq:
          "Stock garantizado en fierros estriados, cemento de las 3 grandes (Polpaico, Melón, Bío-Bío) y áridos en sacos o granel.",
      },
    ],
    faq: [
      {
        pregunta: "¿En qué se diferencia JURMAQ de Construmart?",
        respuesta:
          "Ambas son barracas orientadas a obra. La diferencia: JURMAQ está en Molina (centro del Maule) y entrega despacho rápido a Curicó y Talca, con atención por WhatsApp directo y mejor precio garantizado contra cotización formal.",
      },
      {
        pregunta: "¿Tienen los mismos productos?",
        respuesta:
          "Sí, en categorías de obra gruesa: fierros, cemento, áridos, perfiles, mallas, OSB, terciados. Catálogo de 1.600+ productos en barraca.jurmaq.cl.",
      },
      {
        pregunta: "¿Cómo coordino una obra grande?",
        respuesta:
          "Habla por WhatsApp con nuestro vendedor: arma cotización por etapas de obra (fundación, hormigón, estructura, terminaciones), coordinamos despachos sincronizados con tu programación.",
      },
    ],
    categoriasFuertes: [
      { slug: "fierros", nombre: "Fierros y Acero" },
      { slug: "cemento-y-aridos", nombre: "Cemento y Áridos" },
      { slug: "perfiles-metalicos", nombre: "Perfiles Metalcon" },
      { slug: "mallas-y-cierros", nombre: "Mallas y Cierros" },
    ],
  },
  {
    slug: "imperial",
    nombre: "Imperial",
    descripcionCompetidor:
      "Cadena de retail con foco en madera, terciados y tableros. Tiendas en distintas regiones del país.",
    ciudadesPresencia: ["Talca"],
    tipo: "retail",
    ventajas: [
      {
        titulo: "Materiales de obra completos",
        competidor:
          "Foco fuerte en madera y tableros; otras categorías estructurales con surtido limitado.",
        jurmaq:
          "Cubrimos toda la obra: fierros, cemento, áridos, perfiles metálicos, mallas, planchas, fijaciones, además de terciados y OSB.",
      },
      {
        titulo: "Despacho desde Molina al Maule",
        competidor:
          "Despachos según logística de la cadena nacional.",
        jurmaq:
          "Despacho local con tiempos de tu mismo día: Curicó 30 min, Talca 1h, otros sectores coordinados.",
      },
      {
        titulo: "Mejor precio garantizado",
        competidor: "Promociones según campañas vigentes.",
        jurmaq:
          "Sube tu cotización formal en /cotizar y respondemos con un precio mejor en menos de 2 horas.",
      },
    ],
    faq: [
      {
        pregunta: "¿Tienen tableros y terciados como Imperial?",
        respuesta:
          "Sí. Terciado fenólico, OSB, MDF, contrachapado y tableros melamínicos. Stock de obra y terminaciones, pero no la línea boutique de Imperial.",
      },
      {
        pregunta: "¿Puedo armar una obra completa con JURMAQ?",
        respuesta:
          "Sí. Cubrimos desde fundación (cemento, áridos, fierro) hasta terminaciones (perfiles, planchas Volcanita, fijaciones). Para mobiliario/cocina o pisos/cerámica buscar tienda especializada.",
      },
    ],
    categoriasFuertes: [
      { slug: "terciados-y-osb", nombre: "Terciados y OSB" },
      { slug: "fierros", nombre: "Fierros y Acero" },
      { slug: "fijaciones-y-tornilleria", nombre: "Fijaciones y Tornillería" },
    ],
  },
] as const;

export function getCompetidor(slug: string): CompetidorData | undefined {
  return COMPETIDORES_DATA.find((c) => c.slug === slug);
}

export function getAllCompetidorSlugs(): string[] {
  return COMPETIDORES_DATA.map((c) => c.slug);
}
