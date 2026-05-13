import Link from 'next/link';

export default function BarracaNotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-lg">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 bg-orange-100">
          <svg className="w-10 h-10 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h1 className="text-5xl font-extrabold text-gray-900 mb-4">404</h1>
        <h2 className="text-xl font-semibold text-navy-950 mb-2">
          Pagina no encontrada
        </h2>
        <p className="text-gray-500 mb-8 leading-relaxed">
          La pagina que buscas no existe o fue movida. Explora nuestros productos o vuelve al inicio.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
            </svg>
            Volver a la Barraca
          </Link>
          <Link
            href="/categorias"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border-2 border-gray-300 text-gray-700 hover:border-gray-400 font-semibold rounded-xl transition-colors"
          >
            Explorar Categorias
          </Link>
        </div>
      </div>
    </div>
  );
}
