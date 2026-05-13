/**
 * pSEO data — guías informacionales para barraca/guias/[slug].
 *
 * Captura búsquedas "qué es X", "diferencia entre X e Y", "para qué sirve Z"
 * que llevan tráfico a la barraca y educan al cliente. Cada entrada genera
 * una landing estática (SSG) con contenido único, FAQ schema y CTA al
 * catálogo correspondiente.
 *
 * Cómo agregar guía:
 *   1. Añadir entrada con slug único, título, intro, secciones[] y faq[]
 *   2. categoriaSlugRelacionada apunta al catálogo donde el cliente compra
 *   3. Mínimo 600 palabras únicas (no copy-paste de competencia)
 */

export interface GuiaSEO {
  slug: string;
  titulo: string;
  /** Texto SEO description (~160 chars) */
  descripcionMeta: string;
  /** H1 — usualmente más largo que el título del navegador */
  h1: string;
  /** Intro 1-2 párrafos, máx 200 palabras */
  intro: string;
  secciones: Array<{ h2: string; html: string }>;
  faq: Array<{ q: string; a: string }>;
  /** Catálogo donde se compra lo que la guía explica */
  categoriaSlugRelacionada: string;
  categoriaNombre: string;
  /** Para "lecturas relacionadas" en el footer de la guía */
  guiasRelacionadas?: string[];
}

