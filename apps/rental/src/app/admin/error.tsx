'use client';

import { useRouter } from 'next/navigation';
import { startTransition } from 'react';

/** Un fallo al cargar no cierra la sesión: se puede reintentar aquí mismo. */
export default function ErrorPanel({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="rounded-[16px] border border-hairline bg-surface p-6">
      <h1 className="text-2xl">No pudimos cargar esta pantalla</h1>
      <p className="mt-2 text-ink-soft">Tu sesión sigue abierta. Intenta de nuevo en unos segundos.</p>
      <button
        type="button"
        className="boton boton-principal mt-4"
        onClick={() => startTransition(() => { router.refresh(); reset(); })}
      >
        Reintentar
      </button>
    </div>
  );
}
