import { CategoryGridSkeleton } from "@/components/barraca/LoadingSkeleton";

export default function CategoriasLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 animate-pulse">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2 mb-8">
        <div className="h-4 bg-gray-200 rounded w-12" />
        <div className="h-4 bg-gray-200 rounded w-4" />
        <div className="h-4 bg-gray-200 rounded w-20" />
      </div>

      {/* Title skeleton */}
      <div className="h-9 bg-gray-200 rounded w-72 mb-2" />
      <div className="h-5 bg-gray-200 rounded w-96 mb-10" />

      <CategoryGridSkeleton count={9} />
    </div>
  );
}
