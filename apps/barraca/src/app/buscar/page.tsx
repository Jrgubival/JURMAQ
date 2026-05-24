import type { Metadata } from "next";
import Link from "next/link";
import { supabasePublic } from "@jurmaq/shared/supabase";
import { searchProducts } from "@/lib/search";
import ProductCard from "@/components/barraca/ProductCard";
import SearchBar from "@/components/barraca/SearchBar";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const q = sp.q || "";
  // Audit fix S2 #21: truncar query a 30 chars para evitar titles > 60 chars
  // que Google trunca en SERPs. La URL real conserva la query completa.
  const qShort = q.slice(0, 30).trim();
  return {
    title: qShort
      ? `Resultados para "${qShort}" · Barraca JURMAQ`
      : "Buscar productos · Barraca JURMAQ",
    description: q
      ? `Resultados de búsqueda para "${qShort}" en Barraca JURMAQ. Materiales de construcción con precios competitivos y despacho en Curicó y Región del Maule.`
      : "Busca entre mas de 1.600 productos de construccion en Barraca JURMAQ. Fierros, perfiles, planchas, herramientas y mas.",
    alternates: {
      canonical: "https://barraca.jurmaq.cl/buscar",
    },
    // SEO (audit fase 4.10): /buscar?q=* crea infinitas URLs basura indexables.
    // Noindex + follow → no se indexa pero los outlinks a productos / categorías
    // siguen siendo crawleables.
    robots: { index: false, follow: true },
  };
}

interface ProductoRow {
  id: number;
  codigo: string;
  nombre: string;
  slug: string;
  precio: number;
  precio_original: number | null;
  en_oferta: boolean;
  solo_cotizar: boolean;
  stock: number;
  unidad: string | null;
  imagen: string | null;
  medida: string | null;
  categoria_id: number | null;
}

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q || "").trim();

  let productos: ProductoRow[] = [];
  let catSlugMap: Record<number, string> = {};
  if (q.length >= 2) {
    // Use the shared search engine (handles synonyms, word splitting, partial matches)
    const results = await searchProducts(q, 48);
    productos = results as ProductoRow[];

    // Build category ID -> slug lookup for product images
    const catIds = [...new Set(productos.map((p) => p.categoria_id).filter(Boolean))] as number[];
    if (catIds.length > 0) {
      const { data: catSlugs } = await supabasePublic
        .from('barraca_categorias')
        .select('id, slug')
        .in('id', catIds);
      if (catSlugs) {
        for (const c of catSlugs) {
          catSlugMap[c.id] = c.slug;
        }
      }
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
        <Link href="/" className="hover:text-orange-600 transition-colors">
          Inicio
        </Link>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-navy-950 font-medium">Buscar</span>
      </nav>

      <div className="max-w-xl mb-8">
        <SearchBar defaultValue={q} size="lg" />
      </div>

      {q ? (
        <>
          <p className="text-gray-600 mb-6">
            <span className="font-semibold text-navy-950">
              {productos.length}
            </span>{" "}
            resultado{productos.length !== 1 ? "s" : ""} para{" "}
            <span className="font-semibold text-navy-950">&ldquo;{q}&rdquo;</span>
          </p>

          {productos.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
              {productos.map((p) => (
                <ProductCard
                  key={p.id}
                  id={p.id}
                  nombre={p.nombre}
                  slug={p.slug}
                  precio={p.precio}
                  precio_original={p.precio_original}
                  en_oferta={p.en_oferta}
                  solo_cotizar={p.solo_cotizar}
                  imagen={p.imagen}
                  stock={p.stock}
                  unidad={p.unidad}
                  medida={p.medida}
                  categoriaSlug={p.categoria_id ? catSlugMap[p.categoria_id] || '' : ''}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h2 className="text-xl font-bold text-navy-950 mb-2">
                No encontramos productos
              </h2>
              <p className="text-gray-500 mb-6">
                Intenta con otros términos de búsqueda o explora nuestras categorías
              </p>
              <Link
                href="/categorias"
                className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors"
              >
                Ver Categorias
              </Link>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <h2 className="text-xl font-bold text-navy-950 mb-2">
            Buscar Productos
          </h2>
          <p className="text-gray-500">
            Escribe el nombre del producto que necesitas
          </p>
        </div>
      )}
    </div>
  );
}
