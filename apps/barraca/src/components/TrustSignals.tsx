/**
 * TrustSignals — banda horizontal con KPIs concretos y verificables.
 *
 * Por qué importa: en construcción y arriendo de maquinaria pesada los
 * compradores son aversos al riesgo (la herramienta sale cara, los plazos
 * cuestan plata, las máquinas mal arrendadas paran obra). Ver números
 * concretos sin floreo > leer "los mejores del Maule".
 *
 * Cada KPI tiene un sublabel concreto (no "calidad", "experiencia", etc).
 *
 * Uso:
 *   <TrustSignals variant="dark" />
 *   <TrustSignals variant="light" items={CUSTOM_KPIS} />
 */

interface KPI {
  /** Número grande, ya formateado en español. Ej: "+25", "1.600", "30 min". */
  value: string;
  /** 2-4 palabras directas. */
  label: string;
  /** 1 línea de detalle/disclaimer si aplica. */
  sublabel?: string;
}

const DEFAULT_KPIS: KPI[] = [
  {
    value: "+25",
    label: "años en el Maule",
    sublabel: "Constructora desde 2000",
  },
  {
    value: "1.600+",
    label: "productos en stock",
    sublabel: "Fierros, cemento, perfiles, áridos",
  },
  {
    value: "30 min",
    label: "despacho a Curicó",
    sublabel: "Desde Molina · 1h a Talca",
  },
  {
    value: "<2 hrs",
    label: "respuesta a cotización",
    sublabel: "Mejor precio garantizado",
  },
];

export default function TrustSignals({
  variant = "dark",
  items = DEFAULT_KPIS,
  title,
}: {
  variant?: "dark" | "light";
  items?: KPI[];
  title?: string;
}) {
  const isLight = variant === "light";
  const bg = isLight ? "bg-white" : "bg-navy-950";
  const border = isLight ? "border-y border-gray-200" : "border-y border-navy-800";
  const text = isLight ? "text-navy-950" : "text-white";
  const labelText = isLight ? "text-gray-700" : "text-gray-200";
  const sublabelText = isLight ? "text-gray-500" : "text-gray-400";
  const accent = "text-orange-500";

  return (
    <section
      className={`${bg} ${border}`}
      aria-label={title || "Indicadores clave de JURMAQ"}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        {title && (
          <h2 className={`text-xs uppercase tracking-[0.2em] font-bold ${labelText} text-center mb-6`}>
            {title}
          </h2>
        )}
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4">
          {items.map((kpi, i) => (
            <div
              key={i}
              className={`text-center ${
                i < items.length - 1
                  ? "lg:border-r lg:border-dashed lg:border-current lg:border-opacity-20"
                  : ""
              }`}
            >
              <dt className={`text-3xl lg:text-5xl font-extrabold tabular-nums ${accent} leading-none mb-2`}>
                {kpi.value}
              </dt>
              <dd>
                <span className={`block text-sm lg:text-base font-semibold ${text} mb-0.5`}>
                  {kpi.label}
                </span>
                {kpi.sublabel && (
                  <span className={`block text-xs ${sublabelText}`}>{kpi.sublabel}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/** KPIs adaptados para landing de Barraca (e-commerce). */
export const BARRACA_KPIS: KPI[] = [
  {
    value: "1.600+",
    label: "productos publicados",
    sublabel: "Fierros, cemento, perfiles, terciados",
  },
  {
    value: "30 min",
    label: "despacho a Curicó",
    sublabel: "Desde Molina · Talca 1h",
  },
  {
    value: "<2 hrs",
    label: "respuesta a cotización",
    sublabel: "Lunes a sábado en horario laboral",
  },
  {
    value: "+25",
    label: "años en el Maule",
    sublabel: "Conocemos el territorio",
  },
];

/** KPIs adaptados para landing de arriendo de maquinaria. */
export const MAQUINARIA_KPIS: KPI[] = [
  {
    value: "+25",
    label: "años arrendando",
    sublabel: "Constructora propia que usa la flota",
  },
  {
    value: "10+",
    label: "tipos de máquina",
    sublabel: "Retros, mini, brazos, plataformas",
  },
  {
    value: "Maestranza",
    label: "propia para mantención",
    sublabel: "Menos paradas en obra",
  },
  {
    value: "<2 hrs",
    label: "cotización",
    sublabel: "Por WhatsApp con un humano",
  },
];

/** KPIs adaptados para landing de comparación con competencia. */
export const COMPARACION_KPIS: KPI[] = [
  {
    value: "Mejor",
    label: "precio garantizado",
    sublabel: "Contra cotización formal",
  },
  {
    value: "<2 hrs",
    label: "respuesta",
    sublabel: "Sube tu cotización y respondemos",
  },
  {
    value: "Local",
    label: "del Maule",
    sublabel: "Despacho desde Molina, no flete largo",
  },
  {
    value: "Directo",
    label: "WhatsApp con vendedor",
    sublabel: "Sin call center, sin transferencias",
  },
];
