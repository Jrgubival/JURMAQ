import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-lg">
        <div className="w-24 h-24 rounded-2xl flex items-center justify-center mx-auto mb-8 bg-navy-950">
          <span className="text-4xl font-black text-gold-500">
            J
          </span>
        </div>
        <h1 className="text-7xl font-extrabold text-gray-900 mb-4">404</h1>
        <h2 className="text-xl font-semibold text-gray-700 mb-3">
          Pagina no encontrada
        </h2>
        <p className="text-gray-500 mb-8 leading-relaxed">
          La pagina que buscas no existe o fue movida. Vuelve al inicio para
          encontrar lo que necesitas.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-navy-950 hover:bg-navy-800 text-white font-semibold rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
            </svg>
            Volver al Inicio
          </Link>
          <Link
            href="https://barraca.jurmaq.cl"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border-2 border-gray-300 text-gray-700 hover:border-gray-400 font-semibold rounded-xl transition-colors"
          >
            Ir a la Barraca
          </Link>
          <Link
            href="/contacto"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border-2 border-gray-300 text-gray-700 hover:border-gray-400 font-semibold rounded-xl transition-colors"
          >
            Contactar
          </Link>
        </div>
      </div>
    </div>
  );
}
