import type { Metadata } from "next";
import Link from "next/link";
import { supabasePublic } from "@jurmaq/shared/supabase";
import { notFound } from "next/navigation";
import ProductCard from "@/components/barraca/ProductCard";
import AddToCartClient from "./AddToCartClient";
import ShareButtons from "./ShareButtons";
import ReviewsList from "@/components/barraca/ReviewsList";
import ProductDetailImage from "@/components/barraca/ProductDetailImage";
import ViewItemTracker from "@jurmaq/shared/ui/ViewItemTracker";
import Breadcrumbs, { type BreadcrumbItem } from "@jurmaq/shared/ui/Breadcrumbs";
import { getActiveCategoryDiscountMap, getDailyPromotions } from "@/lib/promotions";
import { formatCLP } from "@jurmaq/shared/format";
import { resolvePrice } from "@/lib/pricing";

// ISR: la ficha de producto es pública (precio/stock). Revalida cada 10 min en
// vez de renderizar por request (antes la página no declaraba caché → dinámica).
export const revalidate = 600;

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
  const { data: producto } = await supabasePublic
    .from('barraca_productos')
    .select('nombre, precio, precio_original, en_oferta, solo_cotizar, stock, slug, imagen, codigo, categoria_id')
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
  }

  const metaResolved = resolvePrice(
    { precio: producto.precio, precio_original: producto.precio_original, en_oferta: producto.en_oferta, solo_cotizar: producto.solo_cotizar },
    metaPromoPrecio ? (producto.precio - metaPromoPrecio) / producto.precio * 100 : null,
  );
  const precioMostrar = metaResolved.precioFinal > 0 ? metaResolved.precioFinal : producto.precio;
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
      // siteName se hereda del layout ("Barraca JURMAQ").
      locale: "es_CL",
      type: "article",
      images: producto.imagen
        ? [
            {
              url: producto.imagen,
              width: 800,
              height: 800,
              alt: producto.nombre,
            },
          ]
        : [
            // Fallback al OG default de la barraca cuando no hay imagen del producto.
            {
              url: "/og-image-barraca-1200x630.png",
              width: 1200,
              height: 630,
              alt: `${producto.nombre} · Barraca JURMAQ`,
            },
            {
              url: "/icon-512.png",
              width: 512,
              height: 512,
              alt: "Barraca JURMAQ",
            },
          ],
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

  const { data: producto } = await supabasePublic
    .from('barraca_productos')
    .select('id, codigo, nombre, slug, precio, precio_original, en_oferta, solo_cotizar, stock, unidad, categoria_id, imagen, producto_padre_id, medida')
    .eq('slug', slug)
    .eq('activo', true)
    .single();

  if (!producto) notFound();

  let categoria: CategoriaRow | undefined = undefined;
  if (producto.categoria_id) {
    const { data: cat } = await supabasePublic
      .from('barraca_categorias')
      .select('id, nombre, slug')
      .eq('id', producto.categoria_id)
      .single();
    if (cat) categoria = cat as CategoriaRow;
  }

  let variantes: VarianteRow[] = [];
  const parentId = producto.producto_padre_id || producto.id;
  const { data: varData } = await supabasePublic
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
      const dailyPromos = await getDailyPromotions(4);
      const matching =
        dailyPromos.find((p) => p.categoria_id === producto.categoria_id) || null;
      dailyPromoTitle = matching?.titulo || null;
      if (!dailyPromoTitle) {
        const { data: anyPromo } = await supabasePublic
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
  }

  const precioResuelto = resolvePrice(producto, dailyPromoDiscount, dailyPromoTitle);
  promoPrecioDescuento = precioResuelto.tipo === 'promo_dia' ? precioResuelto.precioFinal : null;

  // Related products (random order via Supabase -- not natively supported, so we just get recent)
  const { data: relacionados } = await supabasePublic
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
      price: precioResuelto.precioFinal,
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
        <Breadcrumbs
          variant="light"
          className="mb-10"
          items={(() => {
            const items: BreadcrumbItem[] = [{ label: "Inicio", href: "/" }];
            if (categoria) {
              items.push({ label: categoria.nombre, href: `/categorias/${categoria.slug}` });
            }
            items.push({ label: producto.nombre });
            return items;
          })()}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
          {/* Image — hairline frame, no shadow heavy */}
          <div className="bg-white border border-[#EAEAEA] rounded-xl overflow-hidden">
            <div className="aspect-square bg-[#FBFBFA] relative product-image-zoom flex items-center justify-center">
              <ProductDetailImage imagen={producto.imagen} nombre={producto.nombre} categoriaSlug={categoria?.slug} />
            </div>
            <p className="text-[11px] text-[#787774] mt-2 text-center pb-3">
              * Imagen referencial de la categoría. El producto puede variar.
            </p>
          </div>

          {/* Info — Editorial Luxury hierarchy */}
          <div className="flex flex-col">
            <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-3">
              {categoria?.nombre ?? 'Producto'}
            </p>
            <h1
              className="text-[#111111] mb-2 leading-[1.15]"
              style={{ fontSize: 'clamp(1.625rem, 2.5vw, 2.25rem)', fontWeight: 500, letterSpacing: '-0.01em' }}
            >
              {producto.nombre}
            </h1>
            {producto.medida && <p className="text-base text-[#5A5A57] mb-6">{producto.medida}</p>}

            {/* Daily promotion discount (virtual, calculated on-the-fly) */}
            {precioResuelto.tipo === 'promo_dia' ? (
              <div className="border-t border-b border-[#EAEAEA] py-6 my-2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] border border-[#956400] text-[#956400] rounded-full">
                    {precioResuelto.label || 'Oferta del día'}
                  </span>
                  {precioResuelto.porcentajeDescuento && (
                    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9C2B1F] rounded-full border border-[#9C2B1F]/40">
                      -{precioResuelto.porcentajeDescuento}%
                    </span>
                  )}
                </div>
                {dailyPromoTitle && (
                  <p className="text-sm text-[#956400] font-medium mb-2">{dailyPromoTitle}</p>
                )}
                <p className="text-base text-[#787774] line-through mb-1">
                  {formatCLP(precioResuelto.precioTachado!)}
                </p>
                <div className="flex items-baseline gap-2 mb-1">
                  <p
                    className="text-[#111111]"
                    style={{ fontSize: 'clamp(2rem, 3.5vw, 2.75rem)', fontWeight: 500, letterSpacing: '-0.02em' }}
                  >
                    {formatCLP(precioResuelto.precioFinal)}
                  </p>
                  {producto.unidad && (
                    <span className="text-sm text-[#787774] font-medium">/{producto.unidad}</span>
                  )}
                </div>
                <p className="text-[11px] text-[#787774] mt-2">IVA incluido · valor de venta vigente últimos 30 días.</p>
              </div>
            ) : precioResuelto.tipo === 'oferta_real' ? (
              <div className="border-t border-b border-[#EAEAEA] py-6 my-2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] border border-[#9C2B1F] text-[#9C2B1F] rounded-full">
                    {precioResuelto.label || 'Oferta'}
                  </span>
                  {precioResuelto.porcentajeDescuento && (
                    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9C2B1F] rounded-full border border-[#9C2B1F]/40">
                      -{precioResuelto.porcentajeDescuento}%
                    </span>
                  )}
                </div>
                <p className="text-base text-[#787774] line-through mb-1">
                  {formatCLP(precioResuelto.precioTachado!)}
                </p>
                <div className="flex items-baseline gap-2 mb-1">
                  <p
                    className="text-[#111111]"
                    style={{ fontSize: 'clamp(2rem, 3.5vw, 2.75rem)', fontWeight: 500, letterSpacing: '-0.02em' }}
                  >
                    {formatCLP(precioResuelto.precioFinal)}
                  </p>
                  {producto.unidad && (
                    <span className="text-sm text-[#787774] font-medium">/{producto.unidad}</span>
                  )}
                </div>
                <p className="text-[11px] text-[#787774] mt-2">IVA incluido · valor de venta vigente últimos 30 días.</p>
              </div>
            ) : precioResuelto.tipo === 'cotizar' ? (
              <div className="border-t border-b border-[#EAEAEA] py-6 my-2">
                <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-2">
                  A pedido
                </p>
                <p
                  className="text-[#111111] font-[var(--font-serif)] italic leading-none"
                  style={{ fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', fontWeight: 400, letterSpacing: '-0.01em' }}
                >
                  Consultar precio
                </p>
                <p className="text-[11px] text-[#787774] mt-3">Cotización por WhatsApp o correo en menos de 2 horas hábiles.</p>
              </div>
            ) : (
              <div className="border-t border-b border-[#EAEAEA] py-6 my-2">
                <div className="flex items-baseline gap-2 mb-1">
                  <p
                    className="text-[#111111]"
                    style={{ fontSize: 'clamp(2rem, 3.5vw, 2.75rem)', fontWeight: 500, letterSpacing: '-0.02em' }}
                  >
                    {formatCLP(precioResuelto.precioFinal)}
                  </p>
                  {producto.unidad && (
                    <span className="text-sm text-[#787774] font-medium">/{producto.unidad}</span>
                  )}
                </div>
                {precioResuelto.precioFinal > 0 && (
                  <p className="text-[11px] text-[#787774] mt-2">IVA incluido.</p>
                )}
              </div>
            )}
            {producto.unidad && precioResuelto.tipo !== 'cotizar' && (
              <p className="text-xs text-[#787774] mb-6 mt-2">Precio por {producto.unidad}</p>
            )}

            {/* Stock — editorial inline indicator */}
            <div className="mb-8 flex items-center gap-2 text-sm">
              {producto.stock > 0 ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2F7F4E]" aria-hidden="true" />
                  <span className="text-[#2F7F4E] font-medium">En stock</span>
                  <span className="text-[#787774]">· {producto.stock} disponibles</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#9C2B1F]" aria-hidden="true" />
                  <span className="text-[#9C2B1F] font-medium">Sin stock</span>
                </>
              )}
            </div>

            {/* Variants & Add to Cart - sticky on mobile */}
            <div className="lg:relative">
              <AddToCartClient producto={producto} variantes={variantes} precioPromo={promoPrecioDescuento} />
            </div>

            {/* Share buttons */}
            <ShareButtons nombre={producto.nombre} slug={producto.slug} />

            {/* Specifications — editorial definition list */}
            <div className="mt-10 pt-8 border-t border-[#EAEAEA]">
              <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-4">Especificaciones</p>
              <dl className="divide-y divide-[#EAEAEA]">
                <div className="grid grid-cols-[120px_1fr] gap-4 py-3 text-sm">
                  <dt className="text-[#787774]">Código</dt>
                  <dd className="text-[#111111] font-medium">{producto.codigo}</dd>
                </div>
                {producto.unidad && (
                  <div className="grid grid-cols-[120px_1fr] gap-4 py-3 text-sm">
                    <dt className="text-[#787774]">Unidad</dt>
                    <dd className="text-[#111111] font-medium">{producto.unidad}</dd>
                  </div>
                )}
                {producto.medida && (
                  <div className="grid grid-cols-[120px_1fr] gap-4 py-3 text-sm">
                    <dt className="text-[#787774]">Medida</dt>
                    <dd className="text-[#111111] font-medium">{producto.medida}</dd>
                  </div>
                )}
                {categoria && (
                  <div className="grid grid-cols-[120px_1fr] gap-4 py-3 text-sm">
                    <dt className="text-[#787774]">Categoría</dt>
                    <dd className="text-[#111111] font-medium">{categoria.nombre}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>

        {/* Reviews / opiniones de clientes */}
        <ReviewsList productoId={producto.id} />

        {/* Related Products — editorial section */}
        {(relacionados || []).length > 0 && (
          <section className="mt-24 lg:mt-32 pt-12 border-t border-[#EAEAEA]">
            <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-3">
              Productos relacionados
            </p>
            <h2
              className="text-[#111111] mb-10 leading-[1.15]"
              style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2rem)', fontWeight: 500, letterSpacing: '-0.01em' }}
            >
              También te puede <span className="font-[var(--font-serif)] italic" style={{ fontWeight: 400 }}>interesar</span>.
            </h2>
            <div className="grid grid-cols-1 min-[375px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
              {(relacionados || []).map((p) => (
                <ProductCard key={p.id} id={p.id} nombre={p.nombre} slug={p.slug} precio={p.precio} precio_original={p.precio_original} en_oferta={p.en_oferta} solo_cotizar={p.solo_cotizar} imagen={p.imagen} stock={p.stock} unidad={p.unidad} medida={p.medida} categoriaSlug={categoria?.slug || ''} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
