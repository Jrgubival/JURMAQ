"use client";

import { useEffect } from "react";

/**
 * useFocusTrap — atrapa Tab/Shift+Tab dentro de un container.
 *
 * WCAG 2.1 SC 2.4.3 (Focus Order) + SC 2.1.2 (No Keyboard Trap).
 * Solo activa cuando `active=true`, así modales/drawers pueden montarse
 * desactivados sin secuestrar el teclado.
 *
 * Cómo funciona:
 *  - Al activarse, recupera todos los `focusable` dentro de ref.current.
 *  - Mueve foco al primero (o al `initialFocusRef` si se pasa).
 *  - Intercepta `keydown` Tab para wrap-around (último → primero, primero → último con Shift).
 *  - Al desactivarse, restaura foco al elemento que estaba activo antes.
 *  - Escape se maneja en el caller (modal) — este hook solo trap focus.
 *
 * Uso:
 *   const ref = useRef<HTMLDivElement>(null);
 *   useFocusTrap(ref, isOpen);
 *   return <div ref={ref} role="dialog">...</div>;
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  active: boolean,
  initialFocusRef?: React.RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;
    const previouslyFocused = (document.activeElement as HTMLElement | null) ?? null;

    const getFocusable = (): HTMLElement[] => {
      return Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute("aria-hidden") && el.offsetParent !== null);
    };

    // Initial focus
    const initial = initialFocusRef?.current ?? getFocusable()[0] ?? container;
    if (initial && typeof initial.focus === "function") {
      // Allow container to receive focus programmatically if it has tabindex
      if (!container.hasAttribute("tabindex")) {
        container.setAttribute("tabindex", "-1");
      }
      initial.focus({ preventScroll: false });
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (activeEl === first || !container.contains(activeEl)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (activeEl === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      // Restore focus
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [active, containerRef, initialFocusRef]);
}
