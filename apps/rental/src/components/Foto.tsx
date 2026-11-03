import type { Maquina } from '@/lib/maquinas';

/** Foto de máquina. La marca "Imagen referencial" va encima de la propia foto. */
export default function Foto({
  maquina,
  indice = 0,
  prioridad = false,
  className = 'aspect-[4/3]',
}: {
  maquina: Pick<Maquina, 'nombre' | 'fotos' | 'fotoReferencial'>;
  indice?: number;
  prioridad?: boolean;
  className?: string;
}) {
  const src = maquina.fotos[indice];
  return (
    <div className={`relative overflow-hidden bg-surface-alt ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={maquina.nombre}
          className="h-full w-full object-cover"
          loading={prioridad ? 'eager' : 'lazy'}
          fetchPriority={prioridad ? 'high' : 'auto'}
          decoding="async"
          width={800}
          height={600}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-ink-muted">Sin foto</div>
      )}
      {src && maquina.fotoReferencial ? (
        <span className="absolute bottom-2 left-2 rounded bg-ink/80 px-2 py-0.5 text-xs text-white">
          Imagen referencial
        </span>
      ) : null}
    </div>
  );
}
