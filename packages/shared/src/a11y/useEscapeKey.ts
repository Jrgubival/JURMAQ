"use client";

import { useEffect } from "react";

/**
 * useEscapeKey — ejecuta callback cuando el usuario presiona Escape.
 *
 * WCAG 2.1 SC 2.1.2 (No Keyboard Trap). Útil para cerrar drawers, menús
 * desplegables, popovers — cualquier UI que se monta sobre el contenido
 * principal y debe poder cerrarse con teclado.
 *
 * Solo activa cuando `enabled=true`. Esto permite usarlo en componentes
 * que pueden estar montados pero "cerrados".
 *
 * Uso:
 *   useEscapeKey(() => setOpen(false), isOpen);
 */
export function useEscapeKey(callback: () => void, enabled: boolean = true): void {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        callback();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [callback, enabled]);
}
