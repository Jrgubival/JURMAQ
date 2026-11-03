import 'server-only';
import {
  CIUDADES,
  DISTANCIAS_CONSTRUCTORA,
  TIPOS_MAQUINA,
  type CiudadSEO,
  type TipoMaquinaSEO,
} from '@jurmaq/shared/seo';

const plataforma = TIPOS_MAQUINA.find((t) => t.slug === 'plataforma-elevadora');
if (!plataforma) throw new Error('Faltan tipos de máquina');

/** Tipos con máquina real en la flota. Las plataformas están en la base como `alzahombre`. */
export const TIPOS: TipoMaquinaSEO[] = [
  ...TIPOS_MAQUINA.filter((t) =>
    ['retroexcavadora', 'miniexcavadora', 'minicargador', 'camion-tolva', 'brazo-articulado', 'alzahombre'].includes(t.slug),
  ),
  { ...plataforma, tipoDb: 'alzahombre' },
];

export const CIUDADES_RENTAL: CiudadSEO[] = CIUDADES;

export const CIUDADES_CON_PAGINA = CIUDADES.map((c) => c.slug);

/** Una tarjeta del catálogo por tipo: alzahombre y plataforma comparten flota. */
export const TIPOS_MENU = TIPOS.filter((t) => t.slug !== 'plataforma-elevadora');

export const COMUNAS_MAULE: string[] = CIUDADES.map((c) => c.nombre);

export function distanciaDesdeBase(slug: string): { km: number; tiempo: string } | null {
  const d = (DISTANCIAS_CONSTRUCTORA as Record<string, { km: number; tiempo: string }>)[slug];
  return d ?? null;
}

export function tipoPorSlug(slug: string): TipoMaquinaSEO | undefined {
  return TIPOS.find((t) => t.slug === slug);
}
