export default function CuentaLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      {/* Title skeleton */}
      <div className="h-8 w-56 bg-gray-200 rounded-lg animate-pulse mb-6" />

      {/* List skeleton (cotizaciones / contratos / garantías) */}
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-5 bg-gray-200 rounded animate-pulse w-40" />
              <div className="h-6 bg-gray-200 rounded-full animate-pulse w-24" />
            </div>
            <div className="h-3 bg-gray-200 rounded animate-pulse w-2/3 mb-2" />
            <div className="h-3 bg-gray-200 rounded animate-pulse w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
