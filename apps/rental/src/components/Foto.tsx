import type { Maquina } from '@/lib/maquinas';

const CON_VARIANTE = /^\/images\/maquinarias\/(retroexcavadora-hmk-102b|minicargador-bobcat-s650|minicargador-bobcat-s570|camion-tolva-vw-constellation|plataforma-fullen-psc140|plataforma-genie-gs1930|brazo-articulado-jlg-e450aj|miniexcavadora-xcmg-xe35u)\.(jpg|png)$/;
const ANCHO: Record<string, number> = {
  'retroexcavadora-hmk-102b': 1600, 'minicargador-bobcat-s650': 1600, 'minicargador-bobcat-s570': 1200,
  'camion-tolva-vw-constellation': 1600, 'plataforma-fullen-psc140': 1600, 'plataforma-genie-gs1930': 1440,
  'brazo-articulado-jlg-e450aj': 1110, 'miniexcavadora-xcmg-xe35u': 1228,
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
