"use client";

import { useEffect, useRef } from "react";
import { useFocusTrap } from "./useFocusTrap";

/**
 * Modal — WCAG 2.1 compliant dialog component.
 *
 * Cumple:
 *  - SC 1.3.1 Info and Relationships: role="dialog" + aria-labelledby + aria-modal.
 *  - SC 2.1.2 No Keyboard Trap: Escape cierra el modal.
 *  - SC 2.4.3 Focus Order: focus trap dentro del modal con wrap-around.
 *  - SC 2.4.7 Focus Visible: outline focus default del navegador respetado.
 *  - SC 3.2.1 On Focus: focus restaurado al elemento previo al cerrar.
 *
 * No incluye styles de fondo/animación opinadas — usa className para el panel.
 * El backdrop sí es opcional vía prop `backdrop`.
 *
 * Uso:
 *   const [open, setOpen] = useState(false);
 *   <Modal
 *     open={open}
 *     onClose={() => setOpen(false)}
 *     title="Confirmar acción"
 *     description="Esto no se puede deshacer."
 *   >
 *     <p>Contenido del modal…</p>
 *     <button onClick={() => setOpen(false)}>Aceptar</button>
 *   </Modal>
 *
 * Recomendación: en mobile, el panel debe ocupar full-width con safe-bottom.
 * El consumidor puede pasar `panelClassName` para estilizarlo.
 */
interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Texto descriptivo corto del modal — referenciado por aria-labelledby */
  title: string;
  /** Descripción opcional — referenciada por aria-describedby */
  description?: string;
  children: React.ReactNode;
  /** Si true (default), Escape cierra el modal */
  closeOnEscape?: boolean;
  /** Si true (default), click en backdrop cierra */
  closeOnBackdropClick?: boolean;
  /** Si true (default), renderiza backdrop con bg-black/40 */
  backdrop?: boolean;
  /** Clases del panel (caja blanca con contenido) */
  panelClassName?: string;
  /** Clases del wrapper fixed inset-0 */
  wrapperClassName?: string;
  /** ID único para aria-labelledby. Si no se pasa, se genera */
  labelId?: string;
}

let modalCounter = 0;

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  closeOnEscape = true,
  closeOnBackdropClick = true,
  backdrop = true,
  panelClassName = "bg-white rounded-2xl border border-[#EAEAEA] shadow-[0_24px_64px_-12px_rgba(0,0,0,0.25)] max-w-lg w-full p-6",
  wrapperClassName = "fixed inset-0 z-[80] flex items-center justify-center p-4",
  labelId,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const idRef = useRef<string>("");
  if (!idRef.current) {
    idRef.current = labelId ?? `modal-${++modalCounter}`;
  }
  const titleId = idRef.current;
  const descId = description ? `${titleId}-desc` : undefined;

  // Focus trap activa solo cuando abierto
  useFocusTrap(panelRef, open);

  // Escape handler + body scroll lock
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeOnEscape) {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, closeOnEscape]);

  if (!open) return null;

  return (
    <div
      className={wrapperClassName}
      onClick={(e) => {
        if (closeOnBackdropClick && e.target === e.currentTarget) onClose();
      }}
    >
      {backdrop && <div className="absolute inset-0 bg-black/40" aria-hidden="true" />}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className={`relative ${panelClassName}`}
      >
        {/* Visually hidden title for SR + visible if children don't provide own */}
        <h2 id={titleId} className="sr-only">
          {title}
        </h2>
        {description && (
          <p id={descId} className="sr-only">
            {description}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
