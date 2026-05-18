'use client';

import { useEffect, useRef } from 'react';

/**
 * ConfirmDialog — modal de confirmación accesible.
 *
 * Reutilizado para acciones destructivas (eliminar, anular, etc.). Reemplaza
 * los `confirm()` nativos (que rompen la accesibilidad de screen readers y
 * el branding del sitio) y los modales ad-hoc duplicados por la app.
 *
 * - role="dialog" + aria-modal="true" — el screen reader entra en modal mode.
 * - Atrapamos focus al primer botón al montarse.
 * - Escape cierra (igual que un dialog nativo).
 * - Click en backdrop cierra.
 * - El botón confirmar es destructive-styled (rojo) por default; pasá
 *   variant="primary" para acciones no destructivas.
 *
 * Uso:
 *   <ConfirmDialog
 *     open={pendingId !== null}
 *     title="¿Eliminar producto?"
 *     message="Esta acción no se puede deshacer."
 *     confirmLabel="Eliminar"
 *     onCancel={() => setPendingId(null)}
 *     onConfirm={() => doDelete(pendingId)}
 *     pending={isDeleting}
 *   />
 */
export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Variante visual del botón confirmar. Default 'danger'. */
  variant?: 'danger' | 'primary';
  /** Mientras `pending=true` los botones se deshabilitan y se anuncia aria-busy. */
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  // Focus management + escape handling
  useEffect(() => {
    if (!open) return;
    confirmBtnRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pending) {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, pending, onCancel]);

  // Body scroll lock while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const confirmCls = variant === 'danger'
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : 'bg-navy-950 hover:bg-navy-800 text-white';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={() => { if (!pending) onCancel(); }}
    >
      <div
        className="bg-white rounded-xl border border-gray-200 max-w-sm w-full p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-dialog-title" className="font-bold text-navy-950 mb-2">
          {title}
        </h3>
        {message && (
          <div className="text-sm text-gray-600 mb-4">
            {message}
          </div>
        )}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 disabled:opacity-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            disabled={pending}
            aria-busy={pending}
            className={`px-4 py-2 ${confirmCls} disabled:opacity-60 disabled:cursor-not-allowed text-sm font-bold rounded-lg transition-colors`}
          >
            {pending ? 'Procesando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
