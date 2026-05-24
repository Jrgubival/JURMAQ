'use client';

import { useEffect, useState } from 'react';

/**
 * Componente cliente que persiste el código del maestro en localStorage
 * al entrar a /maestros/[codigo]. Esto permite que el carrito y el
 * checkout lo apliquen automáticamente sin que el cliente tenga que
 * tipearlo de nuevo.
 *
 * Key: `barraca_maestro_codigo` (TTL 30 días vía `_set_at`).
 */
export default function MaestroLandingClient({
  codigo,
  nombre,
}: {
  codigo: string;
  nombre: string;
}) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        'barraca_maestro_codigo',
        JSON.stringify({ codigo, nombre, _set_at: Date.now() }),
      );
      setSaved(true);
    } catch {
      // localStorage bloqueado/full — el cliente todavía puede tipear el código manualmente.
    }
  }, [codigo, nombre]);

  return (
    <div className="inline-flex items-center gap-2 bg-[#EDF3EC] border border-[#346538]/20 rounded-xl px-4 py-3 mb-4">
      {saved && (
        <svg className="w-4 h-4 text-[#346538] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      )}
      <p className="text-sm text-[#346538]">
        {saved ? (
          <>
            <strong>Código guardado.</strong> Se aplicará automáticamente en tu próxima compra.
          </>
        ) : (
          <>
            Código <span className="font-mono font-semibold">{codigo}</span> listo para usar en checkout.
          </>
        )}
      </p>
    </div>
  );
}