export const GUIAS: GuiaSEO[] = [
  {
    slug: "que-es-fierro-estriado",
    titulo: "Qué es el fierro estriado y para qué sirve",
    descripcionMeta:
      "Fierro estriado: qué es, diámetros estándar (Ø6 a Ø32), grado A630-420H y para qué se usa en losas, muros y fundaciones. Cuantías y tabla NCh 204.",
    h1: "Qué es el Fierro Estriado y Para Qué Sirve",
    intro:
      "El fierro estriado (también llamado fierro corrugado) es la barra de acero con resaltes superficiales (estrías) que se usa como armadura del hormigón armado. Las estrías mejoran la adherencia entre el acero y el hormigón, aumentando significativamente la resistencia del conjunto a tracción y flexión. En Chile la norma NCh 204:2006 regula sus características; el grado más usado es A630-420H, que combina alta resistencia con buena soldabilidad.",
    secciones: [
      {
        h2: "Diámetros estándar y peso por metro",
        html: `<p>En Chile el fierro estriado se vende en diámetros nominales que van desde Ø6 mm hasta Ø32 mm, en barras de 12 metros. Los diámetros más utilizados en construcción de viviendas son:</p>
        <ul>
          <li><strong>Ø8 mm</strong> — 0,395 kg/m. Estribos, mallas de losas pequeñas.</li>
          <li><strong>Ø10 mm</strong> — 0,617 kg/m. Refuerzos en losas, muros, sobrelosas.</li>
          <li><strong>Ø12 mm</strong> — 0,888 kg/m. Vigas, fundaciones de vivienda.</li>
          <li><strong>Ø16 mm</strong> — 1,578 kg/m. Vigas estructurales, columnas.</li>
          <li><strong>Ø22 mm</strong> — 2,984 kg/m. Estructura de edificios, muros de gran altura.</li>
        </ul>
        <p>Una barra de 12 m de Ø10 pesa aproximadamente 7,4 kg.</p>`,
      },
      {
        h2: "Grados de acero (A630-420H, A440-280H)",
        html: `<p>El grado A630-420H es el más vendido en Chile. La nomenclatura significa:</p>
        <ul>
          <li><strong>A630</strong> = tensión de rotura ≥ 630 MPa</li>
          <li><strong>420</strong> = tensión de fluencia ≥ 420 MPa</li>
          <li><strong>H</strong> = soldable (cumple requisitos químicos para soldadura)</li>
        </ul>
        <p>Para obras menores se puede ver A440-280H, pero la mayoría de los calculistas trabajan con A630-420H por seguridad sísmica. NCh 433:2009 (Diseño sísmico) recomienda usar acero soldable en zonas sísmicas como todo el centro-sur de Chile.</p>`,
      },
      {
        h2: "Usos típicos en construcción",
        html: `<p>El fierro estriado es la armadura principal del hormigón armado. Sus aplicaciones más frecuentes:</p>
        <ul>
          <li><strong>Losas</strong> — doble malla en X-Y, típicamente Ø8 o Ø10</li>
          <li><strong>Muros estructurales</strong> — Ø10 o Ø12 con estribos Ø8</li>
          <li><strong>Vigas</strong> — Ø12 a Ø16 longitudinales, Ø8 estribos</li>
          <li><strong>Fundaciones corridas</strong> — 4 fierros Ø10 longitudinales + estribos Ø8 a 20 cm</li>
          <li><strong>Columnas</strong> — Ø12 a Ø22 según carga</li>
        </ul>`,
      },
      {
        h2: "Diferencia con fierro liso",
        html: `<p>El fierro liso (sin estrías) ya casi no se usa en hormigón armado porque la adherencia mecánica es mucho menor. Aún se ve en estribos pequeños o en aplicaciones no estructurales (rejas, parrillas). Para cualquier elemento que cargue peso, la NCh 430 exige fierro estriado.</p>`,
      },
    ],
    faq: [
      {
        q: "¿Cuánto pesa una barra de fierro estriado?",
        a: "Depende del diámetro. Una barra estándar de 12 metros pesa: Ø8 = 4,7 kg; Ø10 = 7,4 kg; Ø12 = 10,7 kg; Ø16 = 18,9 kg; Ø22 = 35,8 kg.",
      },
      {
        q: "¿Cuántas barras hay en un quintal de fierro?",
        a: "1 quintal = 46 kg. Para Ø10 (7,4 kg/barra) son ~6 barras por quintal. Para Ø8 son ~10 barras. Para Ø12 son ~4 barras.",
      },
      {
        q: "¿Se puede soldar el fierro estriado?",
        a: "Solo si es grado soldable (H). El A630-420H sí es soldable. El A440-280H estándar no debería soldarse en zonas estructurales — verificar con calculista.",
      },
      {
        q: "¿Qué fierro lleva una losa de vivienda?",
        a: "Típicamente doble malla Ø8 o Ø10 a 15-20 cm de separación, espesor de losa 12-15 cm. El cálculo definitivo lo hace el calculista según luz libre y cargas.",
      },
    ],
    categoriaSlugRelacionada: "fierros",
    categoriaNombre: "Fierros estriados",
    guiasRelacionadas: ["diferencia-malla-acma-vs-electrosoldada"],
  },
  {
    slug: "diferencia-malla-acma-vs-electrosoldada",
    titulo: "Malla Acma vs Malla Electrosoldada: Diferencias y Cuándo Usar Cada Una",
    descripcionMeta:
      "Diferencias entre malla Acma y malla electrosoldada: medidas C92, C188, C257, usos en losas, sobrelosas y radieres. Cuál conviene para tu obra.",
    h1: "Malla Acma vs Malla Electrosoldada · Diferencias y Usos",
    intro:
      "Acma es una marca chilena de mallas de acero electrosoldadas (similar a 'Confort' para colchones). Cuando alguien dice 'malla Acma' usualmente se refiere a una malla electrosoldada de cualquier marca. Las medidas estándar como C92, C188, C257 son las mismas para todas las marcas. La diferencia real está en la calidad del acero, el control de fábrica y la garantía. Acma es la más reconocida del mercado, pero hay alternativas competitivas.",
    secciones: [
      {
        h2: "¿Qué significa C92, C188, C257?",
        html: `<p>La nomenclatura C-XXX indica el área de acero por metro lineal en cm². Por ejemplo:</p>
        <ul>
          <li><strong>C92</strong> — 0,92 cm²/m, malla Ø4,2 a 15×15 cm. Sobrelosas, radieres residenciales.</li>
          <li><strong>C188</strong> — 1,88 cm²/m, malla Ø6 a 15×15 cm. Losas pequeñas, radieres con tránsito.</li>
          <li><strong>C257</strong> — 2,57 cm²/m, malla Ø7 a 15×15 cm. Losas estructurales livianas.</li>
          <li><strong>C295</strong> — 2,95 cm²/m, malla Ø7,5 a 15×15 cm. Losas estructurales medianas.</li>
          <li><strong>C503</strong> — 5,03 cm²/m, malla Ø10 a 15×15 cm. Losas estructurales pesadas.</li>
        </ul>
        <p>Las planchas estándar son 6 × 2,15 m (12,9 m² por plancha).</p>`,
      },
      {
        h2: "¿Cuándo usar malla en vez de fierro suelto?",
        html: `<p>La malla electrosoldada es más rápida de instalar que armar con fierro estriado suelto, especialmente en superficies grandes y planas. Conviene cuando:</p>
        <ul>
          <li>El elemento es <strong>plano y de geometría simple</strong> (radier, sobrelosa, losa de garage)</li>
          <li>Buscas <strong>velocidad de obra</strong> y reducir mano de obra de enfierrado</li>
          <li>El calculista lo permitió (no todas las losas estructurales aceptan malla)</li>
        </ul>
        <p>El fierro estriado suelto sigue siendo necesario en muros, vigas, columnas, fundaciones corridas y cualquier elemento donde el calculista exige diámetros mayores a Ø10 o configuraciones específicas.</p>`,
      },
      {
        h2: "Diferencia con malla 'no estructural' (gallineros)",
        html: `<p>OJO: hay mallas que parecen Acma pero NO son estructurales. Las mallas de gallinero, hexagonales o tipo cerco no tienen el grado de acero ni la geometría para hormigón armado. Compra siempre malla electrosoldada certificada con sello NCh, especialmente para cualquier elemento que cargue peso.</p>`,
      },
    ],
    faq: [
      {
        q: "¿Qué malla lleva un radier residencial?",
        a: "Generalmente C92 o C188. Para garages o radieres con tránsito vehicular, sube a C257 o C295.",
      },
      {
        q: "¿Cuánto mide una plancha de malla Acma?",
        a: "Las planchas estándar son 6 × 2,15 m (12,9 m²). Algunas marcas también ofrecen 5 × 2 m.",
      },
      {
        q: "¿Es Acma marca o tipo de malla?",
        a: "Acma es una marca chilena específica de mallas electrosoldadas. En el lenguaje cotidiano se usa como sinónimo de 'malla electrosoldada' aunque no lo sea.",
      },
      {
        q: "¿Se puede traslapar malla Acma?",
        a: "Sí. El traslape mínimo recomendado es de 1 cuadro completo (15-20 cm) más diámetro de barra. Para malla estructural verificar con calculista (NCh 430).",
      },
    ],
    categoriaSlugRelacionada: "mallas",
    categoriaNombre: "Mallas electrosoldadas",
    guiasRelacionadas: ["que-es-fierro-estriado"],
  },
  {
    slug: "tipos-de-cemento-construccion",
    titulo: "Tipos de Cemento en Chile: Polpaico, Melón y Sus Usos",
    descripcionMeta:
      "Tipos de cemento usados en Chile: Polpaico, Melón, BioBio. Diferencias entre cemento corriente, alta resistencia, especial. Cuál usar para hormigón, mortero o estuco.",
    h1: "Tipos de Cemento en Chile y Para Qué Sirve Cada Uno",
    intro:
      "En Chile el mercado del cemento está dominado por tres marcas: Polpaico, Melón y BioBio. Las tres producen variedades para distintos usos: hormigón estructural, mortero de pega, estuco, albañilería. Saber cuál usar evita problemas de fraguado, fisuras y resistencia. Esta guía resume los tipos más comunes y sus aplicaciones, según la norma chilena NCh 148.",
    secciones: [
      {
        h2: "Cemento Portland Puzolánico (alta resistencia)",
        html: `<p>El Polpaico Especial, Melón Súper y BioBio Especial son cementos con adición de puzolana que ofrecen mayor durabilidad ante ambientes agresivos (cloruros, sulfatos, agua de mar). Aplicaciones:</p>
        <ul>
          <li>Hormigón estructural de viviendas y edificios (H-25, H-30)</li>
          <li>Fundaciones corridas y losas</li>
          <li>Obras en zonas costeras o industriales</li>
        </ul>
        <p>Bolsas de 25 kg o 42,5 kg estándar. La de 42,5 es la más usada en obra mediana.</p>`,
      },
      {
        h2: "Cemento de Albañilería",
        html: `<p>Polpaico Albañilería, Melón Maestro, BioBio Maestro. Es un cemento mezclado con cal hidratada y aditivos, diseñado para mortero de pega de ladrillos, bloques, y para estuco grueso. NO debe usarse para hormigón estructural — su resistencia a compresión es menor.</p>
        <ul>
          <li>Pega de ladrillos cerámicos y bloques de hormigón</li>
          <li>Estuco grueso interior y exterior</li>
          <li>Reparaciones menores</li>
        </ul>`,
      },
      {
        h2: "Cemento corriente vs alta resistencia",
        html: `<p>Comercialmente:</p>
        <ul>
          <li><strong>Corriente</strong>: resistencia 25-30 MPa a 28 días. Para vivienda 1-2 pisos.</li>
          <li><strong>Alta resistencia / Especial</strong>: 30-40 MPa. Para edificios, fundaciones cargadas, zonas sísmicas exigentes.</li>
        </ul>
        <p>El calculista define la dosificación H-XX (H-20, H-25, H-30) según la estructura. Pedir la bolsa correcta evita demoler obra ya hecha.</p>`,
      },
      {
        h2: "Almacenamiento y vencimiento",
        html: `<p>El cemento absorbe humedad del aire y se endurece (fragua antes de tiempo). Por eso:</p>
        <ul>
          <li>Almacenar bajo techo, sobre tarimas (no en contacto con piso)</li>
          <li>Cubrir con plástico si la bodega es húmeda</li>
          <li>Vencimiento típico: 60 días desde fabricación</li>
          <li>Si la bolsa tiene "rocas" duras al tacto, ya frenó — no usar en estructural</li>
        </ul>`,
      },
    ],
    faq: [
      {
        q: "¿Cuántos sacos de cemento por m³ de hormigón?",
        a: "Para H-25 (cemento + áridos + agua) son ~7-8 sacos de 42,5 kg por m³. La dosificación exacta la indica el calculista según resistencia requerida.",
      },
      {
        q: "¿Qué cemento usar para estuco?",
        a: "Cemento de albañilería (Polpaico Albañilería, Melón Maestro). NO usar cemento estructural para estuco — fragua muy rápido y se fisura.",
      },
      {
        q: "¿Es lo mismo cemento Polpaico que Melón?",
        a: "No. Son marcas distintas con composiciones similares pero levemente distintas. Para obra residencial los tres principales (Polpaico, Melón, BioBio) son intercambiables si la categoría es la misma (Especial vs Albañilería).",
      },
      {
        q: "¿Cuánto pesa un saco de cemento?",
        a: "Las bolsas estándar son 25 kg o 42,5 kg. La de 42,5 kg es la más usada en obra. Bolsas de 25 kg son para reparaciones menores y particulares.",
      },
    ],
    categoriaSlugRelacionada: "cementos",
    categoriaNombre: "Cementos",
    guiasRelacionadas: ["diferencia-cemento-vs-hormigon"],
  },
  {
    slug: "que-es-zincalum",
    titulo: "Qué es el Zincalum: Plancha Galvanizada con Aluminio",
    descripcionMeta:
      "Zincalum: plancha de acero recubierta con zinc + aluminio. Diferencias con galvanizado puro, espesores estándar (0.35, 0.5, 0.6 mm), usos en techumbre y revestimiento.",
    h1: "Qué es el Zincalum y Cuándo Usarlo en Construcción",
    intro:
      "Zincalum es el nombre comercial de una plancha de acero recubierta con una aleación de zinc (55%) y aluminio (45%) más una pequeña fracción de silicio. La aleación entrega una resistencia a la corrosión hasta 4 veces mayor que el galvanizado puro, manteniendo el costo en un rango competitivo. En Chile es el material estándar de techumbres residenciales e industriales: planchas onduladas, trapezoidales y lisas.",
    secciones: [
      {
        h2: "Diferencia con el galvanizado tradicional",
        html: `<p>El acero galvanizado tradicional tiene un recubrimiento de zinc puro. El zincalum cambia la fórmula:</p>
        <ul>
          <li><strong>Galvanizado</strong> — Recubrimiento 100% zinc. Vida útil ambiente urbano: ~15-20 años.</li>
          <li><strong>Zincalum (Aluzinc)</strong> — Recubrimiento 55% Al + 43.4% Zn + 1.6% Si. Vida útil ambiente urbano: ~30-40 años.</li>
        </ul>
        <p>El aluminio aporta resistencia a alta temperatura (hasta 315°C continuos) y barrera contra corrosión. Por eso es la primera opción en techumbre, donde la plancha está expuesta al sol, lluvia y eventual polvo industrial.</p>`,
      },
      {
        h2: "Espesores y formatos estándar",
        html: `<p>En el mercado chileno los espesores comerciales más usados son:</p>
        <ul>
          <li><strong>0.35 mm</strong> — Económica, para galpones livianos, sombreaderos.</li>
          <li><strong>0.4 mm</strong> — Vivienda económica, gallineros, anexos.</li>
          <li><strong>0.5 mm</strong> — Estándar residencial: techumbre vivienda, revestimiento.</li>
          <li><strong>0.6 mm</strong> — Industrial, naves grandes, alta exposición a viento.</li>
        </ul>
        <p>Largos típicos: 2.0, 2.5, 3.0, 3.66 m (12 pies) y 6.0 m. Los anchos útiles dependen del perfil: ondulada ~840 mm, trapezoidal ~890 mm.</p>`,
      },
      {
        h2: "Perfiles disponibles",
        html: `<p>El zincalum no es solo plancha lisa. Los perfiles más vendidos:</p>
        <ul>
          <li><strong>Ondulada</strong> — Onda sinusoidal, 76 mm × 18 mm de altura. Económica, residencial.</li>
          <li><strong>Trapezoidal (5V o 7V)</strong> — Mayor rigidez, mejor escurrimiento de agua. Estándar industrial.</li>
          <li><strong>Tipo teja</strong> — Imita teja cerámica, decorativa, residencial alto estándar.</li>
          <li><strong>Plancha lisa</strong> — Para revestimientos planos, ductos, mantenciones.</li>
        </ul>`,
      },
      {
        h2: "Cuándo NO usar zincalum",
        html: `<p>Aunque es la primera opción residencial e industrial, hay casos donde otros materiales son mejores:</p>
        <ul>
          <li><strong>Ambiente costero salino severo</strong> — Considerar prepintado con poliéster o aluminio puro.</li>
          <li><strong>Bodegas con químicos corrosivos</strong> — Verificar compatibilidad con el agente.</li>
          <li><strong>Contacto directo con cobre o grafito</strong> — Genera par galvánico, acelera corrosión.</li>
          <li><strong>Inmersión en agua</strong> — Zincalum no está diseñado para piscinas o estanques.</li>
        </ul>
        <p>Para fijación, usar tornillos autoperforantes con golilla EPDM (la goma evita filtraciones).</p>`,
      },
    ],
    faq: [
      {
        q: "¿Cuánto dura una plancha de zincalum?",
        a: "En ambiente urbano normal, 30-40 años antes de necesitar mantención. En ambiente costero, 15-25 años. La vida útil real depende de la exposición a sal, polvo industrial y mantención (limpieza periódica de hojas y polvo).",
      },
      {
        q: "¿Se puede pintar el zincalum?",
        a: "Sí. Existen líneas prepintadas de fábrica (zincalum prepintado en colores) y también puede pintarse en obra con esmalte para metales no ferrosos. Antes de pintar limpiar bien y aplicar promotor de adherencia.",
      },
      {
        q: "¿Qué espesor de zincalum elegir para techumbre vivienda?",
        a: "0.5 mm es el estándar residencial. 0.4 mm es aceptable para anexos y proyectos económicos, pero suena más con la lluvia y se deforma más fácil ante caída de objetos.",
      },
      {
        q: "¿Es el zincalum el mismo que el aluzinc?",
        a: "Sí. Aluzinc, Galvalume y Zincalum son nombres comerciales del mismo tipo de plancha (acero recubierto con aleación de Zn-Al). La marca registrada Zincalum la lleva la mayoría del mercado chileno.",
      },
    ],
    categoriaSlugRelacionada: "planchas-techumbre",
    categoriaNombre: "Planchas de techumbre",
    guiasRelacionadas: ["que-es-malla-galvanizada"],
  },
  {
    slug: "diferencia-cemento-vs-hormigon",
    titulo: "Diferencia entre Cemento y Hormigón: La Confusión Más Común",
    descripcionMeta:
      "Cemento vs hormigón: el cemento es el aglomerante (polvo gris en bolsa), el hormigón es la mezcla resultante (cemento + arena + gravilla + agua). Mortero, lechada y dosificaciones explicadas.",
    h1: "Cemento vs Hormigón: Diferencias y Cuándo Usar Cada Uno",
    intro:
      "Es una confusión clásica en obra: pedir 'cemento' cuando en realidad necesitas hormigón, o pedir hormigón cuando solo necesitas cemento para hacer la mezcla. La diferencia es simple pero importante: el cemento es solo uno de los ingredientes; el hormigón es el resultado de mezclarlo con áridos y agua. Esta guía aclara los términos para que pidas exactamente lo que necesitas.",
    secciones: [
      {
        h2: "Cemento: el aglomerante",
        html: `<p>El cemento Portland es un polvo fino gris-blancuzco hecho a partir de clinker molido (fabricado en hornos a 1.450°C) y yeso. Sus características:</p>
        <ul>
          <li>Se vende en sacos de 25 kg o 42.5 kg</li>
          <li>Marcas chilenas: Polpaico, Melón, BioBio</li>
          <li>Solo, no sirve para construir — necesita áridos y agua para formar masa estructural</li>
          <li>Función: aglomerante (pega los áridos al endurecer)</li>
        </ul>
        <p>Pedir solo "cemento" en una barraca te entrega bolsas. La obra debe mezclar el cemento con áridos en obra para hacer hormigón.</p>`,
      },
      {
        h2: "Hormigón: la mezcla resultante",
        html: `<p>El hormigón es el material que resulta de mezclar cemento + arena + gravilla + agua en proporciones específicas. Sus tipos según resistencia (NCh 170:2016):</p>
        <ul>
          <li><strong>H5</strong> — Pobre, para emplantillado bajo radieres.</li>
          <li><strong>H15-H20</strong> — Estándar residencial: radieres, sobrelosas, fundaciones menores.</li>
          <li><strong>H25-H30</strong> — Estructural: vigas, muros, losas armadas.</li>
          <li><strong>H35+</strong> — Especial: edificios, grandes luces, alta exposición.</li>
        </ul>
        <p>El hormigón puede entregarse en obra ya mezclado desde un mixer (planta de hormigón) o hacerse en obra con betonera. Para estructural certificado, siempre planta con ensayos cilíndricos.</p>`,
      },
      {
        h2: "Mortero, lechada, estuco — los términos hermanos",
        html: `<p>Hay otras mezclas de cemento que no son hormigón. Cada una con composición distinta:</p>
        <ul>
          <li><strong>Mortero</strong> — Cemento + arena + agua (sin gravilla). Para pegar ladrillos, bloques.</li>
          <li><strong>Lechada</strong> — Cemento + agua, fluida. Para inyectar fisuras, sellar muros, mejorar adherencia.</li>
          <li><strong>Estuco</strong> — Mortero fino con arena cernida + cal. Para revestir muros (acabado).</li>
          <li><strong>Hormigón</strong> — Cemento + arena + gravilla + agua. Estructural.</li>
        </ul>`,
      },
      {
        h2: "¿Cuánto cemento lleva 1 m³ de hormigón?",
        html: `<p>Aproximación rápida (puede variar con calculista):</p>
        <ul>
          <li><strong>H15</strong> — ~6 sacos 25 kg / m³</li>
          <li><strong>H20</strong> — ~7 sacos 25 kg / m³</li>
          <li><strong>H25</strong> — ~9 sacos 25 kg / m³</li>
          <li><strong>H30</strong> — ~11 sacos 25 kg / m³</li>
        </ul>
        <p>Plus arena (~0.5 m³/m³) y gravilla (~0.8 m³/m³). Para obras grandes pedir hormigón premezclado certificado en lugar de fabricar en obra.</p>`,
      },
    ],
    faq: [
      {
        q: "¿Puedo usar solo cemento sin arena para un radier?",
        a: "No. El cemento puro fragua y se contrae, fisurándose. SIEMPRE va mezclado con arena y gravilla para hacer hormigón. La proporción típica para radier es 1:3:5 (cemento:arena:gravilla).",
      },
      {
        q: "¿Cómo se hace hormigón en obra?",
        a: "Mezcla en betonera o piscina: 1 saco de cemento (25 kg) + 3 partes arena + 5 partes gravilla + agua hasta consistencia plástica. Mezclar 3-5 minutos. Para estructural usar planta certificada en lugar de mezcla manual.",
      },
      {
        q: "¿Es lo mismo concreto que hormigón?",
        a: "Sí. 'Concreto' es el término en otros países hispanohablantes (Mexico, Colombia, Perú). En Chile decimos hormigón. Materialmente es lo mismo.",
      },
      {
        q: "¿Cuándo pedir hormigón premezclado vs hacer en obra?",
        a: "Para volúmenes mayores a 5 m³ o elementos estructurales (vigas, muros, losas armadas), siempre premezclado certificado. Para radieres, contrapisos, fundaciones menores o trabajos puntuales, mezcla en obra es aceptable.",
      },
    ],
    categoriaSlugRelacionada: "cementos",
    categoriaNombre: "Cementos",
    guiasRelacionadas: ["tipos-de-cemento-construccion"],
  },
  {
    slug: "como-elegir-pintura-fachada",
    titulo: "Cómo Elegir Pintura para Fachada: Guía Completa",
    descripcionMeta:
      "Cómo elegir pintura para fachada: tipos (látex acrílico, elastomérico, siliconado), preparación del muro, colores, rendimiento por m² y duración. Errores comunes a evitar.",
    h1: "Cómo Elegir la Pintura Correcta para tu Fachada",
    intro:
      "Pintar una fachada parece simple — eliges el color, compras la pintura, aplicas. Pero entre la pintura del living y la pintura para fachada hay diferencias críticas: resistencia UV, expansión térmica, impermeabilidad. Elegir mal te puede costar repintar a los 18 meses cuando una buena pintura debería durar 5-7 años. Esta guía te ayuda a decidir.",
    secciones: [
      {
        h2: "Tipos de pintura de fachada",
        html: `<p>Las opciones más comunes en el mercado chileno:</p>
        <ul>
          <li><strong>Látex acrílico estándar</strong> — Económica, 3-5 años de duración. Para zonas protegidas del sol directo.</li>
          <li><strong>Látex acrílico premium (100% acrílico)</strong> — Resiste mejor UV. 5-7 años. Estándar recomendado.</li>
          <li><strong>Elastomérica</strong> — Pintura "estirable" que se adapta a fisuras del muro. 7-10 años. Para muros con fisuras o microgrietas.</li>
          <li><strong>Siliconada</strong> — Hidrofóbica (repele agua), permite respirar al muro. 10-15 años. Premium.</li>
          <li><strong>A la cal</strong> — Tradicional chilena, color blanco-pastel, muy económica. 1-2 años. Aspecto rústico.</li>
        </ul>`,
      },
      {
        h2: "Preparación del muro: el 70% del trabajo",
        html: `<p>Una pintura premium aplicada sobre un muro mal preparado dura menos que una pintura estándar bien aplicada. La preparación debe incluir:</p>
        <ol>
          <li><strong>Limpieza</strong> — Lavado a presión o cepillado. Eliminar polvo, hongos, eflorescencias (manchas blancas de salitre).</li>
          <li><strong>Reparación</strong> — Tapar fisuras con sellador acrílico o cementicio. Lijar protuberancias.</li>
          <li><strong>Imprimante o sellador</strong> — Especialmente en muros nuevos o muy porosos. Mejora adherencia y rendimiento.</li>
          <li><strong>Antihongo</strong> — En zonas húmedas (sur de Chile) aplicar fungicida antes de pintar.</li>
          <li><strong>Tiempo de espera</strong> — Estuco nuevo: esperar 28 días antes de pintar.</li>
        </ol>`,
      },
      {
        h2: "Rendimiento y manos a aplicar",
        html: `<p>Rendimiento típico por mano (1 mano significa pasar la brocha o rodillo una vez sobre toda la superficie):</p>
        <ul>
          <li>Látex fachada estándar — 8-10 m²/L por mano</li>
          <li>Látex 100% acrílico — 8-9 m²/L por mano</li>
          <li>Elastomérica — 5-7 m²/L por mano (pinta más gruesa)</li>
          <li>Siliconada — 7-9 m²/L por mano</li>
        </ul>
        <p>Aplicar mínimo 2 manos. En cambio de color radical (oscuro a claro), 3 manos. Entre cada mano esperar 4-6 horas según fabricante.</p>`,
      },
      {
        h2: "Errores comunes a evitar",
        html: `<ul>
          <li><strong>Pintar sobre muro húmedo</strong> — La pintura se descascara. Esperar 48h sin lluvia + estuco seco.</li>
          <li><strong>Aplicar bajo sol directo o calor extremo</strong> — La pintura seca antes de extenderse. Pintar mañana o tarde, NO al mediodía.</li>
          <li><strong>Saltarse el imprimante en muros nuevos</strong> — La pintura no adhiere bien y se desprende.</li>
          <li><strong>Usar pintura interior en exterior</strong> — Falla en menos de 1 año.</li>
          <li><strong>Diluir en exceso</strong> — Reduce poder cubriente. Seguir indicaciones del fabricante.</li>
        </ul>`,
      },
    ],
    faq: [
      {
        q: "¿Cuántos años dura una pintura de fachada?",
        a: "Depende del tipo y la preparación. Látex estándar: 3-5 años. Látex 100% acrílico: 5-7 años. Elastomérica: 7-10 años. Siliconada: 10-15 años. La preparación del muro y orientación (norte vs sur, exposición al sol) impacta la duración real.",
      },
      {
        q: "¿Puedo usar pintura interior en una pared exterior protegida (terraza)?",
        a: "No es recomendable. Aunque la pared esté techada, la humedad ambiental y los cambios de temperatura del exterior degradan la pintura interior en pocos meses. Usar pintura exterior de menor calidad antes que pintura interior premium.",
      },
      {
        q: "¿Qué color resiste mejor el sol?",
        a: "Los colores claros (blancos, pastel) reflejan más radiación UV y duran más sin desteñirse. Colores oscuros (negro, rojo, azul intenso) absorben más calor y degradan el aglomerante de la pintura más rápido. Para colores oscuros usar pintura premium con filtros UV.",
      },
      {
        q: "¿Es necesario el imprimante (primer)?",
        a: "Recomendado en: muros nuevos (estuco no pintado antes), muros con cambio de color radical, muros con manchas de humedad, y muros muy porosos. En muros ya pintados que solo necesitan refresco, se puede saltar.",
      },
    ],
    categoriaSlugRelacionada: "pinturas",
    categoriaNombre: "Pinturas",
    guiasRelacionadas: [],
  },
  {
    slug: "tipos-de-tornillos",
    titulo: "Tipos de Tornillos: Madera, Metal, Volcanita y Cuándo Usar Cada Uno",
    descripcionMeta:
      "Tipos de tornillos: para madera, metal, drywall (Volcanita), autoperforantes para techumbre, autotaladrantes. Diámetros, largos, cabezas y aplicaciones reales en obra.",
    h1: "Tipos de Tornillos en Construcción: Guía Completa",
    intro:
      "Un tornillo equivocado puede arruinar una fijación: torna sin agarrar, parte la madera, no perfora el metal o no aguanta el peso. Saber cuál usar es clave en obra. Esta guía resume los tipos más vendidos en barraca chilena con sus aplicaciones reales y errores comunes.",
    secciones: [
      {
        h2: "Tornillo para madera (rosca gruesa)",
        html: `<p>El tornillo de madera tradicional tiene rosca de paso grande con punta aguda. Características:</p>
        <ul>
          <li>Cabeza phillips, plana o avellanada</li>
          <li>Acabado zincado (oxidado a corto plazo) o galvanizado (durable)</li>
          <li>Diámetros estándar: 3, 3.5, 4, 4.5, 5, 6 mm</li>
          <li>Largos: 16 mm a 100 mm</li>
        </ul>
        <p>Para madera blanda (pino, OSB) penetra sin pretaladro. Para madera dura (eucaliptus, lenga) pretaladrar 80% del diámetro evita partir la pieza.</p>`,
      },
      {
        h2: "Tornillo autoperforante para metal (techumbre)",
        html: `<p>Tornillo con punta tipo broca que perfora el metal sin pretaladro. Para fijar planchas de zincalum, perfiles Metalcon, costaneras:</p>
        <ul>
          <li>Cabeza hexagonal con golilla EPDM (impermeabiliza)</li>
          <li>Largos típicos: 35, 45, 55, 65, 75 mm</li>
          <li>Diámetro estándar: 6.3 mm (1/4")</li>
          <li>Capacidad de perforación: hasta 4-6 mm de espesor</li>
        </ul>
        <p>Para techumbre residencial, los más usados son 35 mm (plancha sobre costanera) y 55 mm (cuando hay aislante intermedio).</p>`,
      },
      {
        h2: "Tornillo de drywall (Volcanita)",
        html: `<p>Tornillo fino con cabeza tipo trompeta para no rasgar el cartón yeso:</p>
        <ul>
          <li><strong>Tornillo fino (rosca cerrada)</strong> — Para fijar Volcanita a perfiles Metalcon (metal). 25-45 mm.</li>
          <li><strong>Tornillo grueso (rosca abierta)</strong> — Para fijar Volcanita a estructura de madera. 25-45 mm.</li>
          <li>Acabado fosfatado (negro) — estándar interior</li>
          <li>Cabeza phillips siempre (para máquina atornilladora)</li>
        </ul>
        <p>Profundidad correcta: la cabeza debe quedar 0.5 mm bajo la superficie del cartón sin romperlo. Una atornilladora con embrague de profundidad ayuda.</p>`,
      },
      {
        h2: "Tornillo autotaladrante (Tek)",
        html: `<p>Variante del autoperforante para metales más gruesos. Tiene punta de broca larga que perfora 6-12 mm de metal antes de empezar a roscar. Aplicaciones:</p>
        <ul>
          <li>Fijación de perfiles a estructura metálica gruesa</li>
          <li>Costanera a viga metálica</li>
          <li>Anclajes en estructuras industriales</li>
        </ul>
        <p>Diámetros: 4.8, 5.5, 6.3 mm. Largos: 16 a 50 mm.</p>`,
      },
      {
        h2: "Pernos vs tornillos",
        html: `<p>Confusión común: el <strong>perno</strong> usa tuerca al otro lado para fijar; el <strong>tornillo</strong> rosca directo en el material. Para cargas estructurales pesadas (uniones de vigas, anclajes a hormigón) usar pernos, no tornillos. Para fijaciones secundarias y revestimientos, tornillos.</p>`,
      },
    ],
    faq: [
      {
        q: "¿Qué tornillo usar para fijar plancha de zincalum?",
        a: "Tornillo autoperforante 6.3 mm con cabeza hexagonal y golilla EPDM. Largo 35 mm si es plancha directa sobre costanera, 55 mm si hay aislante o plancha aislante.",
      },
      {
        q: "¿Cuántos tornillos por plancha de Volcanita?",
        a: "Aprox 1 tornillo cada 25-30 cm en perímetro y 30-40 cm en interior. Para una plancha estándar 1.20 × 2.40 m, son ~24-30 tornillos.",
      },
      {
        q: "¿Diferencia entre tornillo zincado y galvanizado?",
        a: "Zincado tiene capa fina de zinc (electroplateado), oxida en exterior en pocos meses. Galvanizado tiene capa más gruesa (inmersión), resiste 5-10 años en exterior. Para techumbre y exterior siempre galvanizado o inox.",
      },
      {
        q: "¿Puedo usar tornillo de madera para metal?",
        a: "No. La punta aguda no perfora metal y la rosca gruesa no agarra en lámina delgada. Usar autoperforante.",
      },
    ],
    categoriaSlugRelacionada: "fijaciones-y-tornilleria",
    categoriaNombre: "Fijaciones y Tornillería",
    guiasRelacionadas: [],
  },
  {
    slug: "que-es-malla-galvanizada",
    titulo: "Qué es la Malla Galvanizada y Para Qué Sirve",
    descripcionMeta:
      "Malla galvanizada: tipos hexagonal (gallinero), cuadrada, ondulada, rejilla. Aperturas estándar, calibres, usos en cierres, jaulas, cernido. Diferencia con malla electrosoldada.",
    h1: "Qué es la Malla Galvanizada y Cuándo Usarla",
    intro:
      "Malla galvanizada es un término genérico para varios tipos de mallas de alambre con recubrimiento de zinc para resistir corrosión. NO confundir con malla electrosoldada (Acma) que es para hormigón armado. La malla galvanizada se usa principalmente en cierres, divisiones, jaulas y cernido — no es estructural. Esta guía aclara los tipos y sus usos.",
    secciones: [
      {
        h2: "Malla hexagonal (gallinero)",
        html: `<p>La más conocida. Tejido en forma de hexágono, ligera, fácil de cortar. Aplicaciones:</p>
        <ul>
          <li>Cierres de gallineros, conejeras, jaulas pequeñas</li>
          <li>Refuerzo de estuco grueso (para evitar fisuración)</li>
          <li>Divisiones temporales, cierre de huertos</li>
          <li>Protección de cultivos contra aves</li>
        </ul>
        <p>Aperturas estándar: 1/2", 5/8", 3/4", 1", 1 1/2". Calibres (grosor del alambre): 19, 20, 22 (más alto = más fino). Rollos típicos 25 m de largo, alturas 0.6 a 1.8 m.</p>`,
      },
      {
        h2: "Malla cuadrada (acmafort, soldada simple)",
        html: `<p>Mallas cuadradas tejidas o soldadas, con aperturas mayores que la hexagonal. Sus aplicaciones:</p>
        <ul>
          <li>Cierre perimetral de patios, casas y bodegas</li>
          <li>División de propiedades</li>
          <li>Jaulas de animales medianos (perros, ovejas)</li>
          <li>Refuerzo de muros de ladrillo (cuando es soldada)</li>
        </ul>
        <p>Aperturas: 25×25 mm, 50×50 mm, 75×75 mm, 100×100 mm. Calibre 8-12 BWG.</p>`,
      },
      {
        h2: "Malla ondulada (cierre industrial)",
        html: `<p>Malla con ondulaciones cruzadas que entrega mayor rigidez y resistencia mecánica. Para cierres de uso intensivo:</p>
        <ul>
          <li>Recintos industriales</li>
          <li>Canchas deportivas (con paño grueso)</li>
          <li>Bodegas y galpones</li>
          <li>Áreas de seguridad media</li>
        </ul>
        <p>Aperturas 50-100 mm, calibre 6-10 BWG. Más resistente al impacto que la cuadrada simple.</p>`,
      },
      {
        h2: "Malla rejilla (mosquitero, cernidores)",
        html: `<p>Mallas finas para usos específicos:</p>
        <ul>
          <li><strong>Mosquitera</strong> — Apertura 1.5 × 1.5 mm, alambre fino. Para ventanas y puertas anti-mosquitos.</li>
          <li><strong>Cernidor</strong> — Apertura 3-5 mm. Para tamizar arena, gravilla, separar áridos.</li>
          <li><strong>Filtro industrial</strong> — Aperturas microscópicas para filtración.</li>
        </ul>`,
      },
      {
        h2: "Diferencia con malla electrosoldada (Acma)",
        html: `<p>La malla electrosoldada Acma es estructural (para hormigón armado, losas, sobrelosas). La malla galvanizada es para cierres y usos no estructurales. Confundirlas trae problemas:</p>
        <ul>
          <li>Usar malla galvanizada en una losa = falla estructural (no tiene la ductilidad ni el grado de acero correcto)</li>
          <li>Usar Acma en un cierre = es caro y oxida sin galvanizado</li>
        </ul>
        <p>Acma se vende en planchas (6 × 2.15 m), galvanizada en rollos.</p>`,
      },
    ],
    faq: [
      {
        q: "¿Cuánto dura una malla hexagonal galvanizada?",
        a: "Calidad estándar: 8-12 años en ambiente urbano normal. En zona costera (salina) o agrícola con humedad alta: 5-8 años. Para mayor durabilidad usar PVC sobre galvanizado (recubrimiento plástico).",
      },
      {
        q: "¿Qué calibre de malla usar para gallinero?",
        a: "Calibre 20-21 con apertura 1/2 a 5/8 pulgadas. Suficiente para gallinas adultas. Para pollitos chicos usar apertura 1/4 pulgada para evitar que pasen.",
      },
      {
        q: "¿Sirve la malla hexagonal para reforzar estuco?",
        a: "Sí, en muros con riesgo de fisuración (uniones de materiales distintos, esquinas). Se clava sobre el muro antes del estuco grueso, ayuda a distribuir tensiones y reduce fisuras.",
      },
      {
        q: "¿Diferencia entre galvanizado tejido y soldado?",
        a: "Tejido: alambres entrelazados, más flexible, se usa en mallas hexagonales y mosquiteros. Soldado: alambres con uniones soldadas en cada cruce, más rígido, se usa en mallas cuadradas para cierres y jaulas. Soldada es más resistente al impacto y deformación.",
      },
    ],
    categoriaSlugRelacionada: "mallas-y-cierros",
    categoriaNombre: "Mallas y cierres",
    guiasRelacionadas: ["diferencia-malla-acma-vs-electrosoldada", "que-es-zincalum"],
  },
];

export function getGuia(slug: string): GuiaSEO | undefined {
  return GUIAS.find((g) => g.slug === slug);
}
