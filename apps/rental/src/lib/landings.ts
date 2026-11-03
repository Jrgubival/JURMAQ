import 'server-only';
import {
  CIUDADES,
  DISTANCIAS_CONSTRUCTORA,
  TIPOS_MAQUINA,
  type CiudadSEO,
  type TipoMaquinaSEO,
} from '@jurmaq/shared/seo';

const plataforma = TIPOS_MAQUINA.find((t) => t.slug === 'plataforma-elevadora');
const alzahombre = TIPOS_MAQUINA.find((t) => t.slug === 'alzahombre');
if (!plataforma || !alzahombre) throw new Error('Faltan tipos de máquina');

/** Sólo tipos con máquina real en la flota. Las plataformas están como `alzahombre`. */
export const TIPOS: TipoMaquinaSEO[] = [
  ...TIPOS_MAQUINA.filter((t) =>
    ['retroexcavadora', 'miniexcavadora', 'minicargador', 'camion-tolva', 'brazo-articulado'].includes(t.slug),
  ),
  {
    ...plataforma,
    slug: 'alzahombre',
    tipoDb: 'alzahombre',
    nombre: 'Alzahombre',
    nombrePlural: 'Alzahombres y plataformas elevadoras',
    operadorIncluido: alzahombre.operadorIncluido,
  },
];

export const CIUDADES_CON_PAGINA = ['curico', 'molina', 'talca'] as const;

export const CIUDADES_RENTAL: CiudadSEO[] = CIUDADES.filter((c) =>
  (CIUDADES_CON_PAGINA as readonly string[]).includes(c.slug),
);

/** Comunas atendidas sin página propia. */
export const COMUNAS_MAULE: string[] = CIUDADES.map((c) => c.nombre);

export function distanciaDesdeBase(slug: string): { km: number; tiempo: string } | null {
  const d = (DISTANCIAS_CONSTRUCTORA as Record<string, { km: number; tiempo: string }>)[slug];
  return d ?? null;
}

export function tipoPorSlug(slug: string): TipoMaquinaSEO | undefined {
  return TIPOS.find((t) => t.slug === slug);
}
