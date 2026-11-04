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

/** Los textos compartidos dicen "certificado", que Jorge no ha confirmado. */
function limpiarTipo(t: TipoMaquinaSEO): TipoMaquinaSEO {
  const limpio = (x: string) => x.replace(/operador certificado/gi, 'operador');
  return {
    ...t,
    preguntasFrecuentes: t.preguntasFrecuentes.map((p) => ({ q: limpio(p.q), a: limpio(p.a) })),
    descripcionLarga: limpio(t.descripcionLarga),
  };
}

/** Tipos con máquina real en la flota. Las plataformas están en la base como `alzahombre`. */
export const TIPOS: TipoMaquinaSEO[] = [
  ...TIPOS_MAQUINA.filter((t) =>
    ['retroexcavadora', 'miniexcavadora', 'minicargador', 'camion-tolva', 'brazo-articulado', 'alzahombre'].includes(t.slug),
  ),
  { ...plataforma, tipoDb: 'alzahombre' },
].map(limpiarTipo);

export const CIUDADES_RENTAL: CiudadSEO[] = CIUDADES;

export const CIUDADES_CON_PAGINA = CIUDADES.map((c) => c.slug);

export const TIPOS_MENU = TIPOS;

export const COMUNAS_MAULE: string[] = CIUDADES.map((c) => c.nombre);

export function distanciaDesdeBase(slug: string): { km: number; tiempo: string } | null {
  const d = (DISTANCIAS_CONSTRUCTORA as Record<string, { km: number; tiempo: string }>)[slug];
  return d ?? null;
}

/** Fotos con resolución para una portada a todo el ancho. */
export function fotoPortada<T extends { tipo: string; nombre: string }>(flota: T[], indice: number): T | undefined {
  const grandes = flota.filter((m) => m.tipo === 'retroexcavadora' || m.tipo === 'camion' || /S650/.test(m.nombre));
  return grandes[indice % grandes.length] ?? flota[0];
}

export function tipoPorSlug(slug: string): TipoMaquinaSEO | undefined {
  return TIPOS.find((t) => t.slug === slug);
}
