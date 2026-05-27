/**
 * Recursos JURMAQ — guías informacionales para constructora/recursos/[slug].
 *
 * Captura búsquedas "precio arriendo X", "qué máquina usar para Y", "cómo calcular Z"
 * con baja competencia local en la Región del Maule. Cada entrada genera una landing
 * estática (SSG) con contenido único (~600-1000 palabras), FAQ schema, breadcrumbs y
 * CTA al catálogo de arriendo y WhatsApp.
 *
 * Cómo agregar recurso:
 *   1. Añadir entrada con slug único, h1, resumen, secciones[] y faq[]
 *   2. categoria entre 'maquinaria' | 'arriendo' | 'construccion' | 'tecnico'
 *   3. Mínimo 600 palabras únicas (no copy-paste de competencia) para evitar
 *      penalty de thin content (playbook pSEO)
 *   4. Sumar `relacionados` con slugs de otros artículos del mismo cluster
 */

export type RecursoCategoria = 'maquinaria' | 'arriendo' | 'construccion' | 'tecnico';

export interface RecursoSEO {
  slug: string;
  titulo: string;
  /** Texto para SEO description (≤155 chars). */
  descripcionMeta: string;
  /** H1 — usualmente más descriptivo que el title de pestaña. */
  h1: string;
  /** Resumen 1-2 oraciones, self-contained (apunta a featured snippet). */
  resumen: string;
  secciones: Array<{ h2: string; html: string }>;
  faq: Array<{ q: string; a: string }>;
  fechaPublicacion: string; // ISO "YYYY-MM-DD"
  fechaModificacion?: string;
  categoria: RecursoCategoria;
  keywordsObjetivo: string[];
  /** Path bajo /public, opcional (si no, se usa /icon-512.png). */
  imagenHero?: string;
  /** Slugs de otros recursos relacionados (cluster topical). */
  relacionados?: string[];
}

export const CATEGORIA_LABEL: Record<RecursoCategoria, string> = {
  maquinaria: 'Maquinaria',
  arriendo: 'Arriendo',
  construccion: 'Construcción',
  tecnico: 'Técnico',
};

