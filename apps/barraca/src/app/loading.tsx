export default function BarracaLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      {/* Header skeleton */}
      <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse mb-8" />

      {/* Grid skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-white border border-gray-200 rounded-xl overflow-hidden"
          >
            {/* Image placeholder */}
            <div className="aspect-square bg-gray-200 animate-pulse" />
            {/* Text placeholders */}
            <div className="p-4 space-y-3">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
              <div className="h-5 bg-gray-200 rounded animate-pulse w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
