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
    <div className="inline-block bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4">
      <p className="text-sm text-green-800">
        {saved ? (
          <>
            ✅ <strong>Código guardado.</strong> Se aplicará automáticamente en tu próxima compra.
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
