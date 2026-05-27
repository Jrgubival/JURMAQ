"use client"

import { useEffect, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';

export interface SignaturePadHandle {
  isEmpty: () => boolean;
  clear: () => void;
  toDataURL: (type?: string) => string;
}

interface Props {
  /** Called once on mount with a stable handle for imperative actions. */
  onReady: (handle: SignaturePadHandle | null) => void;
  disabled?: boolean;
}

/**
 * Thin client-side wrapper around `react-signature-canvas`.
 * Loaded via `next/dynamic` with `ssr: false` from the parent page so that
 * `signature_pad` (which touches canvas/DOM APIs on mount) never runs on
 * the server.
 *
 * We expose imperative methods through an `onReady` callback instead of
 * `forwardRef` because `next/dynamic` historically does not forward refs
 * reliably across versions.
 */
export default function SignaturePad({ onReady, disabled = false }: Props) {
  const ref = useRef<SignatureCanvas | null>(null);

  useEffect(() => {
    onReady({
      isEmpty: () => ref.current?.isEmpty() ?? true,
      clear: () => ref.current?.clear(),
      toDataURL: (type = 'image/png') =>
        ref.current?.toDataURL(type) ?? '',
    });
    return () => {
      onReady(null);
    };
    // onReady is expected to be stable (wrapped in useCallback by caller).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SignatureCanvas
      ref={(instance: SignatureCanvas | null) => {
        ref.current = instance;
      }}
      penColor="#0c1d3a"
      canvasProps={{
        className: `block max-w-full w-full h-40 touch-none ${
          disabled ? 'pointer-events-none' : ''
        }`,
        'aria-label': 'Area de firma',
      }}
    />
  );
}
