import type { Metadata } from "next";
import { precioWebHastaNumerico, precioWebVigenteHasta } from "@/lib/vigencia";
import { nombreMarca } from "@/lib/marcas";
import { motivoSinRetracto } from "@/lib/retracto";
import { ZONAS_DESPACHO } from "@/lib/despacho/zonas";
import { DespachoZonaFicha } from "@/components/barraca/SelectorZona";
import Link from "@/components/barraca/Enlace";
import { supabasePublic } from "@jurmaq/shared/supabase";
import { notFound } from "next/navigation";
import ProductCard from "@/components/barraca/ProductCard";
import AddToCartClient from "./AddToCartClient";
import ShareButtons from "./ShareButtons";
import ReviewsList from "@/components/barraca/ReviewsList";
import ProductDetailImage from "@/components/barraca/ProductDetailImage";
import ViewItemTracker from "@jurmaq/shared/ui/ViewItemTracker";
import Breadcrumbs, { type BreadcrumbItem } from "@jurmaq/shared/ui/Breadcrumbs";
import { getActiveCategoryDiscountMap, getDailyPromotions, applyDailyPromosToProducts } from "@/lib/promotions";
import { formatCLP } from "@jurmaq/shared/format";
import { pagoEnLineaDisponible } from "@/lib/pagos";
import { CUOTAS_SIN_INTERES, CUOTAS_DESDE } from "@/lib/pagos/cuotas";
import { comboValido, textoCombo } from "@/lib/combos";
import { combosDe, conCombos } from "@/lib/combos-servidor";
import { resolvePrice } from "@/lib/pricing";
import { vistaDesde, vistaPrecio } from "@/lib/precio-web";
import { esComprable, unidadesDisponibles } from "@/lib/stock";
import Precio from "@/components/barraca/Precio";
import AvisoSinRetracto from "@/components/barraca/AvisoSinRetracto";
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';
import { describir, especificaciones } from '@/lib/ficha';

// ISR: la ficha de producto es pública (precio/stock).
//
// Estuvo en 600 (10 min). Con 1.978 productos activos eso son hasta 1.978 x 144
// regeneraciones al día, y fue la causa directa de los 355K ISR Writes contra
// una cuota de 200K. Los precios NO cambian cada 10 minutos: se actualizan
// cuando alguien edita en el admin o cuando se corre la carga masiva de
// inventario, o sea unas pocas veces al mes.
//
// 24 h de techo + revalidación bajo demanda (`revalidatePath`) desde el admin
// al guardar un producto: el que cambió se refresca al instante y el resto no
// se toca. Si un precio se ve viejo en el sitio, el bug está en que falta el
// revalidatePath en el endpoint que lo editó, no acá.
export const revalidate = 86400;

