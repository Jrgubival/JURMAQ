export default function MaquinariasLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      {/* Header skeleton */}
      <div className="h-9 w-64 bg-gray-200 rounded-lg animate-pulse mb-3" />
      <div className="h-4 w-80 bg-gray-200 rounded animate-pulse mb-8" />

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="aspect-video bg-gray-200 animate-pulse" />
            <div className="p-4 space-y-3">
              <div className="h-5 bg-gray-200 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
              <div className="h-9 bg-gray-200 rounded-lg animate-pulse w-full mt-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
