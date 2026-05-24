import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FBFBFA] px-4">
      <div className="text-center max-w-lg">
        <p
          className="font-[var(--font-serif)] italic text-[#956400] tabular-nums mb-2"
          style={{ fontSize: 'clamp(5rem, 12vw, 9rem)', fontWeight: 400, lineHeight: 1, letterSpacing: '-0.04em' }}
        >
          404
        </p>
        <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-3">
          Página no encontrada
        </p>
        <h1
          className="text-[#111111] mb-4 leading-[1.1]"
          style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2rem)', fontWeight: 500, letterSpacing: '-0.005em' }}
        >
          Esto no está donde{' '}
          <span className="font-[var(--font-serif)] italic" style={{ fontWeight: 400 }}>esperábamos</span>.
        </h1>
        <p className="text-base text-[#5A5A57] mb-10 leading-relaxed">
          La página que buscás no existe o cambió de dirección. Volvé al inicio
          o ve directo a lo que necesitabas.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-navy-950 hover:bg-[#111111] text-white text-sm font-medium tracking-[0.02em] rounded-lg transition-colors"
          >
            Volver al inicio
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </Link>
          <Link
            href="https://barraca.jurmaq.cl"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-[#EAEAEA] text-[#111111] text-sm font-medium tracking-[0.02em] rounded-lg hover:bg-white transition-colors"
          >
            Ir a la barraca
          </Link>
          <Link
            href="/contacto"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-[#EAEAEA] text-[#111111] text-sm font-medium tracking-[0.02em] rounded-lg hover:bg-white transition-colors"
          >
            Contactar
          </Link>
        </div>
      </div>
    </div>
  );
}
