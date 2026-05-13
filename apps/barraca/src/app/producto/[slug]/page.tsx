import type { Metadata } from "next";
import Link from "next/link";
import { supabaseAdmin } from "@jurmaq/shared/supabase";
import { notFound } from "next/navigation";
import ProductCard from "@/components/barraca/ProductCard";
import AddToCartClient from "./AddToCartClient";
import ShareButtons from "./ShareButtons";
import ProductDetailImage from "@/components/barraca/ProductDetailImage";
import ViewItemTracker from "@/components/analytics/ViewItemTracker";
import { getActiveCategoryDiscountMap, getDailyPromotions } from "@/lib/promotions";
import { formatCLP } from "@jurmaq/shared/format";

interface ProductoRow {
  id: number;
  codigo: string;
  nombre: string;
  slug: string;
  precio: number;
  precio_original?: number | null;
  en_oferta?: boolean;
  solo_cotizar?: boolean;
  stock: number;
  unidad: string | null;
  categoria_id: number;
  imagen: string | null;
  producto_padre_id: number | null;
  medida: string | null;
}

interface CategoriaRow {
  id: number;
  nombre: string;
  slug: string;
}

interface VarianteRow {
  id: number;
  nombre: string;
  slug: string;
  precio: number;
  stock: number;
  medida: string | null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { data: producto } = await supabaseAdmin
    .from('barraca_productos')
    .select('nombre, precio, precio_original, en_oferta, stock, slug, imagen, codigo, categoria_id')
    .eq('slug', slug)
    .single();

  if (!producto) return { title: "Producto no encontrado" };

  // Use the same active-promo source as the listing pages (cascade through
  // subcategories included). Previously we only checked today's top-4 daily
  // promos, which meant a product in a promo'd category showed full price on
  // the detail page on days when its promo wasn't in the daily rotation.
  let metaPromoPrecio: number | null = null;
  try {
    const promoMap = await getActiveCategoryDiscountMap();
    const discountPct = producto.categoria_id != null ? promoMap.get(producto.categoria_id) : undefined;
    if (discountPct && discountPct > 0 && producto.precio > 0) {
      metaPromoPrecio = Math.round(producto.precio * (1 - discountPct / 100));
    }
  } catch {
    // silently ignore
  }

  // Para metadata, usar promo price > precio_original (real) si esta en oferta > precio
  const precioMostrar = metaPromoPrecio
    ? metaPromoPrecio
    : producto.en_oferta && producto.precio_original
    ? producto.precio_original
    : producto.precio;
  const precioFormateado = `${formatCLP(precioMostrar)}`;
  const stockTexto =
    producto.stock > 0 ? "Stock disponible" : "Consultar disponibilidad";

  return {
    title: `${producto.nombre} | Barraca JURMAQ Curico - Precio y Stock`,
    description: `Compra ${producto.nombre} en Barraca JURMAQ Curico. Precio: ${precioFormateado}. ${stockTexto}. Envio a Curico, Teno, Molina, Talca y toda la Region del Maule. Codigo: ${producto.codigo}.`,
    keywords: [
      producto.nombre.toLowerCase(),
      `${producto.nombre.toLowerCase()} precio`,
      `${producto.nombre.toLowerCase()} Curico`,
      `comprar ${producto.nombre.toLowerCase()} Maule`,
      "barraca JURMAQ",
      "materiales construccion Curico",
    ],
    openGraph: {
      title: `${producto.nombre} - ${precioFormateado} | Barraca JURMAQ`,
      description: `${producto.nombre} a ${precioFormateado}. ${stockTexto}. Despacho en Region del Maule.`,
      url: `https://barraca.jurmaq.cl/producto/${producto.slug}`,
      siteName: "JURMAQ.cl",
      locale: "es_CL",
      type: "article",
      ...(producto.imagen
        ? {
            images: [
              {
                url: producto.imagen,
                width: 800,
                height: 800,
                alt: producto.nombre,
              },
            ],
          }
        : {}),
    },
    alternates: {
      canonical: `https://barraca.jurmaq.cl/producto/${producto.slug}`,
    },
  };
}