// Sin generateStaticParams la ruta quedaba DINÁMICA (ƒ en el build): el
// revalidate de arriba no tenía efecto y cada visita, bot y prefetch
// ejecutaba la función con ~10 consultas a Supabase. Con la lista vacía la
// ficha se genera la primera vez que alguien la pide y después sale de caché
// hasta que vence o hasta que /api/revalidar la invalida tras una carga de
// precios. No se pre-generan en el build: serían 1.977 páginas por deploy.
export async function generateStaticParams() {
  return [];
}

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
  // Sin stock o sin precio: "No disponible" y sin monto (ni en Google).
  const metaDisponible = esComprable({ precio: metaResolved.precioFinal, stock: producto.stock, solo_cotizar: producto.solo_cotizar });
  const precioFormateado = metaDisponible ? formatCLP(metaResolved.precioFinal) : "No disponible";
  const stockTexto = metaDisponible ? "Stock disponible" : "Por ahora no disponible en línea";
  // Etiqueta corta de stock para el TÍTULO visible (lo que el usuario ve en
  // Google). Antes el título solo decía "Precio y Stock" como palabras; ahora
  // surfacea el precio real + stock → sube CTR en consultas tipo "fierro
  // estriado 18mm", "cemento talca", "perfiles curico" (rankean pos 6–8.5, 0
  // clics). El precio ya estaba solo en el OG title.
  const titlePrecio = metaDisponible ? `${precioFormateado} · En stock` : "No disponible";

  return {
    title: `${producto.nombre} ${titlePrecio} · Barraca JURMAQ Curicó`,
    description: `Compra ${producto.nombre} en Barraca JURMAQ, Molina. ${metaDisponible ? `Precio web: ${precioFormateado}. ` : ''}${stockTexto}. Retiro en Molina y despacho en camión a Curicó, Talca y alrededores. Código: ${producto.codigo}.`,
    // Sin stock o sin precio no se puede comprar: fuera del índice hasta que vuelva
    // (la ficha sigue abierta para quien llegue por un enlace). También sale del sitemap.
    ...(metaDisponible ? {} : { robots: { index: false, follow: true } }),
    keywords: [
      producto.nombre.toLowerCase(),
      `${producto.nombre.toLowerCase()} precio`,
      `${producto.nombre.toLowerCase()} Curico`,
      `comprar ${producto.nombre.toLowerCase()} Maule`,
      "barraca JURMAQ",
      "materiales construccion Curico",
    ],
    openGraph: {
      title: `${producto.nombre} - ${titlePrecio} | Barraca JURMAQ`,
      description: `${producto.nombre}${metaDisponible ? ` a ${precioFormateado}` : ''}. ${stockTexto}. Despacho en Region del Maule.`,
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
    .select('id, codigo, nombre, slug, precio, precio_original, en_oferta, solo_cotizar, stock, unidad, categoria_id, imagen, producto_padre_id, medida, descripcion')
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

  // Hermanas de familia: la misma pieza en otra medida.
  //
  // El ancla de cada familia es la variante de menor id y tiene
  // producto_padre_id en NULL; las demás apuntan a ella. Por eso hay que
  // traer AMBAS cosas: las que apuntan al ancla y el ancla misma. La consulta
  // anterior sólo pedía `.eq('producto_padre_id', parentId)`, así que desde
  // una variante hija nunca aparecía el ancla, y estando parada en el ancla
  // no aparecía ninguna — con la columna vacía, el bloque no se dibujó nunca.
  let variantes: VarianteRow[] = [];
  const anclaId = producto.producto_padre_id || producto.id;
  const { data: varData } = await supabasePublic
    .from('barraca_productos')
    .select('id, nombre, slug, precio, stock, medida')
    .eq('activo', true)
    .or(`producto_padre_id.eq.${anclaId},id.eq.${anclaId}`)
    .order('id');
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
  const vista = vistaDesde(
    esComprable({ precio: precioResuelto.precioFinal, stock: producto.stock, solo_cotizar: producto.solo_cotizar }),
    precioResuelto.precioFinal,
    precioResuelto.precioTachado,
  );
  const combo = vista.disponible ? comboValido((await combosDe([producto.id])).get(producto.id), vista.precioWeb) : null;
  promoPrecioDescuento = precioResuelto.tipo === 'promo_dia' ? precioResuelto.precioFinal : null;

  // Related products (random order via Supabase -- not natively supported, so we just get recent)
  const { data: relacionados } = await supabasePublic
    .from('barraca_productos')
    .select('id, codigo, nombre, slug, precio, precio_original, en_oferta, solo_cotizar, stock, unidad, imagen, medida, categoria_id')
    .eq('categoria_id', producto.categoria_id)
    .eq('activo', true)
    .gt('stock', 0)
    .gt('precio', 0)
    .neq('id', producto.id)
    .order('stock', { ascending: false })
    .limit(12);
  // FIX (audit jun-2026): aplicar la promo de categoría a los relacionados para
  // que muestren el MISMO precio normal+oferta que la ficha (antes mostraban el
  // precio lleno → inconsistencia $3.990 vs $3.791 de tu captura).
  // Sólo lo que se puede comprar (con los precios vigentes, no sólo los de la
  // base): una sugerencia "No disponible" no sirve para nada.
  const relacionadosConPromo = await conCombos(
    (await applyDailyPromosToProducts(relacionados || [])).filter((p) => vistaPrecio(p).disponible).slice(0, 4),
  );

  // AggregateRating REAL (no fabricado): agregado de reviews moderadas
  // ('aprobada') desde la vista barraca_productos_rating. Solo se inyecta en el
  // schema si hay al menos 1 review real → estrellas legítimas en Google. Si no
  // hay reviews, NO se emite (política de Google: prohibido inventar ratings).
  let aggregateRating: { ratingValue: number; reviewCount: number } | null = null;
  try {
    const { data: ratingRow } = await supabasePublic
      .from('barraca_productos_rating')
      .select('total_reviews, rating_promedio')
      .eq('producto_id', producto.id)
      .maybeSingle();
    if (ratingRow && Number(ratingRow.total_reviews) > 0 && ratingRow.rating_promedio != null) {
      aggregateRating = {
        ratingValue: Math.round(Number(ratingRow.rating_promedio) * 10) / 10,
        reviewCount: Number(ratingRow.total_reviews),
      };
    }
  } catch {
    // sin reviews / vista no disponible → no se emite aggregateRating
  }

  const marcaLd = nombreMarca(producto.nombre);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: producto.nombre,
    description: `${producto.nombre}${producto.medida ? ` (${producto.medida})` : ""} en Barraca JURMAQ, Molina. Retiro en Molina y despacho en camión a Molina, Curicó, Talca y alrededores.`,
    image: producto.imagen || undefined,
    // El código de Softmad es interno: va como sku, no como mpn (no es del fabricante).
    sku: producto.codigo,
    ...(marcaLd ? { brand: { "@type": "Brand", name: marcaLd } } : {}),
    category: categoria?.nombre || "Materiales de Construccion",
    // Solo si hay reviews reales aprobadas (ver fetch arriba). Nunca fabricado.
    ...(aggregateRating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: aggregateRating.ratingValue,
            reviewCount: aggregateRating.reviewCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    // Sin oferta cuando no se vende: no publicar un precio que no se cobra.
    ...(vista.disponible ? { offers: {
      "@type": "Offer",
      url: `https://barraca.jurmaq.cl/producto/${producto.slug}`,
      price: precioResuelto.precioFinal,
      priceCurrency: "CLP",
      availability:
        producto.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": "https://barraca.jurmaq.cl/#organization" },
      // La misma vigencia del precio web que se muestra (Términos 5.3).
      ...(precioWebVigenteHasta() ? { priceValidUntil: precioWebVigenteHasta() } : {}),
      areaServed: [
        { "@type": "City", name: "Curicó" },
        { "@type": "City", name: "Molina" },
        { "@type": "City", name: "Teno" },
        { "@type": "City", name: "Romeral" },
        { "@type": "City", name: "Talca" },
        { "@type": "AdministrativeArea", name: "Región del Maule" },
      ],
      // Camión propio a las zonas de lib/despacho/zonas.ts (Molina gratis). Lo
      // preparamos en 1 a 5 días hábiles (checkout).
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: {
          "@type": "MonetaryAmount",
          currency: "CLP",
          minValue: Math.min(...ZONAS_DESPACHO.map((z) => z.costo)),
          maxValue: Math.max(...ZONAS_DESPACHO.map((z) => z.costo)),
        },
        shippingDestination: {
          "@type": "DefinedRegion",
          addressCountry: "CL",
          addressRegion: "Maule",
        },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          // Sólo la preparación, que es lo que prometen los Términos (sin plazo de tránsito).
          handlingTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 5, unitCode: "DAY" },
        },
      },
      // Términos 11: retracto de 10 días corridos, en el local o lo retiramos sin
      // costo; algunos productos no tienen retracto (lib/retracto.ts).
      hasMerchantReturnPolicy: motivoSinRetracto(producto.codigo)
        ? {
            "@type": "MerchantReturnPolicy",
            applicableCountry: "CL",
            returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
          }
        : {
            "@type": "MerchantReturnPolicy",
            applicableCountry: "CL",
            returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
            merchantReturnDays: 10,
            returnMethod: "https://schema.org/ReturnInStore",
            returnFees: "https://schema.org/FreeReturn",
          },
    } } : {}),
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbLd) }} />
      <ViewItemTracker
        id={producto.id}
        nombre={producto.nombre}
        precio={precioResuelto.precioFinal}
        categoria={categoria?.nombre}
      />

      {/* Extra bottom padding on mobile for sticky add-to-cart bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-12 pb-32 lg:pb-12">
        <Breadcrumbs
          variant="light"
          className="mb-5 lg:mb-10"
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
            <div className="aspect-[4/3] sm:aspect-square bg-[#FBFBFA] relative product-image-zoom flex items-center justify-center">
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

            {/* Precio web / precio normal (tachado) / No disponible: ver lib/precio-web.ts. */}
            <div className="border-t border-b border-[#EAEAEA] py-6 my-2">
              <Precio vista={vista} unidad={producto.unidad} tamano="ficha" />
              {combo && (
                <p className="mt-1 text-sm font-medium text-[#2F7F4E] tabular-nums">{textoCombo(combo)}</p>
              )}
              {/* Cuotas sin interés de Webpay: sólo con Webpay activo y desde $50.000. */}
              {vista.disponible && vista.precioWeb >= CUOTAS_DESDE && pagoEnLineaDisponible() && (
                <p className="mt-1 text-sm text-[#5A5A57] tabular-nums">
                  o {CUOTAS_SIN_INTERES} cuotas sin interés de {formatCLP(Math.ceil(vista.precioWeb / CUOTAS_SIN_INTERES))}
                </p>
              )}
              {vista.disponible && <AvisoSinRetracto codigo={producto.codigo} />}
              {vista.disponible ? (
                <p className="mt-3 text-sm text-[#5A5A57] flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>IVA incluido</span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1.5 text-[#2F7F4E] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2F7F4E]" aria-hidden="true" />
                    {unidadesDisponibles(producto.stock)} en stock
                  </span>
                </p>
              ) : (
                <p className="mt-2 text-sm text-[#5A5A57]">Por ahora no se puede comprar en línea. Consúltanos por WhatsApp.</p>
              )}
            </div>
            {/* Cómo llega, en dos filas (como Sodimac e Imperial). Sin plazos ni
                costos de despacho hasta tener las tarifas. */}
            {vista.disponible && (
              <ul className="my-5 divide-y divide-[#EAEAEA] rounded-xl border border-[#EAEAEA] bg-white text-sm">
                <li className="flex items-start gap-3 px-4 py-3">
                  <svg className="w-5 h-5 mt-0.5 text-navy-950 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  <span><span className="font-semibold text-navy-950">Retiro en Molina</span> <span className="text-[#2F7F4E] font-medium">· gratis</span><br /><span className="text-[#5A5A57]">Av. Poniente 2157, en horario de atención.</span></span>
                </li>
                <li className="flex items-start gap-3 px-4 py-3">
                  <svg className="w-5 h-5 mt-0.5 text-navy-950 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8a2 2 0 012-2h7v10H5a2 2 0 01-2-2V8zm9-2h4l3 4v4a2 2 0 01-2 2h-5V6zM7 18a2 2 0 100-4 2 2 0 000 4zm10 0a2 2 0 100-4 2 2 0 000 4z" /></svg>
                  <span><span className="font-semibold text-navy-950">Despacho a domicilio</span><br /><span className="text-[#5A5A57]">Te llamaremos para coordinar el día según tu comuna.</span><DespachoZonaFicha /></span>
                </li>
              </ul>
            )}
            <div className="mb-2" />

            {/* Variants & Add to Cart - sticky on mobile */}
            <div className="lg:relative">
              <AddToCartClient producto={producto} variantes={variantes} vista={vista} combo={combo} />
            </div>

            {/* Share buttons */}
            <ShareButtons nombre={producto.nombre} slug={producto.slug} />

            {/* Descripción — ver src/lib/ficha.ts. Se arma con lo que el
                catálogo sabe (tipo, medida, terminación, marca, forma de venta)
                y el contexto escrito a mano de su categoría. Si alguien escribe
                una descripción en el panel, esa manda. */}
            <div className="mt-10 pt-8 border-t border-[#EAEAEA]">
              <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-3">
                Descripción
              </p>
              <p className="text-[15px] leading-relaxed text-[#37352F]">
                {describir({
                  nombre: producto.nombre,
                  medida: producto.medida,
                  unidad: producto.unidad,
                  descripcion: producto.descripcion,
                  categoria_nombre: categoria?.nombre ?? null,
                })}
              </p>
            </div>

            {/* Especificaciones — sólo las filas con valor real.
                Antes repetía "Categoría", que ya aparece en la miga de pan y en
                el encabezado, y mostraba "UN" como si fuera un dato técnico. */}
            <div className="mt-10 pt-8 border-t border-[#EAEAEA]">
              <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-4">Especificaciones</p>
              <dl className="divide-y divide-[#EAEAEA]">
                {especificaciones({
                  nombre: producto.nombre,
                  medida: producto.medida,
                  unidad: producto.unidad,
                  codigo: producto.codigo,
                  categoria_nombre: categoria?.nombre ?? null,
                }).map((fila) => (
                  <div key={fila.etiqueta} className="grid grid-cols-[150px_1fr] gap-4 py-3 text-sm">
                    <dt className="text-[#787774]">{fila.etiqueta}</dt>
                    <dd className="text-[#111111] font-medium">{fila.valor}</dd>
                  </div>
                ))}
              </dl>
              {precioWebHastaNumerico() && (
                <p className="mt-6 text-xs text-[#787774] leading-relaxed">
                  Precio web válido hasta el {precioWebHastaNumerico()}. Tu compra queda con el precio que confirmas.{" "}
                  <Link href="/terminos#5-precios" className="underline underline-offset-2 hover:text-navy-950">Términos y condiciones</Link>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Reviews / opiniones de clientes */}
        <ReviewsList productoId={producto.id} />

        {/* Related Products — editorial section */}
        {relacionadosConPromo.length > 0 && (
          <section className="mt-12 lg:mt-20 pt-8 border-t border-gray-200">
            <h2 className="text-lg lg:text-2xl font-bold text-navy-950 mb-4 lg:mb-6">También te puede interesar</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
              {relacionadosConPromo.map((p) => (
                <ProductCard key={p.id} id={p.id} nombre={p.nombre} codigo={p.codigo} slug={p.slug} precio={p.precio} precio_original={p.precio_original} en_oferta={p.en_oferta} solo_cotizar={p.solo_cotizar} imagen={p.imagen} stock={p.stock} unidad={p.unidad} medida={p.medida} combo={p.combo} categoriaSlug={categoria?.slug || ''} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
