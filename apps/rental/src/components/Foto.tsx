import type { Maquina } from '@/lib/maquinas';

/** Foto de máquina. "Imagen referencial" va sobre la foto cuando no es de nuestra flota. */
export default function Foto({
  maquina,
  indice = 0,
  prioridad = false,
  className = 'aspect-[4/3]',
  ajuste = 'object-cover',
}: {
  maquina: Pick<Maquina, 'nombre' | 'fotos' | 'fotoReferencial'>;
  indice?: number;
  prioridad?: boolean;
  className?: string;
  ajuste?: string;
}) {
  const src = maquina.fotos[indice];
  return (
    <div className={`relative overflow-hidden bg-negro ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={maquina.nombre} className={`h-full w-full ${ajuste}`} loading={prioridad ? 'eager' : 'lazy'} fetchPriority={prioridad ? 'high' : 'auto'} decoding="async" width={1200} height={900} />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-white/60">Foto pendiente</div>
      )}
      {src && maquina.fotoReferencial ? <span className="absolute right-2 top-2 bg-negro/75 px-2 py-1 text-xs text-white">Imagen referencial</span> : null}
    </div>
  );
}