export const RECURSOS: RecursoSEO[] = [
  {
    slug: 'precio-arriendo-retroexcavadora-chile',
    titulo: 'Cuánto cuesta arrendar una retroexcavadora en Chile (2026)',
    descripcionMeta:
      'Rangos reales de precio para arriendo de retroexcavadora en Chile: por hora, día, semana y mes. Con o sin operador, traslado, IVA. Referencia 2026 Región del Maule.',
    h1: 'Cuánto Cuesta Arrendar una Retroexcavadora en Chile (Guía 2026)',
    resumen:
      'En 2026 el arriendo de una retroexcavadora en Chile oscila entre $25.000 y $35.000 por hora con operador, $230.000 a $450.000 por día y $1.200.000 a $2.200.000 por semana. El valor depende de modelo, operador y traslado.',
    categoria: 'arriendo',
    keywordsObjetivo: [
      'precio arriendo retroexcavadora chile',
      'cuanto cuesta arrendar retroexcavadora',
      'valor arriendo retroexcavadora 2026',
      'tarifa retroexcavadora hora dia',
      'arriendo retroexcavadora maule',
      'arriendo retroexcavadora curico',
    ],
    fechaPublicacion: '2026-05-27',
    secciones: [
      {
        h2: 'Rangos de precio en Chile (referencia 2026)',
        html: `<p>El valor de arriendo de una retroexcavadora en Chile varía según la duración, si incluye operador y si hay traslado. Estos son rangos referenciales para una retroexcavadora estándar tipo Caterpillar 416, JCB 3CX o HMK 102B (75–95 HP, 7.5–8.5 toneladas) en la zona central:</p>
        <table style="width:100%;border-collapse:collapse;margin-top:12px">
          <thead><tr style="background:#f3f4f6"><th style="padding:8px;text-align:left;border:1px solid #e5e7eb">Modalidad</th><th style="padding:8px;text-align:left;border:1px solid #e5e7eb">Sin operador</th><th style="padding:8px;text-align:left;border:1px solid #e5e7eb">Con operador</th></tr></thead>
          <tbody>
            <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Por hora</strong></td><td style="padding:8px;border:1px solid #e5e7eb">$18.000 – $25.000</td><td style="padding:8px;border:1px solid #e5e7eb">$25.000 – $35.000</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Por día (8 hrs)</strong></td><td style="padding:8px;border:1px solid #e5e7eb">$170.000 – $300.000</td><td style="padding:8px;border:1px solid #e5e7eb">$230.000 – $450.000</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Por semana</strong></td><td style="padding:8px;border:1px solid #e5e7eb">$900.000 – $1.600.000</td><td style="padding:8px;border:1px solid #e5e7eb">$1.200.000 – $2.200.000</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb"><strong>Por mes</strong></td><td style="padding:8px;border:1px solid #e5e7eb">$3.200.000 – $5.500.000</td><td style="padding:8px;border:1px solid #e5e7eb">$4.500.000 – $7.500.000</td></tr>
          </tbody>
        </table>
        <p style="margin-top:12px"><em>Valores netos referenciales (no incluyen IVA). Pueden variar según marca, año y disponibilidad. Los valores reales de JURMAQ se cotizan según obra específica.</em></p>`,
      },
      {
        h2: 'Factores que afectan el precio',
        html: `<p>El rango anterior se mueve principalmente por seis variables:</p>
        <ul>
          <li><strong>Operador</strong> — sumar operador certificado agrega ~$60.000 a $120.000 al día (incluye su sueldo, leyes sociales, alimentación y EPP).</li>
          <li><strong>Duración del arriendo</strong> — a mayor plazo, menor tarifa unitaria. Una semana tiene descuento de 15–25% sobre la suma de días sueltos; un mes baja otro 20–30%.</li>
          <li><strong>Traslado al sitio de obra</strong> — la retroexcavadora se mueve en camión cama-baja. Cobro típico entre $80.000 (radio 30 km) y $250.000 (radio 100 km), ida y vuelta. En JURMAQ el traslado a Curicó, Molina, Teno, Romeral y Sagrada Familia se cotiza con tarifa preferente por cercanía.</li>
          <li><strong>Modelo y año</strong> — máquinas con menos de 5 años y horómetro bajo cobran 10–15% más que máquinas de la misma capacidad pero más antiguas.</li>
          <li><strong>Combustible</strong> — algunos arriendos lo incluyen, otros lo cobran aparte (~12–18 L/hora de diésel a precio surtidor).</li>
          <li><strong>Ubicación</strong> — la Región Metropolitana suele cobrar 10–20% más que la Región del Maule por el mismo equipo, por mayor demanda y costo operacional.</li>
        </ul>`,
      },
      {
        h2: 'Qué incluye un arriendo profesional',
        html: `<p>Cuando recibes una cotización de retroexcavadora seria, debería incluir:</p>
        <ul>
          <li><strong>Máquina con mantención al día</strong> (filtros, aceites, hidráulico) y revisión pre-entrega documentada.</li>
          <li><strong>Operador certificado</strong> con licencia Clase D vigente, curso Sernageomin de operación de equipos y EPP completo.</li>
          <li><strong>Póliza de responsabilidad civil</strong> que cubre daños a terceros causados por la máquina.</li>
          <li><strong>Soporte técnico</strong> ante falla mecánica con tiempo de respuesta acotado.</li>
          <li><strong>Contrato escrito</strong> con condiciones de uso, horario, responsabilidades y procedimiento ante daños o atrasos.</li>
        </ul>
        <p>Un precio muy bajo puede ocultar máquina sin mantención al día, operador sin curso o ausencia de seguro — riesgos que terminan costando mucho más caro si algo falla en obra.</p>`,
      },
      {
        h2: 'Cuándo conviene cada modalidad',
        html: `<p>Regla simple según tu obra:</p>
        <ul>
          <li><strong>Por hora</strong> — para trabajos puntuales menores a 4 horas (cargar un camión, abrir una zanja corta). Mínimo 4 horas en la mayoría de los contratos.</li>
          <li><strong>Por día</strong> — para trabajos de 1–3 días (fundación de vivienda, instalación de matriz, demolición ligera).</li>
          <li><strong>Por semana</strong> — para obras de 5–7 días seguidos. Tarifa unitaria es 30–40% más baja que pagar día por día.</li>
          <li><strong>Por mes</strong> — para obras grandes (movimiento de tierra de loteo, urbanización). Tarifa unitaria es la mejor y suele incluir traslado bonificado.</li>
        </ul>`,
      },
      {
        h2: 'Cómo cotizar bien',
        html: `<p>Para que la cotización sea precisa y comparable entre proveedores, prepara estos datos antes de pedirla:</p>
        <ul>
          <li><strong>Ubicación de la obra</strong> (comuna y dirección aproximada) para calcular flete.</li>
          <li><strong>Fechas estimadas</strong> y plazo total (afecta la tarifa unitaria).</li>
          <li><strong>Si requieres operador</strong> o aportas el tuyo (con licencia y curso al día).</li>
          <li><strong>Tipo de trabajo</strong> (excavación, carga, demolición) para confirmar que la máquina aplica.</li>
          <li><strong>Forma de pago</strong> (transferencia, tarjeta o factura a 30 días para empresas).</li>
        </ul>
        <p>En JURMAQ respondemos cotizaciones de arriendo en menos de 2 horas hábiles por WhatsApp.</p>`,
      },
    ],
    faq: [
      {
        q: '¿Cuánto cuesta arrendar una retroexcavadora por día con operador?',
        a: 'En 2026, en Chile central, una retroexcavadora estándar con operador cuesta entre $230.000 y $450.000 por día (8 horas). El rango depende del modelo, traslado y duración total del arriendo. Para semanas o meses la tarifa unitaria baja 20–30%.',
      },
      {
        q: '¿Es más barato sin operador?',
        a: 'Sí, entre 25% y 35% más barato si aportas operador propio. Pero el operador debe tener licencia Clase D vigente y curso Sernageomin de operación de equipos. Si no, el contrato exige operador del arrendador.',
      },
      {
        q: '¿Cobran traslado al sitio de obra?',
        a: 'Sí, casi siempre. La retroexcavadora se mueve en camión cama-baja y el flete depende de la distancia. Para obras dentro del Maule (Curicó, Molina, Teno, Talca) JURMAQ ofrece tarifa preferente; fuera del Maule se cotiza por kilómetro.',
      },
      {
        q: '¿Qué pasa si trabajo más horas que las pactadas?',
        a: 'En arriendo por día (8 horas) las horas extras se cobran como hora-máquina aparte, típicamente entre $20.000 y $30.000/hr extra. En arriendo por semana o mes, las horas extra solo se cobran si superan un cap diario, generalmente 10 horas/día.',
      },
    ],
    relacionados: [
      'arriendo-maquinaria-con-o-sin-operador',
      'diferencia-retroexcavadora-miniexcavadora',
      'seguros-y-responsabilidad-arriendo-maquinaria',
    ],
  },
  {
    slug: 'diferencia-retroexcavadora-miniexcavadora',
    titulo: 'Retroexcavadora vs Miniexcavadora: ¿Cuál Elegir?',
    descripcionMeta:
      'Diferencias entre retroexcavadora y miniexcavadora: peso, profundidad, ancho mínimo, casos de uso. Cuándo conviene cada una para tu obra. Comparativa técnica.',
    h1: 'Retroexcavadora vs Miniexcavadora · Cuál Conviene a tu Obra',
    resumen:
      'La retroexcavadora pesa entre 7.500 y 8.500 kg y excava hasta 5,5 m, ideal para obra grande con espacio. La miniexcavadora pesa 1.500–3.500 kg, entra por pasajes de 0,9 m y excava 2,2–3,0 m: ideal para espacios reducidos y trabajo urbano.',
    categoria: 'maquinaria',
    keywordsObjetivo: [
      'diferencia retroexcavadora miniexcavadora',
      'que es mejor retroexcavadora o miniexcavadora',
      'comparativa maquinaria excavacion',
      'miniexcavadora vs retroexcavadora',
      'cuando usar miniexcavadora',
    ],
    fechaPublicacion: '2026-05-27',
    secciones: [
      {
        h2: 'Tabla comparativa rápida',
        html: `<table style="width:100%;border-collapse:collapse;margin-top:12px">
          <thead><tr style="background:#f3f4f6"><th style="padding:8px;text-align:left;border:1px solid #e5e7eb">Característica</th><th style="padding:8px;text-align:left;border:1px solid #e5e7eb">Retroexcavadora</th><th style="padding:8px;text-align:left;border:1px solid #e5e7eb">Miniexcavadora</th></tr></thead>
          <tbody>
            <tr><td style="padding:8px;border:1px solid #e5e7eb">Peso operacional</td><td style="padding:8px;border:1px solid #e5e7eb">7.500 – 8.500 kg</td><td style="padding:8px;border:1px solid #e5e7eb">1.500 – 3.500 kg</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb">Profundidad excavación</td><td style="padding:8px;border:1px solid #e5e7eb">Hasta 5,5 m</td><td style="padding:8px;border:1px solid #e5e7eb">2,2 – 3,0 m</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb">Ancho mínimo de paso</td><td style="padding:8px;border:1px solid #e5e7eb">2,3 – 2,5 m</td><td style="padding:8px;border:1px solid #e5e7eb">Desde 0,9 m</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb">Capacidad balde frontal</td><td style="padding:8px;border:1px solid #e5e7eb">~1,0 m³</td><td style="padding:8px;border:1px solid #e5e7eb">No tiene (solo brazo)</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb">Motor</td><td style="padding:8px;border:1px solid #e5e7eb">75 – 95 HP turbodiésel</td><td style="padding:8px;border:1px solid #e5e7eb">15 – 35 HP diésel</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb">Consumo combustible</td><td style="padding:8px;border:1px solid #e5e7eb">12 – 18 L/h</td><td style="padding:8px;border:1px solid #e5e7eb">2 – 4 L/h</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb">Traslado entre obras</td><td style="padding:8px;border:1px solid #e5e7eb">Requiere cama-baja</td><td style="padding:8px;border:1px solid #e5e7eb">Camión 3/4 o trailer ligero</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb">Daño al piso</td><td style="padding:8px;border:1px solid #e5e7eb">Alto (ruedas, peso)</td><td style="padding:8px;border:1px solid #e5e7eb">Bajo (orugas de goma)</td></tr>
          </tbody>
        </table>`,
      },
      {
        h2: 'Cuándo usar retroexcavadora',
        html: `<p>La retroexcavadora es la opción correcta cuando:</p>
        <ul>
          <li><strong>Hay espacio amplio</strong> en obra (terreno abierto, sin pasajes estrechos).</li>
          <li><strong>Necesitas excavar profundo</strong> — fundaciones de edificio, alcantarillado matriz, fosas sépticas grandes.</li>
          <li><strong>Necesitas cargar camiones</strong> — el balde frontal permite mover áridos, escombros y tierra al camión sin máquina auxiliar.</li>
          <li><strong>El volumen de obra es alto</strong> — su mayor potencia y velocidad de ciclo justifican la tarifa.</li>
          <li><strong>El suelo es duro o con piedras</strong> — la mayor fuerza de arranque hace la diferencia.</li>
        </ul>
        <p>Aplicaciones típicas: fundaciones de casa, instalación de redes (agua potable, alcantarillado, fibra), apertura de zanjas para drenaje, demolición ligera, carga de áridos y movimientos de tierra de loteos.</p>`,
      },
      {
        h2: 'Cuándo usar miniexcavadora',
        html: `<p>La miniexcavadora es la opción correcta cuando:</p>
        <ul>
          <li><strong>El acceso es estrecho</strong> — pasajes residenciales, jardines, patios interiores. Los modelos más chicos (1,5 ton) entran por una puerta estándar de 0,9 m.</li>
          <li><strong>Trabajas en ampliaciones internas</strong> — sin demoler para entrar y salir.</li>
          <li><strong>El piso es delicado</strong> — orugas de goma no marcan baldosas, pasto ni piso terminado.</li>
          <li><strong>La obra es pequeña</strong> — excavación de piscina chica, fosa séptica residencial, zanja para red sanitaria interna.</li>
          <li><strong>El presupuesto es ajustado</strong> — la tarifa diaria es 40–50% más baja que la retroexcavadora.</li>
        </ul>
        <p>Aplicaciones típicas: apertura de zanjas en pasajes, fosas sépticas residenciales, piscinas pequeñas, paisajismo, reposición de redes en zonas urbanas densas y obras menores en condominios.</p>`,
      },
      {
        h2: 'Casos donde no aplica ninguna',
        html: `<p>Si tu trabajo es muy puntual o muy específico, considera alternativas:</p>
        <ul>
          <li><strong>Pozos profundos (>6 m)</strong> — necesitas excavadora sobre orugas (CX130, PC138).</li>
          <li><strong>Compactar áreas amplias</strong> — usa rodillo, no excavadora.</li>
          <li><strong>Hoyos cilíndricos para postes</strong> — más eficiente con minicargador + auger.</li>
          <li><strong>Volumen pequeño en espacio amplio</strong> — a veces sale más barato 2 maestros con palas.</li>
        </ul>`,
      },
      {
        h2: 'Costo comparativo aproximado',
        html: `<p>Como referencia (Región del Maule, 2026, con operador):</p>
        <ul>
          <li><strong>Retroexcavadora</strong> — $230.000–$450.000/día</li>
          <li><strong>Miniexcavadora</strong> — $120.000–$220.000/día</li>
        </ul>
        <p>Para una obra de fundación de vivienda 100 m² (2 días de retro vs 3 días de mini), el costo total termina siendo parecido. La decisión se inclina por acceso y daño al piso, no solo precio.</p>`,
      },
    ],
    faq: [
      {
        q: '¿La miniexcavadora puede reemplazar a la retroexcavadora?',
        a: 'No siempre. Para excavaciones profundas (>3 m), suelos duros o trabajos con mucho volumen, la retroexcavadora rinde 3–4 veces más. Para espacios reducidos, jardines o trabajos urbanos delicados, la mini es la única opción viable.',
      },
      {
        q: '¿Cuál entra a un patio residencial sin daño?',
        a: 'La miniexcavadora pequeña (1,5–2,5 ton) con orugas de goma. Pasa por puertas y portones de 0,9 m, no marca baldosas ni pasto si se usa con planchas de protección bajo las orugas.',
      },
      {
        q: '¿Cuál tiene más fuerza para suelos duros?',
        a: 'La retroexcavadora, por amplia diferencia. Su brazo retroexcavador desarrolla entre 5.000 y 7.500 kg de fuerza de arranque, contra 1.500–3.000 kg de una miniexcavadora estándar. Para suelos rocosos o terrenos compactados, retro siempre.',
      },
      {
        q: '¿Cuál sale más barato por día?',
        a: 'La miniexcavadora cuesta aproximadamente 50% de lo que vale una retroexcavadora por día. Pero rinde menos volumen por hora, así que para obras grandes la retro termina saliendo más barata por m³ excavado.',
      },
    ],
    relacionados: [
      'precio-arriendo-retroexcavadora-chile',
      'como-calcular-volumen-excavacion-zanja',
      'que-maquinaria-elegir-fundacion-casa',
    ],
  },
  {
    slug: 'como-calcular-volumen-excavacion-zanja',
    titulo: 'Cómo Calcular el Volumen de Excavación para una Zanja',
    descripcionMeta:
      'Fórmula y ejemplos prácticos para calcular volumen de excavación de zanjas en m³. Incluye esponjamiento del terreno y rendimiento por máquina. Tabla por sección.',
    h1: 'Cómo Calcular el Volumen de Excavación de una Zanja',
    resumen:
      'El volumen de excavación de una zanja se calcula como largo × ancho × profundidad en metros, lo que entrega m³ en banco. Para transporte y disposición hay que agregar 15–35% por esponjamiento según el tipo de suelo.',
    categoria: 'tecnico',
    keywordsObjetivo: [
      'como calcular volumen excavacion',
      'calculo m3 zanja',
      'volumen excavacion zanja',
      'rendimiento excavacion retroexcavadora',
      'esponjamiento tierra excavada',
    ],
    fechaPublicacion: '2026-05-27',
    secciones: [
      {
        h2: 'Fórmula básica',
        html: `<p>Para una zanja rectangular:</p>
        <p style="background:#f3f4f6;padding:12px;border-radius:6px;font-family:monospace;font-size:1.05rem;text-align:center"><strong>Volumen (m³) = Largo (m) × Ancho (m) × Profundidad (m)</strong></p>
        <p>Ejemplo: una zanja para red sanitaria de 30 m de largo, 0,6 m de ancho y 1,2 m de profundidad:</p>
        <p style="background:#f3f4f6;padding:12px;border-radius:6px;font-family:monospace;text-align:center">30 × 0,6 × 1,2 = <strong>21,6 m³</strong></p>
        <p>Este es el volumen <em>en banco</em> — es decir, el volumen que ocupa el suelo antes de removerlo. Para calcular cuántos camiones tolva necesitas, hay que ajustar por esponjamiento (ver más abajo).</p>`,
      },
      {
        h2: 'Esponjamiento del terreno',
        html: `<p>Al excavar, el suelo "esponja": ocupa más volumen suelto que en su estado natural. El factor de esponjamiento depende del tipo de suelo:</p>
        <table style="width:100%;border-collapse:collapse;margin-top:12px">
          <thead><tr style="background:#f3f4f6"><th style="padding:8px;text-align:left;border:1px solid #e5e7eb">Tipo de suelo</th><th style="padding:8px;text-align:left;border:1px solid #e5e7eb">Factor esponjamiento</th><th style="padding:8px;text-align:left;border:1px solid #e5e7eb">% incremento</th></tr></thead>
          <tbody>
            <tr><td style="padding:8px;border:1px solid #e5e7eb">Arena seca</td><td style="padding:8px;border:1px solid #e5e7eb">1,15</td><td style="padding:8px;border:1px solid #e5e7eb">+15%</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb">Tierra común</td><td style="padding:8px;border:1px solid #e5e7eb">1,25</td><td style="padding:8px;border:1px solid #e5e7eb">+25%</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb">Arcilla</td><td style="padding:8px;border:1px solid #e5e7eb">1,30</td><td style="padding:8px;border:1px solid #e5e7eb">+30%</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb">Roca fracturada</td><td style="padding:8px;border:1px solid #e5e7eb">1,50 – 1,80</td><td style="padding:8px;border:1px solid #e5e7eb">+50 a +80%</td></tr>
          </tbody>
        </table>
        <p style="margin-top:12px">Volviendo al ejemplo: 21,6 m³ en banco × 1,25 (tierra común) = <strong>27 m³</strong> de material suelto a transportar. Con camión tolva de 8 m³ son ~3,4 viajes (redondeas a 4).</p>`,
      },
      {
        h2: 'Anchos típicos según tipo de zanja',
        html: `<p>El ancho mínimo está determinado por el diámetro del tubo y la profundidad (espacio para que el operario trabaje en el fondo). Referencia chilena estándar:</p>
        <ul>
          <li><strong>Cableado eléctrico baja tensión</strong> — 0,3 m de ancho, 0,5–0,8 m de profundidad.</li>
          <li><strong>Fibra óptica / telecomunicaciones</strong> — 0,3 m de ancho, 0,4–0,6 m de profundidad.</li>
          <li><strong>Red sanitaria PVC 110 mm</strong> — 0,6 m de ancho, 1,0–1,5 m de profundidad.</li>
          <li><strong>Red sanitaria PVC 160 mm</strong> — 0,7 m de ancho, 1,2–1,8 m de profundidad.</li>
          <li><strong>Agua potable HDPE 32 mm</strong> — 0,4 m de ancho, 0,8 m de profundidad (bajo solera).</li>
          <li><strong>Matriz sanitaria PVC 200 mm</strong> — 0,8–1,0 m de ancho, 1,5–2,5 m de profundidad.</li>
          <li><strong>Fundación corrida vivienda</strong> — 0,4–0,6 m de ancho, 0,8–1,0 m de profundidad.</li>
        </ul>`,
      },
      {
        h2: 'Rendimiento por máquina',
        html: `<p>Para estimar cuántos días te tomará excavar, considera estos rendimientos referenciales (en m³/hora <em>en banco</em>, suelo común sin obstrucciones):</p>
        <table style="width:100%;border-collapse:collapse;margin-top:12px">
          <thead><tr style="background:#f3f4f6"><th style="padding:8px;text-align:left;border:1px solid #e5e7eb">Máquina</th><th style="padding:8px;text-align:left;border:1px solid #e5e7eb">m³/hora típico</th><th style="padding:8px;text-align:left;border:1px solid #e5e7eb">m³/día (8 h)</th></tr></thead>
          <tbody>
            <tr><td style="padding:8px;border:1px solid #e5e7eb">Retroexcavadora 7,5 ton</td><td style="padding:8px;border:1px solid #e5e7eb">15 – 25</td><td style="padding:8px;border:1px solid #e5e7eb">120 – 200</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb">Miniexcavadora 3,5 ton</td><td style="padding:8px;border:1px solid #e5e7eb">5 – 10</td><td style="padding:8px;border:1px solid #e5e7eb">40 – 80</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb">Miniexcavadora 1,5 ton</td><td style="padding:8px;border:1px solid #e5e7eb">2 – 5</td><td style="padding:8px;border:1px solid #e5e7eb">15 – 40</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb">Excavación manual (1 maestro)</td><td style="padding:8px;border:1px solid #e5e7eb">0,3 – 0,6</td><td style="padding:8px;border:1px solid #e5e7eb">2,5 – 5</td></tr>
          </tbody>
        </table>
        <p style="margin-top:12px">Los 21,6 m³ del ejemplo se hacen en aproximadamente <strong>1,5 horas con retroexcavadora</strong> o entre 4 y 6 horas con miniexcavadora.</p>`,
      },
      {
        h2: 'Otros factores a considerar',
        html: `<ul>
          <li><strong>Profundidad &gt; 1,5 m</strong> — la NCh 3367 (Seguridad en excavaciones) exige entibación o talud según el tipo de suelo. Calcular volumen extra por talud cuando aplique.</li>
          <li><strong>Napa freática alta</strong> — agregar bombeo continuo durante la obra, costo adicional al rendimiento puro de excavación.</li>
          <li><strong>Obstáculos enterrados</strong> — cables eléctricos, gas, agua existentes pueden bajar el rendimiento a la mitad. Pide planos a la empresa eléctrica o sanitaria antes.</li>
          <li><strong>Acopio in-situ vs retiro</strong> — si vas a tapar con el mismo material, solo necesitas excavar y dejar a un lado (sin transporte). Si retiras, suma transporte y disposición en botadero autorizado.</li>
        </ul>`,
      },
    ],
    faq: [
      {
        q: '¿Cómo calculo m³ de excavación rápido?',
        a: 'Multiplica largo × ancho × profundidad en metros. El resultado es m³ en banco. Para camiones de retiro, multiplica por 1,25 (esponjamiento tierra común). Ejemplo: zanja 30 × 0,6 × 1,2 = 21,6 m³ banco = 27 m³ suelto.',
      },
      {
        q: '¿Qué es el esponjamiento de la tierra?',
        a: 'Cuando excavas, el suelo ocupa más volumen suelto que en su estado natural (porque pierde compactación). Tierra común esponja +25%, arcilla +30%, roca fracturada hasta +80%. Es importante para calcular cuántos camiones tolva necesitas.',
      },
      {
        q: '¿Cuántos m³ excava una retroexcavadora por día?',
        a: 'Entre 120 y 200 m³ en banco por jornada de 8 horas en suelo común sin obstáculos. Si el suelo tiene piedras, cables enterrados o napa freática, el rendimiento puede bajar a la mitad.',
      },
      {
        q: '¿Cuándo se necesita entibación en una zanja?',
        a: 'Según la NCh 3367, toda excavación con profundidad mayor a 1,5 m donde haya personas trabajando dentro requiere entibación (paneles de protección) o talud según el ángulo de reposo del suelo. Obligación de seguridad — sin esto no se puede trabajar.',
      },
    ],
    relacionados: [
      'diferencia-retroexcavadora-miniexcavadora',
      'que-maquinaria-elegir-fundacion-casa',
      'glosario-maquinaria-construccion',
    ],
  },
  {
    slug: 'arriendo-maquinaria-con-o-sin-operador',
    titulo: 'Arriendo de Maquinaria con Operador vs Sin Operador',
    descripcionMeta:
      'Pros, contras y costos de arrendar maquinaria con operador certificado vs sin operador. Curso Sernageomin, seguros, responsabilidad y cuándo conviene cada modalidad.',
    h1: 'Arriendo con Operador vs Sin Operador · Qué Conviene',
    resumen:
      'Arrendar con operador agrega entre $60.000 y $120.000 al día pero incluye operador certificado, EPP, leyes sociales y responsabilidad técnica. Sin operador es más barato pero exige licencia Clase D y curso Sernageomin del operador propio.',
    categoria: 'arriendo',
    keywordsObjetivo: [
      'arriendo maquinaria con operador',
      'arriendo maquinaria sin operador',
      'operador retroexcavadora curso',
      'sernageomin maquinaria pesada',
      'arriendo retroexcavadora con operador precio',
    ],
    fechaPublicacion: '2026-05-27',
    secciones: [
      {
        h2: 'Pros y contras de cada modalidad',
        html: `<table style="width:100%;border-collapse:collapse;margin-top:12px">
          <thead><tr style="background:#f3f4f6"><th style="padding:8px;text-align:left;border:1px solid #e5e7eb">Modalidad</th><th style="padding:8px;text-align:left;border:1px solid #e5e7eb">Pros</th><th style="padding:8px;text-align:left;border:1px solid #e5e7eb">Contras</th></tr></thead>
          <tbody>
            <tr>
              <td style="padding:8px;border:1px solid #e5e7eb;vertical-align:top"><strong>Con operador</strong></td>
              <td style="padding:8px;border:1px solid #e5e7eb;vertical-align:top">Operador certificado y experiente · Cubre EPP y leyes sociales · Responsabilidad técnica del arrendador · Sin gestión RR.HH. para tu empresa · Productividad alta desde día 1</td>
              <td style="padding:8px;border:1px solid #e5e7eb;vertical-align:top">Costo diario superior ($60K–$120K extra) · Menos flexibilidad horaria</td>
            </tr>
            <tr>
              <td style="padding:8px;border:1px solid #e5e7eb;vertical-align:top"><strong>Sin operador</strong></td>
              <td style="padding:8px;border:1px solid #e5e7eb;vertical-align:top">Más económico · Tu propio operador (conoces su forma de trabajar) · Sin restricciones horarias del arrendador</td>
              <td style="padding:8px;border:1px solid #e5e7eb;vertical-align:top">Necesitas operador propio con licencia Clase D y curso Sernageomin vigente · Mayor responsabilidad ante daños · Si operador rinde menos, pierdes plata</td>
            </tr>
          </tbody>
        </table>`,
      },
      {
        h2: 'Costo incremental real del operador',
        html: `<p>El cargo adicional por operador no es solo su sueldo. Incluye:</p>
        <ul>
          <li><strong>Sueldo bruto</strong> del operador (calificado, $800K–$1.200K mensual según experiencia)</li>
          <li><strong>Leyes sociales</strong> (~22% extra: AFP, salud, seguro de cesantía)</li>
          <li><strong>Mutual y seguro complementario</strong> (~3%)</li>
          <li><strong>EPP completo</strong> (casco, zapatos seguridad, chaleco reflectante, guantes, protector auditivo) — ~$80.000/operador</li>
          <li><strong>Alimentación</strong> en obras lejanas</li>
          <li><strong>Días de espera entre obras</strong> (el arrendador paga aunque no esté facturando)</li>
        </ul>
        <p>Sumado, el costo real diario de un operador para el arrendador es ~$80.000–$110.000. El cargo al cliente lo cubre y agrega un margen. Si arriendas sin operador y aportas el tuyo, te ahorras esto — pero asumes tú esos costos.</p>`,
      },
      {
        h2: 'Certificación obligatoria del operador',
        html: `<p>Si arriendas sin operador, tu operador debe acreditar:</p>
        <ul>
          <li><strong>Licencia de conducir Clase D</strong> vigente (maquinaria pesada autopropulsada). Se obtiene en Tránsito Municipal con escuela autorizada.</li>
          <li><strong>Curso Sernageomin de Operación de Equipo Pesado</strong> específico para el tipo de máquina (retroexcavadora, excavadora, minicargador). Vigencia: 2 años, renovación con curso de actualización.</li>
          <li><strong>Examen ocupacional al día</strong> (oftalmológico y de audición).</li>
          <li><strong>Mutual o ISL al día</strong> (cubre accidentes en obra).</li>
        </ul>
        <p>El arrendador suele exigir copia de estos documentos antes de entregar la máquina. Si tu operador no tiene curso Sernageomin, no podrás arrendar sin operador legalmente y la responsabilidad ante un accidente cae 100% sobre ti.</p>`,
      },
      {
        h2: 'Responsabilidades del cliente en cada modalidad',
        html: `<p><strong>Con operador:</strong></p>
        <ul>
          <li>Definir y planificar el trabajo (qué excavar, dónde, cómo).</li>
          <li>Suministrar combustible (si el contrato lo estipula).</li>
          <li>Garantizar acceso seguro al sitio (cierre perimetral, señalética).</li>
          <li>Reportar daños o anomalías por escrito al arrendador.</li>
        </ul>
        <p><strong>Sin operador:</strong></p>
        <ul>
          <li>Todo lo anterior, MÁS:</li>
          <li>Capacitación y supervisión del operador propio.</li>
          <li>Mantención básica diaria (chequeo de aceite, agua, neumáticos).</li>
          <li>Responsabilidad ante daños por mal uso, derrame de combustible, accidentes.</li>
          <li>Custodia de la máquina fuera de horario laboral (bodega cerrada, vigilancia).</li>
        </ul>`,
      },
      {
        h2: 'Cuándo conviene cada modalidad',
        html: `<p><strong>Con operador conviene cuando:</strong></p>
        <ul>
          <li>Tu empresa no tiene operador propio o no tiene certificación al día.</li>
          <li>La obra es puntual (1–5 días) y no justifica contratar/mantener operador.</li>
          <li>El trabajo es técnicamente exigente (excavación en pendiente, demolición controlada).</li>
          <li>Necesitas máxima productividad sin curva de aprendizaje.</li>
        </ul>
        <p><strong>Sin operador conviene cuando:</strong></p>
        <ul>
          <li>Tu empresa es una constructora con operadores en planilla.</li>
          <li>La obra es larga (semanas o meses) — la diferencia diaria se acumula.</li>
          <li>Necesitas horarios extendidos o turnos nocturnos que no te entrega el operador del arrendador.</li>
          <li>Eres una empresa con SGSST (sistema de gestión de SST) que cubre operador propio.</li>
        </ul>`,
      },
    ],
    faq: [
      {
        q: '¿Qué licencia necesita el operador de una retroexcavadora?',
        a: 'Licencia de conducir Clase D vigente, emitida por Tránsito Municipal previo curso en escuela autorizada. Además, en obras con SGSST exigen curso Sernageomin de Operación de Equipo Pesado (renovable cada 2 años).',
      },
      {
        q: '¿Cuánto más cuesta arrendar con operador?',
        a: 'Entre $60.000 y $120.000 adicionales por día (8 horas), dependiendo del tipo de máquina y experiencia del operador. En arriendos largos (semanas o meses) el cargo unitario suele bajar.',
      },
      {
        q: '¿El seguro cubre al operador del cliente?',
        a: 'La póliza de responsabilidad civil del arrendador cubre daños a terceros causados por la máquina, sin importar quién la opere. Pero si el operador del cliente causa daño a la máquina por mal uso, el cliente paga la reparación. Cubrir al operador como persona es responsabilidad del empleador (mutual o ISL del cliente).',
      },
      {
        q: '¿Puedo arrendar sin operador si soy particular sin empresa?',
        a: 'Solo si tienes Licencia Clase D vigente. Muchos arrendadores serios prefieren no arrendar sin operador a particulares por riesgo de daño y seguro complementario. Lo más simple para una obra pequeña es contratar el arriendo con operador.',
      },
    ],
    relacionados: [
      'precio-arriendo-retroexcavadora-chile',
      'seguros-y-responsabilidad-arriendo-maquinaria',
      'diferencia-retroexcavadora-miniexcavadora',
    ],
  },
  {
    slug: 'que-maquinaria-elegir-fundacion-casa',
    titulo: 'Qué Maquinaria Necesitas para la Fundación de una Casa',
    descripcionMeta:
      'Guía para elegir maquinaria según tamaño de casa y tipo de suelo: excavación, fundación, compactación y radier. Casos típicos vivienda 80 m² vs 200 m². Costos referenciales.',
    h1: 'Qué Maquinaria Elegir para la Fundación de tu Casa',
    resumen:
      'Para una vivienda chilena típica (80–150 m²) necesitas tres máquinas en orden: retroexcavadora o miniexcavadora para excavar la zanja de fundación, placa compactadora o rodillo pequeño para compactar el fondo, y minicargador o camión tolva para retirar excedente.',
    categoria: 'construccion',
    keywordsObjetivo: [
      'maquinaria fundacion casa',
      'que maquina usar para excavar fundacion',
      'arriendo maquinaria construccion casa',
      'fundacion vivienda 80m2',
      'maquinaria movimiento tierras vivienda',
    ],
    fechaPublicacion: '2026-05-27',
    secciones: [
      {
        h2: 'Flujo típico de fundación de vivienda',
        html: `<p>Toda fundación residencial sigue el mismo orden, independiente del tamaño:</p>
        <ol>
          <li><strong>Movimiento de tierras</strong> — emparejar el terreno y retirar capa vegetal.</li>
          <li><strong>Trazado y excavación</strong> — marcar ejes y excavar zanja corrida según planos del calculista.</li>
          <li><strong>Compactación del fondo</strong> — densificar el suelo bajo la fundación para evitar asentamientos.</li>
          <li><strong>Preparación del emplantillado</strong> — vaciar hormigón pobre (H5) de 5 cm para nivelar.</li>
          <li><strong>Enfierradura</strong> — armar fierros estriados según diseño estructural.</li>
          <li><strong>Hormigonado</strong> — vaciar fundación (H20 o H25 según calculista).</li>
          <li><strong>Curado</strong> — mojar 7 días para evitar fisuras por retracción.</li>
        </ol>
        <p>Las máquinas necesarias varían según el tamaño y tipo de suelo. A continuación, dos escenarios típicos.</p>`,
      },
      {
        h2: 'Caso 1 — Vivienda 80 m² 1 piso',
        html: `<p>Para una casa estándar (80 m² construidos, 1 piso, terreno plano, suelo común sin roca):</p>
        <ul>
          <li><strong>Miniexcavadora 1,5–3 ton</strong> · 1 día — para excavar zanja corrida (~12 m³ de excavación). Cabe por portones de 0,9 m.</li>
          <li><strong>Placa compactadora 100 kg</strong> · 0,5 día — para compactar fondo de zanja en franjas pequeñas.</li>
          <li><strong>Camión 3/4 o 1 viaje camión tolva</strong> · 1 viaje — para retirar excedente de tierra (~15 m³ esponjados).</li>
        </ul>
        <p>Costo estimado de máquinas (2026, sin operador propio del cliente): <strong>$280.000–$420.000</strong>.</p>
        <p>Alternativa: si el acceso es amplio, una retroexcavadora chica hace todo el trabajo en 4–6 horas a costo similar y aprovecha el balde frontal para cargar el camión directamente.</p>`,
      },
      {
        h2: 'Caso 2 — Vivienda 200 m² 2 pisos',
        html: `<p>Para una casa más grande (200 m² construidos, 2 pisos, terreno con leve pendiente):</p>
        <ul>
          <li><strong>Retroexcavadora 7,5 ton</strong> · 2 días — para movimiento de tierras (nivelar) + excavar fundación corrida (~30–40 m³). Su balde frontal carga directamente al camión.</li>
          <li><strong>Rodillo compactador pequeño 1,5 ton</strong> · 1 día — para compactar áreas más grandes (radier 200 m²).</li>
          <li><strong>Camión tolva 8 m³</strong> · 4–6 viajes — para retiro de excedente (~40 m³ esponjados).</li>
          <li><strong>Minicargador con balde</strong> (opcional) · 1 día — para mover y distribuir áridos de la cama del radier.</li>
        </ul>
        <p>Costo estimado de máquinas: <strong>$1.200.000–$1.800.000</strong>.</p>`,
      },
      {
        h2: 'Considera el tipo de suelo',
        html: `<p>El tipo de suelo cambia el cálculo. Antes de cotizar maquinaria:</p>
        <ul>
          <li><strong>Suelo común (arena, tierra)</strong> — escenarios estándar de arriba.</li>
          <li><strong>Arcilla expansiva</strong> — exige fundación más profunda y compactación con material seleccionado. Suma 30% más excavación y compactador más grande.</li>
          <li><strong>Roca o ripio cementado</strong> — la retroexcavadora estándar no rinde. Considerar martillo hidráulico (implemento de excavadora) o subcontratar perforación.</li>
          <li><strong>Napa freática alta</strong> — agregar bombeo continuo durante excavación y considerar agotamiento mientras hormigonas.</li>
        </ul>
        <p>Si no conoces el suelo, pide a tu calculista un estudio de mecánica de suelos básico antes de cotizar. Te ahorra plata.</p>`,
      },
      {
        h2: 'Secuencia recomendada de arriendos',
        html: `<p>Para minimizar días muertos de máquina arrendada:</p>
        <ol>
          <li><strong>Día previo</strong> — Topógrafo o maestro hace trazado con estacas y cuerda.</li>
          <li><strong>Día 1</strong> — Llega retro o mini. Movimiento de tierras + excavación zanja corrida + carga al camión.</li>
          <li><strong>Día 2</strong> — Compactador en obra. Compactación + emplantillado. Empieza enfierradura.</li>
          <li><strong>Día 3–5</strong> — Enfierradura (sin máquina).</li>
          <li><strong>Día 6</strong> — Día de hormigonado (mixer + bomba si la fundación es grande).</li>
        </ol>
        <p>Mantener orden evita arrendar máquinas que estarán paradas esperando a otro frente. Coordinación entre maestro de obra y arrendador es clave.</p>`,
      },
    ],
    faq: [
      {
        q: '¿Qué máquina sirve para excavar fundación de casa?',
        a: 'Para vivienda hasta 100 m² basta miniexcavadora 1,5–3 ton (cabe por portones, no daña piso). Para casas más grandes o terrenos amplios, retroexcavadora 7,5 ton rinde más y carga el camión directo.',
      },
      {
        q: '¿Es obligatorio compactar el fondo de la fundación?',
        a: 'Sí, lo exige cualquier calculista. El fondo de la zanja debe estar nivelado y compactado para que la fundación no se asiente con el tiempo. Si no, las fisuras aparecen en los primeros años.',
      },
      {
        q: '¿Cuántos m³ de excavación lleva una fundación de casa de 80 m²?',
        a: 'Aproximadamente 10–15 m³ de excavación (zanja corrida de ~30 m perímetro × 0,4 m ancho × 0,8 m profundidad). Para 200 m², 30–40 m³. Esto es excavación en banco; multiplicar por 1,25 para volumen suelto a transportar.',
      },
      {
        q: '¿Conviene arrendar todo en un solo proveedor?',
        a: 'Sí, conviene. Reduce coordinación, los precios suelen ser mejores por paquete, y la responsabilidad ante daños queda en un solo contrato. JURMAQ cotiza paquetes para faena completa de fundación.',
      },
    ],
    relacionados: [
      'diferencia-retroexcavadora-miniexcavadora',
      'como-calcular-volumen-excavacion-zanja',
      'arriendo-minicargador-implementos',
    ],
  },
  {
    slug: 'arriendo-minicargador-implementos',
    titulo: 'Implementos para Minicargador: Balde, Auger, Horquillas y Más',
    descripcionMeta:
      'Catálogo de implementos para minicargador Bobcat o equivalente: balde, horquillas, auger, escoba, retroexcavador, planchas. Capacidades, usos y cuándo elegir cada uno.',
    h1: 'Implementos Disponibles para Minicargador (Bobcat y Equivalentes)',
    resumen:
      'Un minicargador Bobcat o similar acepta más de 50 implementos intercambiables. Los más usados en obra chilena son balde estándar (carga), horquillas (pallets), auger (hoyos para postes), escoba mecánica (limpieza) y retroexcavador (zanjas pequeñas).',
    categoria: 'maquinaria',
    keywordsObjetivo: [
      'implementos minicargador',
      'accesorios bobcat',
      'arriendo bobcat con auger',
      'minicargador horquillas',
      'implementos para minicargador chile',
    ],
    fechaPublicacion: '2026-05-27',
    secciones: [
      {
        h2: 'Balde estándar',
        html: `<p>Es el implemento que viene por defecto en todo minicargador. Sirve para:</p>
        <ul>
          <li>Carga de áridos (gravilla, arena, ripio).</li>
          <li>Carga de escombros y material de demolición.</li>
          <li>Traslado de tierra entre frentes de obra.</li>
          <li>Nivelación gruesa de terrenos.</li>
        </ul>
        <p>Capacidad típica: 0,5–0,8 m³ por carga. En un Bobcat S650 levanta hasta 1.135 kg de carga útil.</p>`,
      },
      {
        h2: 'Horquillas (pallet forks)',
        html: `<p>Convierten el minicargador en una grúa horquilla mediana. Para:</p>
        <ul>
          <li>Mover pallets de ladrillos, bloques, cemento.</li>
          <li>Cargar materiales pesados al camión.</li>
          <li>Trasladar elementos prefabricados (marcos, ventanas, premoldeados).</li>
        </ul>
        <p>Largo típico de horquillas: 1,1 m. Capacidad: 800–1.150 kg según modelo. No reemplaza una grúa horquilla industrial pero resuelve el 80% de los movimientos de pallet en obra.</p>`,
      },
      {
        h2: 'Auger (barrenadora de hoyos)',
        html: `<p>Implemento con broca helicoidal para hacer hoyos verticales en el suelo. Para:</p>
        <ul>
          <li>Hoyos para postes de cierre perimetral (Ø20–30 cm × 0,8–1,2 m).</li>
          <li>Fundaciones aisladas cilíndricas (Ø40–60 cm × 1,0–1,5 m).</li>
          <li>Postes de letreros, semáforos, postes de luz.</li>
          <li>Hoyos para árboles en proyectos de paisajismo.</li>
        </ul>
        <p>Brocas estándar disponibles: 15, 20, 25, 30, 40, 50, 60 cm de diámetro. Rendimiento: 30–60 hoyos por hora según diámetro y suelo. Mucho más rápido que con barreta manual.</p>`,
      },
      {
        h2: 'Escoba mecánica',
        html: `<p>Cepillo rotatorio para limpieza intensiva de superficies. Para:</p>
        <ul>
          <li>Limpieza de calles y pavimentos post-obra.</li>
          <li>Barrido de canchas y áreas amplias.</li>
          <li>Limpieza de patios industriales y bodegas.</li>
          <li>Remoción de polvo, arena y tierra suelta sobre pavimento.</li>
        </ul>
        <p>Ancho típico: 1,5–1,8 m. Rendimiento: 5.000–8.000 m² por hora. Versión con depósito recoge el material; versión sin depósito solo barre hacia adelante.</p>`,
      },
      {
        h2: 'Retroexcavador (brazo)',
        html: `<p>Implemento que convierte el minicargador en una mini-retro. Para:</p>
        <ul>
          <li>Zanjas pequeñas en zonas donde no entra una retroexcavadora.</li>
          <li>Excavaciones puntuales (cámaras, fosas).</li>
          <li>Demolición ligera.</li>
        </ul>
        <p>Profundidad: hasta 2,5 m. Capacidad balde: 60–100 L. No reemplaza una retro propiamente tal, pero útil cuando el espacio no la permite y no querés cambiar de máquina.</p>`,
      },
      {
        h2: 'Otros implementos disponibles',
        html: `<p>Catálogo completo de un minicargador estándar incluye más opciones:</p>
        <ul>
          <li><strong>Plancha niveladora</strong> — para emparejar y nivelar áridos antes de compactar.</li>
          <li><strong>Balde basculante 4 en 1</strong> — combina balde, cuchara, niveladora y horquilla en una pieza.</li>
          <li><strong>Martillo hidráulico</strong> — para demolición de hormigón menor.</li>
          <li><strong>Triturador / chipper</strong> — para residuos vegetales en obras de paisajismo.</li>
          <li><strong>Cucharón cernidor</strong> — para tamizar tierra o gravilla en obra.</li>
          <li><strong>Tridente o garra forestal</strong> — para mover troncos y material forestal.</li>
        </ul>
        <p>Costo adicional típico por implemento (sobre tarifa base del minicargador): $20.000–$60.000 al día según el tipo. Auger y retroexcavador son los más caros porque son hidráulicos complejos.</p>`,
      },
    ],
    faq: [
      {
        q: '¿Qué viene incluido en el arriendo del minicargador?',
        a: 'Como base viene con balde estándar y operador (si la modalidad es con operador). Implementos adicionales (auger, horquillas, escoba) se cotizan aparte porque varían según necesidad de la obra.',
      },
      {
        q: '¿Cuánta carga levanta un Bobcat S650?',
        a: 'El S650 levanta hasta 1.135 kg de carga útil operacional. Para cargas mayores conviene un minicargador más grande (S750, S850) o una retroexcavadora con balde frontal.',
      },
      {
        q: '¿Se pueden cambiar implementos en obra rápidamente?',
        a: 'Sí. El sistema de acople rápido (Bob-Tach) permite cambiar implementos en 1–2 minutos sin herramientas. Para implementos hidráulicos (auger, escoba) se conectan mangueras hidráulicas que toma 3–5 minutos.',
      },
      {
        q: '¿Cuál implemento sirve para hacer hoyos para postes?',
        a: 'El auger con broca de 20–30 cm es la solución estándar. Hace un hoyo de 1,2 m profundidad en 1–2 minutos según el tipo de suelo. Para postes de luz más grandes (Ø40+), usar broca de 40–50 cm.',
      },
    ],
    relacionados: [
      'que-maquinaria-elegir-fundacion-casa',
      'precio-arriendo-retroexcavadora-chile',
      'glosario-maquinaria-construccion',
    ],
  },
  {
    slug: 'seguros-y-responsabilidad-arriendo-maquinaria',
    titulo: 'Seguros y Responsabilidad en Arriendo de Maquinaria',
    descripcionMeta:
      'Qué cubre el seguro de una empresa de arriendo de maquinaria: responsabilidad civil, daños propios. Qué NO cubre. Cuándo conviene seguro complementario del cliente.',
    h1: 'Seguros y Responsabilidad en el Arriendo de Maquinaria Pesada',
    resumen:
      'Un contrato de arriendo profesional incluye póliza de responsabilidad civil del arrendador que cubre daños a terceros. Daños a la máquina por uso indebido los paga el cliente. Seguro complementario es recomendable para obras de alto riesgo.',
    categoria: 'arriendo',
    keywordsObjetivo: [
      'seguro arriendo maquinaria',
      'responsabilidad arriendo maquinaria',
      'poliza responsabilidad civil maquinaria',
      'que cubre arriendo retroexcavadora',
      'seguro maquinaria pesada',
    ],
    fechaPublicacion: '2026-05-27',
    secciones: [
      {
        h2: 'Qué cubre el contrato estándar JURMAQ',
        html: `<p>Un arriendo profesional incluye, sin costo adicional al cliente:</p>
        <ul>
          <li><strong>Responsabilidad civil hacia terceros</strong> — cubre daños materiales y lesiones a personas ajenas a la obra causadas por la operación de la máquina. Cobertura típica: 1.000–3.000 UF.</li>
          <li><strong>Daños propios de la máquina por falla mecánica</strong> — si la máquina falla por mantención deficiente del arrendador, la reparación corre por su cuenta y se entrega máquina de reemplazo si la falla supera 24 horas.</li>
          <li><strong>Mutual y seguro del operador</strong> (en arriendo con operador) — accidentes en obra del operador certificado están cubiertos por el arrendador.</li>
        </ul>`,
      },
      {
        h2: 'Qué NO cubre la póliza estándar',
        html: `<p>Casos donde la responsabilidad cae sobre el cliente:</p>
        <ul>
          <li><strong>Daños a la máquina por mal uso</strong> — operación fuera de capacidad técnica, suelo no apto, sobrecarga, golpes evitables. Se cobran al cliente según catálogo de daños del contrato.</li>
          <li><strong>Robo o vandalismo en obra</strong> — la custodia de la máquina fuera de horario laboral (noche, fines de semana) es responsabilidad del cliente. Si la obra no tiene cerramiento y vigilancia, contratar seguro complementario.</li>
          <li><strong>Daños a obras del cliente</strong> causadas por la máquina (paredes, instalaciones, vehículos del cliente). La RC cubre terceros, no al propio cliente.</li>
          <li><strong>Multas o sanciones por trabajo no autorizado</strong> — permisos municipales, Sernageomin u otros son responsabilidad del cliente.</li>
          <li><strong>Pérdida lucrativa por atraso en obra</strong> — si la máquina se daña y atrasa tu obra, la indemnización es limitada (usualmente máximo al monto del arriendo).</li>
          <li><strong>Daños por causas naturales</strong> (inundación, terremoto, deslizamiento) — caso fortuito, no cubierto por póliza estándar.</li>
        </ul>`,
      },
      {
        h2: 'Cuándo conviene seguro complementario',
        html: `<p>Recomendamos que el cliente contrate un seguro adicional cuando:</p>
        <ul>
          <li><strong>Obra de alto valor o crítica</strong> donde un atraso te genera multas a tu propio cliente.</li>
          <li><strong>Obra en zona insegura</strong> — sin cerramiento perimetral, sin vigilancia nocturna.</li>
          <li><strong>Obra con riesgo de impacto a terceros</strong> — cerca de líneas eléctricas, gasoductos, fibra óptica enterrada.</li>
          <li><strong>Obra costera, zona sísmica activa o cerca de río</strong> — exposición a causas naturales.</li>
          <li><strong>Obras públicas o licitaciones</strong> — el mandante suele exigir cobertura por escrito.</li>
        </ul>
        <p>El seguro complementario para una obra mediana cuesta entre $80.000 y $250.000 mensuales según el monto asegurado. Lo emiten compañías como HDI, Mapfre, Liberty o Sura.</p>`,
      },
      {
        h2: 'Catálogo típico de daños y cobros',
        html: `<p>Referencia de cobros por daños al cliente en arriendo de maquinaria (varía por marca y modelo):</p>
        <ul>
          <li><strong>Vidrio cabina roto</strong> — $80.000 a $200.000</li>
          <li><strong>Espejo retrovisor</strong> — $40.000 a $80.000</li>
          <li><strong>Rotura de manguera hidráulica por sobrecarga</strong> — $60.000 a $150.000</li>
          <li><strong>Daño en cucharón por trabajo en roca sin autorización</strong> — $300.000 a $1.000.000</li>
          <li><strong>Pinchazo de neumático</strong> — $80.000 a $250.000 según tamaño</li>
          <li><strong>Cabina volcada por mal uso</strong> — pérdida total (cobertura por seguro del arrendador, pero deducible al cliente)</li>
        </ul>
        <p>El contrato debe incluir lista cerrada de cobros para evitar discrecionalidad. Antes de firmar, pide el catálogo de daños por escrito.</p>`,
      },
      {
        h2: 'Recomendaciones para el cliente',
        html: `<ol>
          <li><strong>Lee el contrato completo</strong> antes de recibir la máquina. Identifica qué casos están excluidos.</li>
          <li><strong>Documenta el estado de entrega</strong> — fotos en alta resolución de toda la máquina y video corto de funcionamiento. Te respalda ante disputas.</li>
          <li><strong>No firmes contratos sin póliza RC vigente</strong> — pide copia simple.</li>
          <li><strong>Cierra perimetralmente la obra</strong> — malla raschel mínimo, ideal con vigilancia nocturna si es maquinaria pesada.</li>
          <li><strong>Capacita a tu equipo</strong> — el operador debe entender los límites técnicos de la máquina (capacidad de carga, profundidad, pendiente).</li>
          <li><strong>Reporta cualquier anomalía inmediatamente</strong> por escrito (WhatsApp con timestamp sirve). No esperes a la devolución.</li>
        </ol>`,
      },
    ],
    faq: [
      {
        q: '¿Quién paga si la máquina arrendada daña mi obra?',
        a: 'La póliza estándar del arrendador cubre daños a terceros, no a obras del propio cliente. Si la máquina daña tu construcción, la indemnización depende del contrato y del seguro complementario que hayas contratado tú.',
      },
      {
        q: '¿Qué pasa si roban la máquina en mi obra?',
        a: 'La custodia fuera de horario laboral es responsabilidad del cliente. Si la obra no tiene cerramiento y vigilancia, el cliente paga el valor de la máquina robada (según catastro del contrato). Por eso conviene contratar seguro complementario o asegurar la custodia perimetral.',
      },
      {
        q: '¿Cubre el seguro daños a líneas eléctricas enterradas?',
        a: 'La responsabilidad civil del arrendador cubre daños a terceros, pero el cliente está obligado a pedir planos de servicios enterrados (CGE, Sanitarias, Telecom) antes de excavar. Si el cliente no consultó y daña una línea, la aseguradora puede repetir contra el cliente.',
      },
      {
        q: '¿Qué pasa si la máquina falla por falla mecánica del arrendador?',
        a: 'En contrato JURMAQ, si la falla es por mantención deficiente del arrendador y supera 24 horas de detención, se entrega máquina de reemplazo y el día de falla no se cobra. Si la falla es por mal uso del operador del cliente, el cliente cubre reparación.',
      },
    ],
    relacionados: [
      'arriendo-maquinaria-con-o-sin-operador',
      'precio-arriendo-retroexcavadora-chile',
    ],
  },
  {
    slug: 'glosario-maquinaria-construccion',
    titulo: 'Glosario de Maquinaria Pesada para Construcción',
    descripcionMeta:
      'Glosario con definiciones de los 25 términos más usados en arriendo de maquinaria de construcción: retroexcavadora, miniexcavadora, minicargador, auger, ROPS, EPP y más.',
    h1: 'Glosario de Maquinaria Pesada y Términos de Construcción',
    resumen:
      'Glosario práctico de los términos más usados al cotizar arriendo de maquinaria de construcción en Chile: tipos de máquina, implementos, seguridad, certificación y unidades técnicas. Para entender una cotización sin pifearla.',
    categoria: 'tecnico',
    keywordsObjetivo: [
      'glosario maquinaria construccion',
      'terminos maquinaria pesada',
      'que significa rops en maquinaria',
      'definiciones arriendo maquinaria',
      'diccionario construccion chile',
    ],
    fechaPublicacion: '2026-05-27',
    secciones: [
      {
        h2: 'Tipos de máquina',
        html: `<dl style="display:grid;gap:12px">
          <div><dt style="font-weight:600;color:#0c1b3a">Retroexcavadora</dt><dd style="margin-top:2px">Máquina autopropulsada con balde frontal cargador y brazo retroexcavador trasero. Peso 7,5–8,5 ton. Ideal para movimiento de tierras, fundaciones y carga de camiones en obras medianas y grandes.</dd></div>
          <div><dt style="font-weight:600;color:#0c1b3a">Miniexcavadora</dt><dd style="margin-top:2px">Excavadora compacta (1,5–3,5 ton) sobre orugas de goma. Solo brazo retroexcavador (sin balde frontal). Ideal para espacios reducidos, jardines y obras urbanas.</dd></div>
          <div><dt style="font-weight:600;color:#0c1b3a">Minicargador (skid steer)</dt><dd style="margin-top:2px">Máquina compacta de 4 ruedas con balde frontal. Pivota sobre su eje. Acepta más de 50 implementos intercambiables. Marca de referencia: Bobcat.</dd></div>
          <div><dt style="font-weight:600;color:#0c1b3a">Excavadora</dt><dd style="margin-top:2px">Máquina sobre orugas con brazo retroexcavador (sin balde frontal). Tamaños: 5 ton (compacta) hasta 80+ ton (minería). Para obras pesadas y minería.</dd></div>
          <div><dt style="font-weight:600;color:#0c1b3a">Brazo articulado (boom lift)</dt><dd style="margin-top:2px">Plataforma elevadora telescópica para trabajos en altura con alcance lateral. Capacidad 230 kg (2 personas + herramientas). Altura típica 12–14 m.</dd></div>
          <div><dt style="font-weight:600;color:#0c1b3a">Plataforma tijera (scissor lift)</dt><dd style="margin-top:2px">Plataforma elevadora que sube vertical en tijera. Mayor superficie de trabajo (2,3 × 1,1 m) para 4 personas. Altura 8–12 m.</dd></div>
          <div><dt style="font-weight:600;color:#0c1b3a">Alzahombre (cherrypicker)</dt><dd style="margin-top:2px">Canastillo elevador compacto para 1 persona. Eléctrico, apto interior. Altura 6–10 m. Para mantención puntual de luminarias y cableado.</dd></div>
          <div><dt style="font-weight:600;color:#0c1b3a">Rodillo compactador</dt><dd style="margin-top:2px">Máquina vibratoria con rodillo metálico para compactar bases de pavimento, radieres y caminos. Peso 1,5–7 ton según modelo.</dd></div>
          <div><dt style="font-weight:600;color:#0c1b3a">Placa compactadora (rana)</dt><dd style="margin-top:2px">Compactador vibratorio manual de 70–200 kg. Para áreas pequeñas: zanjas, bases de adoquines, áreas inaccesibles para rodillo.</dd></div>
          <div><dt style="font-weight:600;color:#0c1b3a">Camión tolva</dt><dd style="margin-top:2px">Camión con caja basculante para transporte de áridos, escombros y tierra. Capacidades: 8, 10, 12, 14 m³.</dd></div>
        </dl>`,
      },
      {
        h2: 'Implementos y partes',
        html: `<dl style="display:grid;gap:12px">
          <div><dt style="font-weight:600;color:#0c1b3a">Balde frontal</dt><dd style="margin-top:2px">Pala metálica frontal de la retroexcavadora o minicargador. Capacidad 0,5–1,0 m³ según máquina.</dd></div>
          <div><dt style="font-weight:600;color:#0c1b3a">Brazo retroexcavador</dt><dd style="margin-top:2px">Brazo articulado con cucharón en el extremo para excavar zanjas y fosas. Se opera desde la cabina con palancas hidráulicas.</dd></div>
          <div><dt style="font-weight:600;color:#0c1b3a">Auger</dt><dd style="margin-top:2px">Implemento helicoidal hidráulico para perforar hoyos verticales en el suelo. Brocas de 15 a 60 cm de diámetro. Para postes, fundaciones cilíndricas, plantación de árboles.</dd></div>
          <div><dt style="font-weight:600;color:#0c1b3a">Horquillas (forks)</dt><dd style="margin-top:2px">Implemento para minicargador o cargador frontal que reemplaza el balde por horquillas tipo grúa horquilla. Para mover pallets.</dd></div>
          <div><dt style="font-weight:600;color:#0c1b3a">Balde basculante 4 en 1</dt><dd style="margin-top:2px">Balde con mecanismo que se abre como cuchara. Combina balde, cuchara, niveladora y horquilla en un solo implemento.</dd></div>
          <div><dt style="font-weight:600;color:#0c1b3a">Martillo hidráulico</dt><dd style="margin-top:2px">Implemento de excavadora o minicargador para demolición de hormigón. Peso 200–1.500 kg según máquina.</dd></div>
          <div><dt style="font-weight:600;color:#0c1b3a">Cabina ROPS / FOPS</dt><dd style="margin-top:2px">Roll Over Protective Structure / Falling Object Protective Structure. Cabina certificada que protege al operador en caso de volcamiento (ROPS) o caída de objetos (FOPS). Requisito de seguridad obligatorio.</dd></div>
        </dl>`,
      },
      {
        h2: 'Términos técnicos',
        html: `<dl style="display:grid;gap:12px">
          <div><dt style="font-weight:600;color:#0c1b3a">m³ en banco</dt><dd style="margin-top:2px">Volumen de suelo en su estado natural antes de excavar. Se usa para calcular volumen de excavación.</dd></div>
          <div><dt style="font-weight:600;color:#0c1b3a">m³ esponjado / suelto</dt><dd style="margin-top:2px">Volumen del mismo suelo una vez excavado. Es 15–80% mayor según el tipo de material. Se usa para calcular capacidad de camiones tolva.</dd></div>
          <div><dt style="font-weight:600;color:#0c1b3a">Esponjamiento</dt><dd style="margin-top:2px">Aumento de volumen del suelo al ser removido. Factor típico 1,25 para tierra común, 1,30 arcilla, hasta 1,80 para roca fracturada.</dd></div>
          <div><dt style="font-weight:600;color:#0c1b3a">Horómetro</dt><dd style="margin-top:2px">Contador de horas de uso del motor. Es la referencia de antigüedad real de una máquina (más que los años calendario).</dd></div>
          <div><dt style="font-weight:600;color:#0c1b3a">Hora-máquina</dt><dd style="margin-top:2px">Unidad de facturación equivalente a 1 hora de operación con motor encendido. Usada para horas extras sobre la jornada base.</dd></div>
          <div><dt style="font-weight:600;color:#0c1b3a">Tarifa neta vs bruta</dt><dd style="margin-top:2px">Neta: sin IVA. Bruta: con 19% IVA incluido. Empresas con factura toman neta; particulares pagan bruta.</dd></div>
        </dl>`,
      },
      {
        h2: 'Seguridad y certificación',
        html: `<dl style="display:grid;gap:12px">
          <div><dt style="font-weight:600;color:#0c1b3a">EPP</dt><dd style="margin-top:2px">Equipo de Protección Personal. Para operador de maquinaria: casco, zapatos de seguridad, chaleco reflectante, guantes, protector auditivo.</dd></div>
          <div><dt style="font-weight:600;color:#0c1b3a">Sernageomin</dt><dd style="margin-top:2px">Servicio Nacional de Geología y Minería. Certifica cursos de operación de equipo pesado. Vigencia 2 años, renovable.</dd></div>
          <div><dt style="font-weight:600;color:#0c1b3a">Licencia Clase D</dt><dd style="margin-top:2px">Licencia de conducir para maquinaria autopropulsada (retroexcavadora, cargadores, grúas). Emitida por Tránsito Municipal previo curso.</dd></div>
          <div><dt style="font-weight:600;color:#0c1b3a">SGSST</dt><dd style="margin-top:2px">Sistema de Gestión de Seguridad y Salud en el Trabajo. Obligatorio para empresas con riesgo. Define procedimientos para operación de maquinaria.</dd></div>
          <div><dt style="font-weight:600;color:#0c1b3a">Responsabilidad Civil (RC)</dt><dd style="margin-top:2px">Póliza que cubre daños a terceros causados por la operación de la máquina. Estándar en arriendo profesional.</dd></div>
          <div><dt style="font-weight:600;color:#0c1b3a">Cama-baja</dt><dd style="margin-top:2px">Camión con plataforma baja para transportar maquinaria pesada (retroexcavadora, excavadora). Cobra flete por km recorrido.</dd></div>
        </dl>`,
      },
    ],
    faq: [
      {
        q: '¿Qué significa ROPS en una cabina de retroexcavadora?',
        a: 'Roll Over Protective Structure: estructura certificada que protege al operador en caso de volcamiento. Es requisito obligatorio en maquinaria pesada moderna. Si la cabina no tiene certificación ROPS visible, la máquina no debería operarse.',
      },
      {
        q: '¿Cuál es la diferencia entre m³ en banco y m³ esponjado?',
        a: 'En banco: volumen del suelo antes de excavar (en su estado natural). Esponjado: volumen del mismo suelo una vez removido y suelto. La diferencia es 15–80% según el tipo de suelo. Para calcular camiones de retiro, usa esponjado.',
      },
      {
        q: '¿Qué es la licencia Clase D?',
        a: 'Licencia de conducir Clase D habilita para operar maquinaria autopropulsada (retroexcavadoras, cargadores frontales, grúas). Se obtiene en Tránsito Municipal previo curso teórico y práctico en escuela autorizada.',
      },
      {
        q: '¿Es obligatorio el curso Sernageomin para operadores?',
        a: 'En obras con SGSST (sistema de gestión SST) es exigible. Para arriendo sin operador a empresa, el arrendador suele exigir certificado vigente para entregar la máquina. Sin curso aumenta el riesgo de accidente y deja al cliente sin cobertura ante reclamos.',
      },
    ],
    relacionados: [
      'diferencia-retroexcavadora-miniexcavadora',
      'arriendo-minicargador-implementos',
      'arriendo-maquinaria-con-o-sin-operador',
    ],
  },
];

export function getRecurso(slug: string): RecursoSEO | undefined {
  return RECURSOS.find((r) => r.slug === slug);
}
