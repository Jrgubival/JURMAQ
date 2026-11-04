import type { Maquina } from '@/lib/maquinas';

const CON_VARIANTE = /^\/images\/maquinarias\/(retroexcavadora-hmk-102b|minicargador-bobcat-s650|minicargador-bobcat-s570|camion-tolva-vw-constellation|plataforma-fullen-psc140|plataforma-genie-gs1930|brazo-articulado-jlg-e450aj|miniexcavadora-xcmg-xe35u)\.(jpg|png)$/;
const ANCHO: Record<string, number> = {
  'retroexcavadora-hmk-102b': 1600, 'minicargador-bobcat-s650': 1600, 'minicargador-bobcat-s570': 1200,
  'camion-tolva-vw-constellation': 1600, 'plataforma-fullen-psc140': 1600, 'plataforma-genie-gs1930': 1440,
  'brazo-articulado-jlg-e450aj': 1110, 'miniexcavadora-xcmg-xe35u': 1449,
};

/** El celular baja la versión de 800 px. La foto grande siempre se sirve en JPG
 *  (la de Genie queda guardada como .png en la base, por eso se cambia aquí). */
export function variantes(src: string, sizes: string): { srcSet?: string; sizes?: string } {
  const m = src.match(CON_VARIANTE);
  if (!m) return {};
  const chica = src.replace(/\.(jpg|png)$/, '-800.jpg');
  const grande = src.replace(/\.png$/, '.jpg');
  return { srcSet: `${chica} 800w, ${grande} ${ANCHO[m[1]]}w`, sizes };
}

/** Versiones WebP para portadas, sacadas de los masters (nunca agrandadas). */
const HERO: Record<string, number[]> = {
  'retroexcavadora-hmk-102b': [960, 1600, 2400], 'camion-tolva-vw-constellation': [960, 1600, 2400],
  'minicargador-bobcat-s650': [960, 1600, 2400], 'minicargador-bobcat-s570': [960, 1600],
  'plataforma-fullen-psc140': [960, 1600], 'plataforma-genie-gs1930': [960],
  'brazo-articulado-jlg-e450aj': [960], 'miniexcavadora-xcmg-xe35u': [960],
};
const nombreDe = (src: string) => src.match(CON_VARIANTE)?.[1];

/** Sólo las fotos con versión de 2400 px pueden ir a todo el ancho. */
export function heroAncho(src?: string): boolean {
  const n = src ? nombreDe(src) : undefined;
  return !!n && (HERO[n] ?? []).includes(2400);
}

/** srcset de portada: WebP del master y, si es más grande, el JPG principal. */
export function variantesHero(src: string, sizes: string): { srcSet?: string; sizes?: string } {
  const n = nombreDe(src);
  if (!n || !HERO[n]) return variantes(src, sizes);
  const partes = HERO[n].map((w) => `/images/maquinarias/hero/${n}-${w}.webp ${w}w`);
  const max = HERO[n][HERO[n].length - 1];
  if (ANCHO[n] > max) partes.push(`${src.replace(/\.png$/, '.jpg')} ${ANCHO[n]}w`);
  return { srcSet: partes.join(', '), sizes };
}

/** Foto de máquina. "Imagen referencial" va sobre la foto cuando no es de nuestra flota. */
export default function Foto({
  maquina,
  indice = 0,
  prioridad = false,
  className = 'aspect-[4/3]',
  ajuste = 'object-cover',
  fondo = 'bg-negro',
}: {
  maquina: Pick<Maquina, 'nombre' | 'fotos' | 'fotoReferencial'>;
  indice?: number;
  prioridad?: boolean;
  className?: string;
  ajuste?: string;
  /** Fondo mientras carga o si la foto no llena el cuadro. */
  fondo?: string;
}) {
  const src = maquina.fotos[indice];
  return (
    <div className={`relative overflow-hidden ${fondo} ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={maquina.nombre} {...variantes(src, '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw')} className={`h-full w-full ${ajuste}`} loading={prioridad ? 'eager' : 'lazy'} fetchPriority={prioridad ? 'high' : 'auto'} decoding="async" width={1200} height={900} />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-ink-muted">Foto pendiente</div>
      )}
      {src && maquina.fotoReferencial ? <span className="absolute right-3 top-3 rounded-full bg-negro/70 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">Imagen referencial</span> : null}
    </div>
  );
}
