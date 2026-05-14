import type { Metadata } from "next";
import Link from "next/link";
import { supabasePublic } from "@jurmaq/shared/supabase";
import { notFound } from "next/navigation";
import ProductCard from "@/components/barraca/ProductCard";
import { applyDailyPromosToProducts } from "@/lib/promotions";

interface CategoriaRow {
  id: number;
  nombre: string;
  slug: string;
  imagen: string | null;
  padre_id: number | null;
}

interface ProductoRow {
  id: number;
  codigo: string;
  nombre: string;
  slug: string;
  precio: number;
  stock: number;
  unidad: string | null;
  imagen: string | null;
  medida: string | null;
}

interface SubCat {
  id: number;
  nombre: string;
  slug: string;
  product_count: number;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { data: cat } = await supabasePublic
    .from('barraca_categorias')
    .select('nombre, slug, id')
    .eq('slug', slug)
    .single();

  if (!cat) return { title: "Categoria no encontrada" };

  // Get subcategory IDs
  const { data: subcatRows } = await supabasePublic
    .from('barraca_categorias')
    .select('id')
    .eq('padre_id', cat.id);
  const allCatIds = [cat.id, ...(subcatRows || []).map((s: any) => s.id)];

  const { count: productTotal } = await supabasePublic
    .from('barraca_productos')
    .select('*', { count: 'exact', head: true })
    .eq('activo', true)
    .in('categoria_id', allCatIds);
  const productCount = { total: productTotal || 0 };

