"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * CuentaLinks — columna "Mi cuenta" del Footer con visibilidad condicional.
 *
 * Sin sesión activa: solo "Iniciar sesión".
 * Con sesión activa: 4 links del portal cliente.
 *
 * Estrategia: SSR-safe (default = solo login). On mount hace fetch a
 * `/api/cuenta/me` — si 200 → muestra los 4 links + "Cerrar sesión".
 * Si 401 → solo "Iniciar sesión" (estado por defecto).
 *
 * NO hace polling — el cliente que cierra sesión en otra tab no se notifica
 * hasta que recargue la página. Es aceptable para el footer.
 */
export default function CuentaLinks() {
  const [logged, setLogged] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/cuenta/me", { credentials: "include" })
      .then((res) => {
        if (cancelled) return;
        setLogged(res.ok);
      })
      .catch(() => {
        if (cancelled) return;
        setLogged(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <p className="text-[10px] font-semibold text-white/55 uppercase tracking-[0.22em] mb-4">
        Mi cuenta
      </p>
      <ul className="space-y-2.5">
        {logged ? (
          <>
            <li>
              <Link
                href="/cuenta"
                className="text-sm text-gray-300 hover:text-gold-400 transition-colors"
              >
                Resumen
              </Link>
            </li>
            <li>
              <Link
                href="/cuenta/cotizaciones"
                className="text-sm text-gray-300 hover:text-gold-400 transition-colors"
              >
                Mis cotizaciones
              </Link>
            </li>
            <li>
              <Link
                href="/cuenta/contratos"
                className="text-sm text-gray-300 hover:text-gold-400 transition-colors"
              >
                Mis contratos
              </Link>
            </li>
            <li>
              <Link
                href="/cuenta/garantias"
                className="text-sm text-gray-300 hover:text-gold-400 transition-colors"
              >
                Garantías
              </Link>
            </li>
          </>
        ) : (
          <li>
            <Link
              href="/cuenta"
              className="text-sm text-gray-300 hover:text-gold-400 transition-colors"
            >
              Iniciar sesión
            </Link>
          </li>
        )}
      </ul>
    </div>
  );
}
