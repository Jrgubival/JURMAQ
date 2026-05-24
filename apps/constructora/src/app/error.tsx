'use client';

import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FBFBFA] px-4">
      <div className="text-center max-w-lg">
        <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-4">
          Error inesperado
        </p>
        <h1
          className="text-[#111111] mb-4 leading-[1.1]"
          style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 500, letterSpacing: '-0.015em' }}
        >
          Algo no salió{' '}
          <span className="font-[var(--font-serif)] italic" style={{ fontWeight: 400 }}>como esperábamos</span>.
        </h1>
        <p className="text-base text-[#5A5A57] mb-4 leading-relaxed">
          Intentá nuevamente o volvé al inicio. Si el problema persiste,
          escribinos por WhatsApp.
        </p>
        {error?.digest && (
          <p className="text-xs text-[#787774] mb-10 font-mono">
            Código: {error.digest}
          </p>
        )}
        {!error?.digest && <div className="mb-10" />}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-navy-950 hover:bg-[#111111] text-white text-sm font-medium tracking-[0.02em] rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-9-9m9 0v6m0 0h-6" />
            </svg>
            Intentar nuevamente
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-[#EAEAEA] text-[#111111] text-sm font-medium tracking-[0.02em] rounded-lg hover:bg-white transition-colors"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