export default async function ProductoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: producto } = await supabaseAdmin
    .from('barraca_productos')
    .select('id, codigo, nombre, slug, precio, precio_original, en_oferta, solo_cotizar, stock, unidad, categoria_id, imagen, producto_padre_id, medida')
    .eq('slug', slug)
    .eq('activo', true)
    .single();

  if (!producto) notFound();

  let categoria: CategoriaRow | undefined = undefined;
  if (producto.categoria_id) {
    const { data: cat } = await supabaseAdmin
      .from('barraca_categorias')
      .select('id, nombre, slug')
      .eq('id', producto.categoria_id)
      .single();
    if (cat) categoria = cat as CategoriaRow;
  }

  let variantes: VarianteRow[] = [];
  const parentId = producto.producto_padre_id || producto.id;
  const { data: varData } = await supabaseAdmin
    .from('barraca_productos')
    .select('id, nombre, slug, precio, stock, medida')
    .eq('producto_padre_id', parentId)
    .eq('activo', true)
    .order('medida')
    .order('nombre');
  variantes = (varData || []) as VarianteRow[];

  // Mirror the listing-page promo logic: any active promo on this product's
  // category (or parent category, via cascade) applies, regardless of whether
  // the promo is part of today's hero rotation. We still pull `dailyPromos`
  // separately to grab the promo title for the OFERTA DEL DIA badge.
  let dailyPromoDiscount: number | null = null;
  let dailyPromoTitle: string | null = null;
  let promoPrecioDescuento: number | null = null;
  try {
    const promoMap = await getActiveCategoryDiscountMap();
    const discountPct = producto.categoria_id != null ? promoMap.get(producto.categoria_id) : undefined;
    if (discountPct && discountPct > 0 && producto.precio > 0) {
      dailyPromoDiscount = discountPct;
      promoPrecioDescuento = Math.round(producto.precio * (1 - discountPct / 100));
      // Find the promo title (best-effort): try the daily rotation first, then
      // any active promo for this category.
      const dailyPromos = await getDailyPromotions(4);
      const matching =
        dailyPromos.find((p) => p.categoria_id === producto.categoria_id) || null;
      dailyPromoTitle = matching?.titulo || null;
      if (!dailyPromoTitle) {
        const { data: anyPromo } = await supabaseAdmin
          .from('barraca_promociones')
          .select('titulo')
          .eq('activa', true)
          .eq('categoria_id', producto.categoria_id)
          .limit(1)
          .maybeSingle();
        dailyPromoTitle = anyPromo?.titulo || null;
      }
    }
  } catch {
    // Promotions table may not exist yet - fail silently
  }

  // Related products (random order via Supabase -- not natively supported, so we just get recent)
  const { data: relacionados } = await supabaseAdmin
    .from('barraca_productos')
    .select('id, codigo, nombre, slug, precio, precio_original, en_oferta, solo_cotizar, stock, unidad, imagen, medida')
    .eq('categoria_id', producto.categoria_id)
    .eq('activo', true)
    .neq('id', producto.id)
    .limit(4);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: producto.nombre,
    description: `${producto.nombre}${producto.medida ? ` (${producto.medida})` : ""} en Barraca JURMAQ Curicó · Molina. Despacho a toda la Región del Maule. Si tienes cotización de Sodimac, Easy o Construmart, te mejoramos el precio en menos de 2 horas.`,
    image: producto.imagen || undefined,
    sku: producto.codigo,
    mpn: producto.codigo,
    brand: { "@type": "Brand", name: "JURMAQ Barraca" },
    category: categoria?.nombre || "Materiales de Construccion",
    offers: {
      "@type": "Offer",
      url: `https://barraca.jurmaq.cl/producto/${producto.slug}`,
      price: promoPrecioDescuento
        ? promoPrecioDescuento
        : producto.en_oferta && producto.precio_original
        ? producto.precio_original
        : producto.precio,
      priceCurrency: "CLP",
      availability:
        producto.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": "https://jurmaq.cl/#organization" },
      priceValidUntil: new Date(
        new Date().getFullYear(),
        new Date().getMonth() + 3,
        1
      )
        .toISOString()
        .split("T")[0],
      areaServed: [
        { "@type": "City", name: "Curicó" },
        { "@type": "City", name: "Molina" },
        { "@type": "City", name: "Teno" },
        { "@type": "City", name: "Romeral" },
        { "@type": "City", name: "Talca" },
        { "@type": "AdministrativeArea", name: "Región del Maule" },
      ],
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingDestination: {
          "@type": "DefinedRegion",
          addressCountry: "CL",
          addressRegion: "Maule",
        },
      },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "CL",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 7,
        returnMethod: "https://schema.org/ReturnByMail",
        returnFees: "https://schema.org/FreeReturn",
      },
    },
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Barraca", item: "https://barraca.jurmaq.cl" },
      ...(categoria ? [{ "@type": "ListItem", position: 2, name: categoria.nombre, item: `https://barraca.jurmaq.cl/categorias/${categoria.slug}` }] : []),
      { "@type": "ListItem", position: categoria ? 3 : 2, name: producto.nombre, item: `https://barraca.jurmaq.cl/producto/${producto.slug}` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <ViewItemTracker
        id={producto.id}
        nombre={producto.nombre}
        precio={promoPrecioDescuento ?? (producto.en_oferta && producto.precio_original ? producto.precio_original : producto.precio)}
        categoria={categoria?.nombre}
      />

      {/* Extra bottom padding on mobile for sticky add-to-cart bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 pb-56 lg:pb-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8 flex-wrap">
          <Link href="/barraca" className="hover:text-orange-600 transition-colors">Inicio</Link>
          {categoria && (
            <>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              <Link href={`/barraca/categorias/${categoria.slug}`} className="hover:text-orange-600 transition-colors">{categoria.nombre}</Link>
            </>
          )}
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <span className="text-navy-950 font-medium">{producto.nombre}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Image with zoom on hover - larger and centered */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="aspect-square bg-gray-50 relative product-image-zoom flex items-center justify-center">
              <ProductDetailImage imagen={producto.imagen} nombre={producto.nombre} categoriaSlug={categoria?.slug} />
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center pb-3">
              * Imagen referencial de la categoria. El producto puede variar.
            </p>
          </div>

          {/* Info */}
          <div className="flex flex-col">
            <h1 className="text-2xl lg:text-3xl font-bold text-navy-950 mb-2">{producto.nombre}</h1>
            {producto.medida && <p className="text-gray-500 mb-4">{producto.medida}</p>}

            {/* Daily promotion discount (virtual, calculated on-the-fly) */}
            {promoPrecioDescuento && dailyPromoDiscount ? (
              <>
                <div className="flex items-center gap-3 mb-1">
                  <span className="inline-flex px-2.5 py-0.5 text-xs font-bold bg-orange-500 text-white rounded-full">
                    OFERTA DEL DIA
                  </span>
                  <span className="inline-flex px-2 py-0.5 text-xs font-bold bg-red-100 text-red-700 rounded-full">
                    -{dailyPromoDiscount}%
                  </span>
                </div>
                {dailyPromoTitle && (
                  <p className="text-sm text-orange-600 font-medium mb-1">{dailyPromoTitle}</p>
                )}
                <p className="text-lg text-gray-400 line-through">
                  {formatCLP(producto.precio)}
                </p>
                <div className="flex items-baseline gap-2 mb-1">
                  <p className="text-3xl lg:text-4xl font-extrabold text-orange-600">
                    {formatCLP(promoPrecioDescuento)}
                  </p>
                  {producto.unidad && (
                    <span className="text-base text-gray-500 font-medium">/{producto.unidad}</span>
                  )}
                </div>
                <p className="text-[10px] text-gray-500">IVA incluido</p>
                <p className="text-[10px] text-gray-500 mt-1">
                  Precio tachado: valor de venta vigente en los ultimos 30 dias.
                </p>
              </>
            ) : producto.en_oferta && producto.precio_original && producto.precio_original > 0 ? (
              <>
                <div className="flex items-center gap-3 mb-1">
                  <span className="inline-flex px-2.5 py-0.5 text-xs font-bold bg-red-600 text-white rounded-full">
                    OFERTA
                  </span>
                  {producto.precio > producto.precio_original && (
                    <span className="inline-flex px-2 py-0.5 text-xs font-bold bg-red-100 text-red-700 rounded-full">
                      -{Math.round((1 - producto.precio_original / producto.precio) * 100)}%
                    </span>
                  )}
                </div>
                <p className="text-lg text-gray-400 line-through">
                  {formatCLP(producto.precio)}
                </p>
                <div className="flex items-baseline gap-2 mb-1">
                  <p className="text-3xl lg:text-4xl font-extrabold text-red-600">
                    {formatCLP(producto.precio_original)}
                  </p>
                  {producto.unidad && (
                    <span className="text-base text-gray-500 font-medium">/{producto.unidad}</span>
                  )}
                </div>
                <p className="text-[10px] text-gray-500">IVA incluido</p>
                <p className="text-[10px] text-gray-500 mt-1">
                  Precio tachado: valor de venta vigente en los ultimos 30 dias.
                </p>
              </>
            ) : producto.solo_cotizar ? (
              <div className="flex items-baseline gap-2 mb-2">
                <p className="text-2xl lg:text-3xl font-bold text-indigo-700">
                  Consultar precio
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-2 mb-1">
                  <p className="text-3xl lg:text-4xl font-extrabold text-navy-950">
                    {formatCLP(producto.precio)}
                  </p>
                  {producto.unidad && (
                    <span className="text-base text-gray-500 font-medium">/{producto.unidad}</span>
                  )}
                </div>
                {producto.precio > 0 && (
                  <p className="text-[10px] text-gray-500">IVA incluido</p>
                )}
              </>
            )}
            {producto.unidad && !producto.solo_cotizar && (
              <p className="text-sm text-gray-500 mb-4 mt-1">Precio por {producto.unidad}</p>
            )}

            {/* Stock */}
            <div className="mb-6">
              {producto.stock > 0 ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium bg-green-100 text-green-700 rounded-full">
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                  En stock ({producto.stock} disponibles)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 text-sm font-medium bg-red-100 text-red-700 rounded-full">
                  <span className="w-2 h-2 bg-red-500 rounded-full" />
                  Sin stock
                </span>
              )}
            </div>

            {/* Variants & Add to Cart - sticky on mobile */}
            <div className="lg:relative">
              <AddToCartClient producto={producto} variantes={variantes} precioPromo={promoPrecioDescuento} />
            </div>

            {/* Share buttons */}
            <ShareButtons nombre={producto.nombre} slug={producto.slug} />

            {/* Specifications */}
            <div className="mt-8 bg-gray-50 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-navy-950 uppercase tracking-wider mb-3">Especificaciones</h3>
              <dl className="space-y-2">
                <div className="flex justify-between text-sm">
                  <dt className="text-gray-500">Codigo</dt>
                  <dd className="font-medium text-gray-900">{producto.codigo}</dd>
                </div>
                {producto.unidad && (
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500">Unidad</dt>
                    <dd className="font-medium text-gray-900">{producto.unidad}</dd>
                  </div>
                )}
                {producto.medida && (
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500">Medida</dt>
                    <dd className="font-medium text-gray-900">{producto.medida}</dd>
                  </div>
                )}
                {categoria && (
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500">Categoria</dt>
                    <dd className="font-medium text-gray-900">{categoria.nombre}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>

        {/* Related Products */}
        {(relacionados || []).length > 0 && (
          <section className="mt-16">
            <h2 className="text-2xl font-bold text-navy-950 mb-6">Tambien te puede interesar</h2>
            <div className="grid grid-cols-1 min-[375px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
              {(relacionados || []).map((p: any) => (
                <ProductCard key={p.id} id={p.id} nombre={p.nombre} slug={p.slug} precio={p.precio} precio_original={p.precio_original} en_oferta={p.en_oferta} solo_cotizar={p.solo_cotizar} imagen={p.imagen} stock={p.stock} unidad={p.unidad} medida={p.medida} categoriaSlug={categoria?.slug || ''} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
