import type { Maquina } from '@/lib/maquinas';

const CON_VARIANTE = /^\/images\/maquinarias\/(retroexcavadora-hmk-102b|minicargador-bobcat-s650|camion-tolva-vw-constellation|plataforma-fullen-psc140|plataforma-genie-gs1930)\.(jpg|png)$/;
const ANCHO: Record<string, number> = { 'retroexcavadora-hmk-102b': 1600, 'minicargador-bobcat-s650': 1290, 'camion-tolva-vw-constellation': 1280, 'plataforma-fullen-psc140': 900, 'plataforma-genie-gs1930': 720 };

/** El celular baja la versión de 800 px cuando existe. */
export function variantes(src: string, sizes: string): { srcSet?: string; sizes?: string } {
  const m = src.match(CON_VARIANTE);
  if (!m) return {};
  const chica = src.replace(/\.(jpg|png)$/, '-800.jpg');
  const ancho = ANCHO[m[1]];
  return { srcSet: ancho <= 800 ? `${chica} ${ancho}w` : `${chica} 800w, ${src} ${ancho}w`, sizes };
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
      {src && maquina.fotoReferencial ? <span className="absolute right-2 top-2 bg-negro/75 px-2 py-1 text-xs text-white">Imagen referencial</span> : null}
    </div>
  );
}