  const lowerName = cat.nombre.toLowerCase();
  return {
    title: `${cat.nombre} en Curicó y Molina · Barraca JURMAQ`,
    description: `${productCount.total} productos de ${lowerName} con precio publicado en Barraca JURMAQ Curicó · Molina. Despacho a Teno, Romeral, Talca y toda la Región del Maule. Súbenos tu cotización de la competencia y en menos de 2 horas te mejoramos el precio.`,
    keywords: [
      `${lowerName} Curicó`,
      `${lowerName} Molina`,
      `${lowerName} Teno`,
      `${lowerName} Talca`,
      `${lowerName} Maule`,
      `${lowerName} precio Curicó`,
      `comprar ${lowerName} Curicó`,
      `comprar ${lowerName} online Maule`,
      "barraca JURMAQ",
      "te mejoramos el precio",
      "súbenos tu cotización",
      "materiales de construcción Curicó",
      "materiales de construcción Molina",
      "ferretería online Maule",
    ],
    openGraph: {
      title: `${cat.nombre} · Barraca JURMAQ Curicó · Te mejoramos el precio en 2h`,
      description: `${productCount.total} productos de ${lowerName} con precio publicado y stock. Despacho a toda la Región del Maule. Cotiza online o súbenos tu cotización de Sodimac, Easy o Construmart y te mejoramos el precio en menos de 2 horas.`,
      url: `https://barraca.jurmaq.cl/categorias/${cat.slug}`,
      siteName: "Barraca JURMAQ",
      locale: "es_CL",
      type: "website",
      images: [
        {
          url: "/barraca/icon-512.png",
          width: 512,
          height: 512,
          alt: `${cat.nombre} en Barraca JURMAQ Curicó · Molina`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${cat.nombre} · Barraca JURMAQ Curicó`,
      description: `${productCount.total} productos. Súbenos tu cotización y en 2h te mejoramos el precio.`,
    },
    icons: {
      icon: [
        { url: "/barraca/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "/barraca/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: { url: "/barraca/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    },
    alternates: {
      canonical: `https://barraca.jurmaq.cl/categorias/${cat.slug}`,
    },
  };
}

const ITEMS_PER_PAGE = 16;

type SortOption = 'nombre' | 'precio_asc' | 'precio_desc' | 'stock_desc';

export default async function CategoriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; min?: string; max?: string; sort?: string; stock?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || "1", 10));
  const minPrice = sp.min ? parseFloat(sp.min) : undefined;
  const maxPrice = sp.max ? parseFloat(sp.max) : undefined;
  const sortBy = (sp.sort || 'nombre') as SortOption;
  const stockFilter = sp.stock || 'all';

  const { data: categoria } = await supabasePublic
    .from('barraca_categorias')
    .select('id, nombre, slug, imagen, padre_id')
    .eq('slug', slug)
    .eq('activa', true)
    .single();

  if (!categoria) notFound();

  // Get subcategories with product counts
  const { data: rawSubcats } = await supabasePublic
    .from('barraca_categorias')
    .select('id, nombre, slug')
    .eq('padre_id', categoria.id)
    .eq('activa', true)
    .order('nombre');

  // Get product counts for subcats
  const subcatIds = (rawSubcats || []).map((s: any) => s.id);
  const catIds = [categoria.id, ...subcatIds];
  let subcatCounts: Record<number, number> = {};
  if (catIds.length > 0) {
    const { data: countData } = await supabasePublic
      .from('barraca_productos')
      .select('categoria_id')
      .eq('activo', true)
      .in('categoria_id', catIds);
    if (countData) {
      for (const row of countData) {
        subcatCounts[row.categoria_id] = (subcatCounts[row.categoria_id] || 0) + 1;
      }
    }
  }

  const subcats: SubCat[] = (rawSubcats || []).map((s: any) => ({
    ...s,
    product_count: subcatCounts[s.id] || 0,
  }));

  // Build product query with price filters
  let countQuery = supabasePublic
    .from('barraca_productos')
    .select('*', { count: 'exact', head: true })
    .eq('activo', true)
    .in('categoria_id', catIds);

  let productQuery = supabasePublic
    .from('barraca_productos')
    .select('id, codigo, nombre, slug, precio, precio_original, en_oferta, solo_cotizar, stock, unidad, imagen, medida, categoria_id')
    .eq('activo', true)
    .in('categoria_id', catIds);

  if (minPrice !== undefined) {
    countQuery = countQuery.gte('precio', minPrice);
    productQuery = productQuery.gte('precio', minPrice);
  }
  if (maxPrice !== undefined) {
    countQuery = countQuery.lte('precio', maxPrice);
    productQuery = productQuery.lte('precio', maxPrice);
  }

  // Stock filter
  if (stockFilter === 'instock') {
    countQuery = countQuery.gt('stock', 0);
    productQuery = productQuery.gt('stock', 0);
  } else if (stockFilter === 'outofstock') {
    countQuery = countQuery.eq('stock', 0);
    productQuery = productQuery.eq('stock', 0);
  }

  const { count: totalCount } = await countQuery;
  const total = totalCount || 0;
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
  const offset = (page - 1) * ITEMS_PER_PAGE;

  // Sort
  if (sortBy === 'precio_asc') {
    productQuery = productQuery.order('precio', { ascending: true });
  } else if (sortBy === 'precio_desc') {
    productQuery = productQuery.order('precio', { ascending: false });
  } else if (sortBy === 'stock_desc') {
    productQuery = productQuery.order('stock', { ascending: false });
  } else {
    productQuery = productQuery.order('nombre');
  }

  const { data: productosRaw } = await productQuery
    .range(offset, offset + ITEMS_PER_PAGE - 1);

  // Apply daily-category promos so the grid matches the detail-page price.
  const productos = await applyDailyPromosToProducts((productosRaw || []) as any[]);

  // Parent category (for breadcrumb)
  let parentCat: { nombre: string; slug: string } | null = null;
  if (categoria.padre_id) {
    const { data: parent } = await supabasePublic
      .from('barraca_categorias')
      .select('nombre, slug')
      .eq('id', categoria.padre_id)
      .single();
    parentCat = parent;
  }

  // JSON-LD ItemList schema for category
  // Compute aggregate price stats so Google can show a price range in the
  // category snippet (e.g. "Fierros desde $3.750"). The lower-bound is the
  // strongest signal for shoppers comparing against homecenters.
  const pricedProducts = (productos || []).filter((p: any) => !p.solo_cotizar && p.precio > 0);
  const lowPrice = pricedProducts.reduce(
    (min: number, p: any) => {
      const effective = p.en_oferta && p.precio_original ? p.precio_original : p.precio;
      return effective < min ? effective : min;
    },
    Number.MAX_SAFE_INTEGER
  );
  const highPrice = pricedProducts.reduce(
    (max: number, p: any) => {
      const effective = p.en_oferta && p.precio_original ? p.precio_original : p.precio;
      return effective > max ? effective : max;
    },
    0
  );

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${categoria.nombre} - Barraca JURMAQ`,
    description: `Productos de ${categoria.nombre.toLowerCase()} disponibles en Barraca JURMAQ Curicó. Te mejoramos el precio de Sodimac, Easy o Construmart en menos de 2 horas. Despacho a toda la Región del Maule.`,
    numberOfItems: total,
    itemListElement: (productos || []).map((p: any, i: number) => {
      const effective = p.en_oferta && p.precio_original ? p.precio_original : p.precio;
      return {
        "@type": "ListItem",
        position: offset + i + 1,
        item: {
          "@type": "Product",
          name: p.nombre,
          url: `https://barraca.jurmaq.cl/producto/${p.slug}`,
          image: p.imagen || undefined,
          offers: {
            "@type": "Offer",
            price: effective,
            priceCurrency: "CLP",
            availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            seller: { "@id": "https://jurmaq.cl/#organization" },
            priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          },
        },
      };
    }),
  };

  // AggregateOffer for the whole category — feeds Google's "from $X" snippet.
  const aggregateOfferJsonLd = pricedProducts.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "OfferCatalog",
        "@id": `https://barraca.jurmaq.cl/categorias/${categoria.slug}#catalog`,
        name: categoria.nombre,
        url: `https://barraca.jurmaq.cl/categorias/${categoria.slug}`,
        provider: { "@id": "https://jurmaq.cl/#organization" },
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "CLP",
          lowPrice: lowPrice === Number.MAX_SAFE_INTEGER ? 0 : lowPrice,
          highPrice,
          offerCount: pricedProducts.length,
          availability: "https://schema.org/InStock",
          seller: { "@id": "https://jurmaq.cl/#organization" },
        },
      }
    : null;

  // JSON-LD Breadcrumb schema
  const breadcrumbItems = [
    { "@type": "ListItem" as const, position: 1, name: "Barraca", item: "https://barraca.jurmaq.cl" },
    { "@type": "ListItem" as const, position: 2, name: "Categorias", item: "https://barraca.jurmaq.cl/categorias" },
  ];
  if (parentCat) {
    breadcrumbItems.push({
      "@type": "ListItem" as const,
      position: 3,
      name: parentCat.nombre,
      item: `https://barraca.jurmaq.cl/categorias/${parentCat.slug}`,
    });
  }
  breadcrumbItems.push({
    "@type": "ListItem" as const,
    position: parentCat ? 4 : 3,
    name: categoria.nombre,
    item: `https://barraca.jurmaq.cl/categorias/${categoria.slug}`,
  });

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {aggregateOfferJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(aggregateOfferJsonLd) }}
        />
      )}
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-600 mb-8 flex-wrap bg-white border border-gray-200 rounded-lg px-4 py-3">
        <Link href="/" className="font-medium hover:text-orange-600 transition-colors">
          Inicio
        </Link>
        <svg className="w-4 h-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <Link href="/categorias" className="font-medium hover:text-orange-600 transition-colors">
          Categorias
        </Link>
        {parentCat && (
          <>
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <Link
              href={`/categorias/${parentCat.slug}`}
              className="hover:text-orange-600 transition-colors"
            >
              {parentCat.nombre}
            </Link>
          </>
        )}
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-navy-950 font-medium">{categoria.nombre}</span>
      </nav>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar - Sodimac-style filters. Native <details> collapsible on mobile,
            always-visible on desktop (lg:open + summary hidden). */}
        <aside className="w-full lg:w-64 shrink-0">
          <details className="bg-white border border-gray-200 rounded-xl lg:border-0 lg:bg-transparent lg:sticky lg:top-24 group" open>
            <summary className="flex items-center justify-between px-4 py-3 min-h-[48px] text-sm font-semibold text-navy-950 cursor-pointer select-none touch-manipulation list-none lg:hidden [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filtros
              </span>
              <svg className="w-5 h-5 text-gray-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="bg-white border-t border-gray-200 lg:border-0 p-5 space-y-6 rounded-b-xl lg:rounded-xl lg:bg-white lg:border lg:border-gray-200">
            {/* Subcategories */}
            {subcats.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-navy-950 uppercase tracking-wider mb-3">
                  Subcategorias
                </h3>
                <ul className="space-y-1">
                  {subcats.map((sub) => (
                    <li key={sub.id}>
                      <Link
                        href={`/categorias/${sub.slug}`}
                        className="flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 rounded-lg transition-colors"
                      >
                        <span>{sub.nombre}</span>
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                          {sub.product_count}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Stock Filter - like Sodimac availability */}
            <div>
              <h3 className="text-sm font-semibold text-navy-950 uppercase tracking-wider mb-3">
                Disponibilidad
              </h3>
              <div className="space-y-1.5">
                {[
                  { value: 'all', label: 'Todos' },
                  { value: 'instock', label: 'En stock' },
                  { value: 'outofstock', label: 'Sin stock (cotizable)' },
                ].map((opt) => (
                  <Link
                    key={opt.value}
                    href={`/categorias/${slug}?stock=${opt.value}${sp.min ? `&min=${sp.min}` : ''}${sp.max ? `&max=${sp.max}` : ''}${sp.sort ? `&sort=${sp.sort}` : ''}`}
                    className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors ${
                      stockFilter === opt.value
                        ? 'bg-orange-50 text-orange-700 font-semibold border border-orange-200'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                      stockFilter === opt.value
                        ? 'border-orange-600 bg-orange-600'
                        : 'border-gray-300'
                    }`}>
                      {stockFilter === opt.value && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    {opt.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Price Filter */}
            <div>
              <h3 className="text-sm font-semibold text-navy-950 uppercase tracking-wider mb-3">
                Rango de Precio
              </h3>
              <form className="space-y-3">
                <div className="flex gap-2 items-center">
                  <div className="relative w-full">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                    <input
                      type="number"
                      name="min"
                      placeholder="Min"
                      defaultValue={sp.min || ""}
                      inputMode="numeric"
                      className="w-full h-11 min-h-[44px] pl-6 pr-2 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <span className="text-gray-300 shrink-0">-</span>
                  <div className="relative w-full">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                    <input
                      type="number"
                      name="max"
                      placeholder="Max"
                      defaultValue={sp.max || ""}
                      inputMode="numeric"
                      className="w-full h-11 min-h-[44px] pl-6 pr-2 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>
                {sp.sort && <input type="hidden" name="sort" value={sp.sort} />}
                {sp.stock && <input type="hidden" name="stock" value={sp.stock} />}
                <button
                  type="submit"
                  className="w-full h-11 min-h-[44px] bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white text-sm font-semibold rounded-lg transition-colors touch-manipulation"
                >
                  Aplicar filtro
                </button>
                {(sp.min || sp.max) && (
                  <Link
                    href={`/categorias/${slug}${sp.sort ? `?sort=${sp.sort}` : ''}${sp.stock ? `${sp.sort ? '&' : '?'}stock=${sp.stock}` : ''}`}
                    className="block text-center text-xs text-orange-600 hover:text-orange-700 font-medium"
                  >
                    Limpiar filtro de precio
                  </Link>
                )}
              </form>
            </div>
            </div>
          </details>
        </aside>

        {/* Product Grid */}
        <div className="flex-1">
          {/* Header with count and sort - like Sodimac */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-navy-950">
                  {categoria.nombre}
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {total} producto{total !== 1 ? "s" : ""} en esta categoria
                </p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <label className="text-sm text-gray-500 whitespace-nowrap shrink-0">Ordenar:</label>
                <div className="relative w-full sm:w-auto">
                  {(() => {
                    const buildSortUrl = (sort: string) => {
                      const parts = [`/categorias/${slug}?sort=${sort}`];
                      if (sp.min) parts.push(`min=${sp.min}`);
                      if (sp.max) parts.push(`max=${sp.max}`);
                      if (sp.stock) parts.push(`stock=${sp.stock}`);
                      return parts.join('&');
                    };
                    const sortOptions = [
                      { value: 'nombre', label: 'Nombre (A-Z)' },
                      { value: 'precio_asc', label: 'Precio: menor a mayor' },
                      { value: 'precio_desc', label: 'Precio: mayor a menor' },
                      { value: 'stock_desc', label: 'Mayor disponibilidad' },
                    ];
                    return (
                      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5">
                        {sortOptions.map((opt) => (
                          <Link
                            key={opt.value}
                            href={buildSortUrl(opt.value)}
                            className={`px-3 min-h-[40px] py-2 text-xs font-medium rounded-lg transition-colors text-center flex items-center justify-center ${
                              sortBy === opt.value
                                ? 'bg-orange-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-orange-50 hover:text-orange-600 active:bg-orange-100'
                            }`}
                          >
                            {opt.label}
                          </Link>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>

          {(productos || []).length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <p className="text-gray-500 mb-4">
                No hay productos en esta categoria
              </p>
              <Link
                href="/categorias"
                className="text-sm font-semibold text-orange-600 hover:text-orange-700"
              >
                Ver otras categorias
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {(productos || []).map((p: any) => (
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
                    categoriaSlug={categoria.slug}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <nav aria-label="Paginacion" className="flex items-center justify-center gap-1.5 mt-10">
                  {page > 1 && (
                    <Link
                      href={`/categorias/${slug}?page=${page - 1}${sp.min ? `&min=${sp.min}` : ""}${sp.max ? `&max=${sp.max}` : ""}${sp.sort ? `&sort=${sp.sort}` : ""}${sp.stock ? `&stock=${sp.stock}` : ""}`}
                      className="inline-flex items-center gap-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      Anterior
                    </Link>
                  )}
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      (p) =>
                        p === 1 ||
                        p === totalPages ||
                        Math.abs(p - page) <= 2
                    )
                    .map((p, idx, arr) => (
                      <span key={p} className="inline-flex items-center">
                        {idx > 0 && arr[idx - 1] !== p - 1 && (
                          <span className="px-1.5 text-gray-400 select-none">...</span>
                        )}
                        <Link
                          href={`/categorias/${slug}?page=${p}${sp.min ? `&min=${sp.min}` : ""}${sp.max ? `&max=${sp.max}` : ""}${sp.sort ? `&sort=${sp.sort}` : ""}${sp.stock ? `&stock=${sp.stock}` : ""}`}
                          className={`w-10 h-10 flex items-center justify-center text-sm font-semibold rounded-lg transition-colors ${
                            p === page
                              ? "bg-orange-600 text-white shadow-sm"
                              : "bg-white border border-gray-300 text-gray-700 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600"
                          }`}
                        >
                          {p}
                        </Link>
                      </span>
                    ))}
                  {page < totalPages && (
                    <Link
                      href={`/categorias/${slug}?page=${page + 1}${sp.min ? `&min=${sp.min}` : ""}${sp.max ? `&max=${sp.max}` : ""}${sp.sort ? `&sort=${sp.sort}` : ""}${sp.stock ? `&stock=${sp.stock}` : ""}`}
                      className="inline-flex items-center gap-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600 transition-colors"
                    >
                      Siguiente
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </Link>
                  )}
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
