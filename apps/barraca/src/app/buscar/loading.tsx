import { ProductGridSkeleton } from "@/components/barraca/LoadingSkeleton";

export default function BuscarLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 animate-pulse">
      <div className="h-9 bg-gray-200 rounded w-72 mb-2" />
      <div className="h-5 bg-gray-200 rounded w-96 mb-8" />
      <div className="h-12 bg-gray-200 rounded-xl mb-8 max-w-2xl" />
      <ProductGridSkeleton count={12} />
    </div>
  );
}
