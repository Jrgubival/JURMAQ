'use client';

import { useCallback, useState } from 'react';
import ConfirmDialog, { type ConfirmDialogProps } from './ConfirmDialog';

interface PendingConfirm {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogProps['variant'];
  onConfirm: () => void | Promise<void>;
}

/**
 * Hook + componente para reemplazar `confirm()` nativo con un modal
 * accesible y on-brand.
 *
 * Uso:
 * ```tsx
 * const { confirm, ConfirmDialogPortal } = useConfirmDialog();
 *
 * async function handleDelete(id: number) {
 *   const ok = await confirm({
 *     title: '¿Eliminar esta factura?',
 *     message: 'Esta acción no se puede deshacer.',
 *     confirmLabel: 'Eliminar',
 *     variant: 'danger',
 *   });
 *   if (!ok) return;
 *   await fetch(`/api/factura/${id}`, { method: 'DELETE' });
 * }
 *
 * return (<>
 *   <button onClick={() => handleDelete(123)}>Eliminar</button>
 *   <ConfirmDialogPortal />
 * </>);
 * ```
 *
 * `confirm()` retorna `Promise<boolean>` — el caller hace `if (!ok)
 * return;` igual que con `window.confirm()`, sin tener que manejar
 * state ni renderizar el modal.
 */
export function useConfirmDialog() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [resolver, setResolver] = useState<((ok: boolean) => void) | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = useCallback(
    (opts: Omit<PendingConfirm, 'onConfirm'> & { onConfirm?: () => void }): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        setPending({
          ...opts,
          onConfirm: opts.onConfirm || (() => undefined),
        });
        setResolver(() => resolve);
      });
    },
    []
  );

  const close = useCallback(
    (ok: boolean) => {
      if (resolver) resolver(ok);
      setResolver(null);
      setPending(null);
      setBusy(false);
    },
    [resolver]
  );

  const ConfirmDialogPortal = useCallback(() => {
    if (!pending) return null;
    return (
      <ConfirmDialog
        open
        title={pending.title}
        message={pending.message}
        confirmLabel={pending.confirmLabel}
        cancelLabel={pending.cancelLabel}
        variant={pending.variant}
        pending={busy}
        onConfirm={async () => {
          setBusy(true);
          try {
            await pending.onConfirm();
          } finally {
            close(true);
          }
        }}
        onCancel={() => close(false)}
      />
    );
  }, [pending, busy, close]);

  return { confirm, ConfirmDialogPortal };
}
