import { ProductGridSkeleton } from "@/components/barraca/LoadingSkeleton";

export default function CategoriaSlugLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 animate-pulse">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2 mb-8">
        <div className="h-4 bg-gray-200 rounded w-12" />
        <div className="h-4 bg-gray-200 rounded w-4" />
        <div className="h-4 bg-gray-200 rounded w-20" />
        <div className="h-4 bg-gray-200 rounded w-4" />
        <div className="h-4 bg-gray-200 rounded w-28" />
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar skeleton */}
        <aside className="w-full lg:w-64 shrink-0">
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-6">
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 bg-gray-200 rounded-lg" />
              ))}
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-28 mb-3" />
              <div className="flex gap-2">
                <div className="h-9 bg-gray-200 rounded-lg flex-1" />
                <div className="h-9 bg-gray-200 rounded-lg flex-1" />
              </div>
              <div className="h-9 bg-gray-200 rounded-lg" />
            </div>
          </div>
        </aside>

        {/* Product grid skeleton */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-6">
            <div className="h-8 bg-gray-200 rounded w-48" />
            <div className="h-4 bg-gray-200 rounded w-24" />
          </div>
          <ProductGridSkeleton count={8} />
        </div>
      </div>
    </div>
  );
}
