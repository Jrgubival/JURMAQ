/**
 * Horario semanal → textos para el cliente y schema.org. Funciones puras.
 * Una sola fuente (HorarioSemanal) produce las líneas visibles y el
 * openingHoursSpecification, así nunca se contradicen.
 */
import { DIAS_SEMANA, type DiaSemana, type HorarioSemanal, type Tramo } from "./tipos.ts";

const NOMBRE_DIA: Record<DiaSemana, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo: "Domingo",
};
const DIA_SCHEMA: Record<DiaSemana, string> = {
  lunes: "Monday",
  martes: "Tuesday",
  miercoles: "Wednesday",
  jueves: "Thursday",
  viernes: "Friday",
  sabado: "Saturday",
  domingo: "Sunday",
};

export function tramoValido(t: Tramo): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t.abre) && /^([01]\d|2[0-3]):[0-5]\d$/.test(t.cierra) && t.abre < t.cierra;
}

/** Valida los tramos de un día: bien formados, ordenados y sin traslape. */
export function erroresHorario(h: HorarioSemanal): string[] {
  const errores: string[] = [];
  for (const dia of DIAS_SEMANA) {
    const tramos = h[dia];
    if (!Array.isArray(tramos)) {
      errores.push(`horario.${dia}: debe ser una lista de tramos (vacía si cierra).`);
      continue;
    }
    if (tramos.length > 3) errores.push(`horario.${dia}: máximo 3 tramos.`);
    tramos.forEach((t, i) => {
      if (!tramoValido(t)) errores.push(`horario.${dia}[${i}]: usa HH:MM de 24 horas y que abra antes de cerrar.`);
      if (i > 0 && tramos[i - 1].cierra > t.abre) errores.push(`horario.${dia}: los tramos deben ir en orden y sin traslape.`);
    });
  }
  return errores;
}

/** "08:30" → "8:30". */
function hora(h: string): string {
  return h.replace(/^0/, "");
}

function textoTramos(tramos: Tramo[]): string {
  return tramos.map((t) => `${hora(t.abre)}–${hora(t.cierra)}`).join(" y ");
}

function mismosTramos(a: Tramo[], b: Tramo[]): boolean {
  return a.length === b.length && a.every((t, i) => t.abre === b[i].abre && t.cierra === b[i].cierra);
}

interface Grupo {
  dias: DiaSemana[];
  tramos: Tramo[];
}

/** Agrupa días CONSECUTIVOS con el mismo horario. */
function agrupar(h: HorarioSemanal): Grupo[] {
  const grupos: Grupo[] = [];
  for (const dia of DIAS_SEMANA) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && mismosTramos(ultimo.tramos, h[dia])) ultimo.dias.push(dia);
    else grupos.push({ dias: [dia], tramos: h[dia] });
  }
  return grupos;
}

function etiquetaDias(dias: DiaSemana[]): string {
  if (dias.length === 1) return NOMBRE_DIA[dias[0]];
  const primero = NOMBRE_DIA[dias[0]].toLowerCase();
  const ultimo = NOMBRE_DIA[dias[dias.length - 1]].toLowerCase();
  return `${NOMBRE_DIA[dias[0]]} a ${ultimo === primero ? "" : ultimo}`.trim();
}

export interface HorarioTextos {
  /** Todo en una frase, igual a HORARIO_BARRACA.texto. */
  texto: string;
  /** Lunes a viernes (o los días hábiles, uno por línea si difieren). */
  semana: string;
  sabado: string;
  domingo: string;
  /** Una línea por grupo de días. */
  lineas: string[];
  openingHoursSpecification: {
    "@type": "OpeningHoursSpecification";
    dayOfWeek: string[];
    opens: string;
    closes: string;
  }[];
}

function lineaDeGrupo(g: Grupo): string {
  return g.tramos.length === 0 ? `${etiquetaDias(g.dias)} cerrado` : `${etiquetaDias(g.dias)} ${textoTramos(g.tramos)}`;
}

/**
 * Textos y schema.org del horario. Con el horario actual da exactamente los de
 * HORARIO_BARRACA (packages/shared/src/seo): "Lunes a viernes 8:30–13:00 y
 * 14:30–18:00", "Sábado 9:00–13:00", "Domingo cerrado".
 */
export function armarHorario(h: HorarioSemanal): HorarioTextos {
  const grupos = agrupar(h);
  const lineas = grupos.map(lineaDeGrupo);
  const delGrupo = (dia: DiaSemana) => lineaDeGrupo(grupos.find((g) => g.dias.includes(dia))!);
  const habiles = grupos.filter((g) => g.dias.some((d) => d !== "sabado" && d !== "domingo"));
  const semana = habiles.map(lineaDeGrupo).join(". ");
  const spec: HorarioTextos["openingHoursSpecification"] = [];
  for (const g of grupos) {
    for (const t of g.tramos) {
      spec.push({ "@type": "OpeningHoursSpecification", dayOfWeek: g.dias.map((d) => DIA_SCHEMA[d]), opens: t.abre, closes: t.cierra });
    }
  }
  return {
    texto: `${lineas.join(". ")}.`,
    semana,
    sabado: delGrupo("sabado"),
    domingo: delGrupo("domingo"),
    lineas,
    openingHoursSpecification: spec,
  };
}
