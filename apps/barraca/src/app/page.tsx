import type { Metadata } from "next";
import Link from "next/link";
import { supabasePublic } from "@jurmaq/shared/supabase";
import ProductCard from "@/components/barraca/ProductCard";
import HeroSlider from "@/components/barraca/HeroSlider";
import MobileHero from "@/components/barraca/MobileHero";
import MobileTrustStrip from "@/components/barraca/MobileTrustStrip";
import PromotedProductCard from "@/components/barraca/PromotedProductCard";
import CountdownTimer from "@/components/barraca/CountdownTimer";
import { applyDailyPromosToProducts, getDailyPromotions, getPromotedProducts } from "@/lib/promotions";
import { titleCase } from "@jurmaq/shared/format";
import type { ProductoPromocionado } from "@/lib/promotions";

const categoryImages: Record<string, string> = {
  'fierros-construccion': '/images/barraca/categorias/fierro.jpg',
  'fijaciones': '/images/barraca/categorias/fijaciones.jpg',
  'herramientas-y-maq': '/images/barraca/categorias/herramientas.png',
  'pinturas': '/images/barraca/categorias/pinturas.webp',
  'perfiles-y-planchas': '/images/barraca/categorias/perfiles.webp',
  'electricidad-e-iluminacion': '/images/barraca/categorias/electricidad.png',
  'bano-cocina-y-loggia': '/images/barraca/categorias/bano.jpg',
  'seguridad-industrial': '/images/barraca/categorias/seguridad.webp',
  'jardin': '/images/barraca/categorias/jardin.png',
  'adhesivos-y-sellantes': '/images/barraca/categorias/adhesivos.webp',
  'cerraduras': '/images/barraca/categorias/cerraduras.jpg',
  'quincalleria': '/images/barraca/categorias/quincasilleria.webp',
  'cercos-y-mallas': '/images/barraca/categorias/mallas.jpg',
  'aridos-y-morteros': '/images/barraca/categorias/morteros.webp',
  'tabiqueria': '/images/barraca/categorias/tabiqueria.png',
  'techumbre': '/images/barraca/categorias/Techumbres.jpg',
  'aditivos-e-impermeabilizantes': '/images/barraca/categorias/impermeabilizante.webp',
  'aislacion': '/images/barraca/categorias/aislacion.webp',
};

function getCategoryImage(imagen: string | null, slug: string): string | null {
  if (imagen && imagen.startsWith('/images/barraca/')) return imagen;
  return categoryImages[slug] || imagen || null;
}

export const metadata: Metadata = {
  title:
    "Barraca de Fierros JURMAQ · Materiales de Construcción en Curicó y Molina",
  description:
    "Fierro estriado, perfiles, planchas, tubos, mallas Acma, pinturas y +1.600 productos en Barraca JURMAQ Curicó · Molina. Despacho a Teno, Romeral, Talca y toda la Región del Maule. Súbenos tu cotización de Sodimac, Easy o Construmart y en menos de 2 horas te mejoramos el precio.",
  keywords: [
    // Brand + value prop
    "barraca jurmaq",
    "te mejoramos el precio",
    "súbenos tu cotización",
    "mejor precio fierros Curicó",
    // Geo · barraca
    "barraca de fierros Curicó",
    "barraca de fierros Molina",
    "barraca de fierros Teno",
    "barraca de fierros Romeral",
    "barraca de fierros Talca",
    "barraca de fierros Maule",
    "barraca fierros Region del Maule",
    "ferretería Curicó",
    "ferretería Molina",
    "ferretería Teno",
    "ferretería Talca",
    "ferretería industrial Curicó",
    "ferretería online Maule",
    // Materiales construcción
    "materiales de construcción Curicó",
    "materiales de construcción Molina",
    "materiales de construcción Teno",
    "materiales de construcción Talca",
    "materiales construcción Maule online",
    "materiales construcción despacho Curicó",
    // Fierros
    "fierro estriado Curicó",
    "fierro estriado Molina",
    "fierro estriado Talca",
    "fierro estriado 8mm precio Curicó",
    "fierro estriado 10mm precio Curicó",
    "fierro estriado 12mm precio Curicó",
    "fierro estriado 16mm precio Maule",
    "fierro estriado 22mm Curicó",
    "comprar fierro Curicó",
    "comprar fierro Molina",
    "venta fierros Region del Maule",
    // Productos clave
    "perfiles metálicos Curicó",
    "perfiles metálicos Molina",
    "perfiles metálicos Maule",
    "planchas de acero Curicó",
    "planchas de zinc Curicó",
    "tubos metálicos Curicó",
    "tubos galvanizados Maule",
    "malla acma Curicó",
    "malla acma C92 precio",
    "malla acma Molina",
    "ángulos de fierro Curicó",
    "platinas acero Curicó",
    "pernos Curicó",
    "soldadura Curicó",
    // Marcas
    "Polpaico Curicó",
    "Melón Curicó",
    "Sherwin Williams Curicó",
    "Cintac Curicó",
    "Inchalam Curicó",
    "CAP Acero Maule",
    // Localidades servidas
    "Sagrada Familia",
    "Hualañé",
    "Licantén",
    "Vichuquén",
    "Rauco",
    "Linares",
    "Constitución",
  ],
  openGraph: {
    title:
      "Barraca de Fierros JURMAQ · Materiales en Curicó y Molina · Te mejoramos el precio en 2h",
    description:
      "+1.600 productos: fierros, perfiles, planchas, tubos, mallas, pinturas. Despacho a toda la Región del Maule. Súbenos tu cotización de la competencia y en menos de 2 horas te llega contraoferta JURMAQ por correo.",
    url: "https://barraca.jurmaq.cl",
    siteName: "Barraca JURMAQ",
    locale: "es_CL",
    type: "website",
    images: [
      {
        url: "/barraca/icon-512.png",
        width: 512,
        height: 512,
        alt: "Barraca de Fierros JURMAQ — Curicó, Molina y Región del Maule",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Barraca JURMAQ · Fierros y Materiales en Curicó y Molina",
    description:
      "Súbenos tu cotización de Sodimac, Easy o Construmart y en menos de 2 horas te mejoramos el precio. Despacho a toda la Región del Maule.",
  },
  icons: {
    icon: [
      { url: "/barraca/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/barraca/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/barraca/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/barraca/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/barraca/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: { url: "/barraca/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    shortcut: "/barraca/favicon-32x32.png",
  },
  alternates: {
    canonical: "https://barraca.jurmaq.cl",
  },
  manifest: "/barraca/manifest.json",
};

// Audit M10: ISR en lugar de force-dynamic. Antes cada visita disparaba
// SSR y queries a Supabase, lo que en serverless Vercel es ~$ por visita
// (function invocation + Supabase rows leidas). Promos y product counts
// cambian poco mas que un par de veces al dia, asi que revalidate cada
// hora da frescura suficiente con ~24 SSRs/dia en vez de N por visita.
// El admin que crea/expira promo puede forzar invalidacion via revalidate
// path API si necesita propagar inmediato.
export const revalidate = 3600;

interface Categoria {
  id: number;
  nombre: string;
  slug: string;
  imagen: string | null;
  product_count: number;
}

interface Producto {
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

export default async function BarracaHomePage() {
  // Fetch ALL parent categories, then sort by product count (most popular first)
  const { data: rawCategorias } = await supabasePublic
    .from('barraca_categorias')
    .select('id, nombre, slug, imagen')
    .eq('activa', true)
    .is('padre_id', null);

  const allCatIds = (rawCategorias || []).map((c: any) => c.id);
  let productCounts: Record<number, number> = {};
  if (allCatIds.length > 0) {
    const { data: countData } = await supabasePublic
      .from('barraca_productos')
      .select('categoria_id')
      .eq('activo', true)
      .in('categoria_id', allCatIds);
    if (countData) {
      for (const row of countData) {
        productCounts[row.categoria_id] = (productCounts[row.categoria_id] || 0) + 1;
      }
    }
  }
  // Sort by product count descending (most popular first), take top 6
  const categorias: Categoria[] = (rawCategorias || [])
    .map((c: any) => ({ ...c, product_count: productCounts[c.id] || 0 }))
    .sort((a: Categoria, b: Categoria) => b.product_count - a.product_count)
    .slice(0, 6);

  const { data: destacadosRaw } = await supabasePublic
    .from('barraca_productos')
    .select('id, codigo, nombre, slug, precio, precio_original, en_oferta, solo_cotizar, stock, unidad, imagen, medida, categoria_id')
    .eq('activo', true)
    .gte('stock', 0)
    .eq('destacado', true)
    .order('nombre')
    .limit(8);

  const { data: nuevosRaw } = await supabasePublic
    .from('barraca_productos')
    .select('id, codigo, nombre, slug, precio, precio_original, en_oferta, solo_cotizar, stock, unidad, imagen, medida, categoria_id')
    .eq('activo', true)
    .gte('stock', 0)
    .order('id', { ascending: false })
    .limit(8);

  // Apply daily-category promos to both lists so the homepage cards match
  // the price the customer sees on the product detail page.
  const destacados = await applyDailyPromosToProducts((destacadosRaw || []) as any[]);
  const nuevos = await applyDailyPromosToProducts((nuevosRaw || []) as any[]);

  // Build category ID -> slug lookup for product images
  const allProductCatIds = [
    ...new Set([
      ...(destacados || []).map((p: any) => p.categoria_id),
      ...(nuevos || []).map((p: any) => p.categoria_id),
    ].filter(Boolean)),
  ];
  let catSlugMap: Record<number, string> = {};
  if (allProductCatIds.length > 0) {
    const { data: catSlugs } = await supabasePublic
      .from('barraca_categorias')
      .select('id, slug')
      .in('id', allProductCatIds);
    if (catSlugs) {
      for (const c of catSlugs) {
        catSlugMap[c.id] = c.slug;
      }
    }
  }

  // Fetch daily promotions
  let dailyPromo = null;
  let promotedProducts: ProductoPromocionado[] = [];
  let promoCatSlug = '';
  try {
    const dailyPromos = await getDailyPromotions(4);
    if (dailyPromos.length > 0) {
      dailyPromo = dailyPromos[0];
      promotedProducts = await getPromotedProducts(dailyPromo, 8);
      // Get category slug for product images
      if (dailyPromo.barraca_categorias?.slug) {
        promoCatSlug = dailyPromo.barraca_categorias.slug;
      }
    }
  } catch {
    // Promotions table may not exist yet - fail silently
  }

  // JSON-LD LocalBusiness schema for Barraca
  const localBusinessJsonLd = {
    "@context": "https://schema.org",
    "@type": "HardwareStore",
    "@id": "https://barraca.jurmaq.cl/#hardwarestore",
    name: "Barraca de Fierros JURMAQ",
    alternateName: "Barraca JURMAQ",
    slogan: "Súbenos tu cotización y en menos de 2 horas te mejoramos el precio",
    description:
      "Barraca de fierros y materiales de construcción con más de 1.600 productos en Curicó y Molina: fierros estriados, perfiles metálicos, planchas de acero y zinc, tubos, mallas Acma, pernos, soldaduras, pinturas y herramientas. Despacho a toda la Región del Maule. Súbenos tu cotización de Sodimac, Easy o Construmart y en menos de 2 horas te mejoramos el precio.",
    url: "https://barraca.jurmaq.cl",
    telephone: "+56976673577",
    email: "contacto@jurmaq.cl",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Av. Poniente 2157",
      addressLocality: "Molina",
      addressRegion: "Maule",
      postalCode: "3560000",
      addressCountry: "CL",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: -35.1167,
      longitude: -71.2833,
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "08:30",
        closes: "18:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Saturday",
        opens: "09:00",
        closes: "14:00",
      },
    ],
    areaServed: [
      { "@type": "City", name: "Curicó" },
      { "@type": "City", name: "Teno" },
      { "@type": "City", name: "Molina" },
      { "@type": "City", name: "Romeral" },
      { "@type": "City", name: "Sagrada Familia" },
      { "@type": "City", name: "Hualañé" },
      { "@type": "City", name: "Licantén" },
      { "@type": "City", name: "Vichuquén" },
      { "@type": "City", name: "Rauco" },
      { "@type": "City", name: "Talca" },
      { "@type": "City", name: "Linares" },
      { "@type": "City", name: "Constitución" },
    ],
    parentOrganization: {
      "@type": "Organization",
      name: "Constructora Jorge Ubilla Rivera E.I.R.L.",
      url: "https://jurmaq.cl",
    },
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Catálogo Barraca de Fierros JURMAQ",
      itemListElement: categorias.map((cat) => ({
        "@type": "OfferCatalog",
        name: cat.nombre,
        url: `https://barraca.jurmaq.cl/categorias/${cat.slug}`,
        numberOfItems: cat.product_count,
      })),
    },
    priceRange: "$$",
    currenciesAccepted: "CLP",
    paymentAccepted: "Efectivo, Transferencia, Tarjeta de Crédito",
    image: "https://jurmaq.cl/images/barraca-hero.jpg",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(localBusinessJsonLd),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Inicio", item: "https://jurmaq.cl" },
              { "@type": "ListItem", position: 2, name: "Barraca de Fierros", item: "https://barraca.jurmaq.cl" },
            ],
          }),
        }}
      />
      {/* H1 first in DOM for correct heading hierarchy (before HeroSlider's H2) */}
      <h1 className="sr-only">
        Barraca de Fierros y Materiales de Construcción en Curicó y Molina ·
        Súbenos tu cotización y en menos de 2 horas te mejoramos el precio de
        Sodimac, Easy o Construmart · Despacho a toda la Región del Maule.
      </h1>

      {/* Hero — MobileHero (lg:hidden) replaces the slider on small screens
          so the user sees products faster. Desktop keeps the full slider. */}
      <MobileHero />
      <div className="hidden lg:block">
        <HeroSlider />
      </div>

      {/* Tagline + trust signals + despacho banner: desktop only.
          On mobile these were eating ~40% of the viewport before showing
          any product. Mobile gets a compact version near the bottom. */}
      <div className="hidden lg:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-2">
        <p className="text-3xl lg:text-4xl font-extrabold text-navy-950 mb-2" data-text-reveal aria-hidden="true">
          Barraca de fierros y materiales de construcción en Curicó
        </p>
      </div>

      {/* Spec-sheet: KPIs estilo planilla técnica de obra. Números grandes
          en tabular-nums (estables como ficha técnica), labels uppercase
          tracking-wider. Mobile-first: 2x2 grid en mobile, 1x4 en lg+. */}
      <section className="bg-navy-950 border-b border-navy-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-4 lg:gap-y-0 lg:divide-x lg:divide-navy-800">
            <div className="px-2 lg:px-4 text-center border-r border-navy-800 lg:border-r-0">
              <div className="text-xl lg:text-2xl font-extrabold text-white tabular-nums leading-none">+1.600</div>
              <div className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-orange-400">Productos en stock</div>
            </div>
            <div className="px-2 lg:px-4 text-center">
              <div className="text-xl lg:text-2xl font-extrabold text-white tabular-nums leading-none">2 h</div>
              <div className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-orange-400">Mejora tu cotización</div>
            </div>
            <div className="px-2 lg:px-4 text-center border-r border-navy-800 lg:border-r-0">
              <div className="text-xl lg:text-2xl font-extrabold text-white tabular-nums leading-none">12</div>
              <div className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-orange-400">Comunas con despacho</div>
            </div>
            <div className="px-2 lg:px-4 text-center">
              <div className="text-xl lg:text-2xl font-extrabold text-white leading-none">Real</div>
              <div className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-orange-400">Stock & precio en línea</div>
            </div>
          </div>
        </div>
      </section>

      <section className="hidden lg:block bg-orange-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-center gap-3 text-white">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <p className="text-sm sm:text-base font-semibold text-center">
              Despacho a toda la Región del Maule — Curicó, Teno, Molina, Talca, Romeral y más
            </p>
          </div>
        </div>
      </section>

      {/* === OFERTAS DEL DIA === */}
      {dailyPromo && promotedProducts.length > 0 && (
        <section className="py-10 lg:py-14 bg-gray-50 border-t border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Promo banner bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 border-l-4 border-orange-500 bg-white rounded-r-lg px-5 py-4 shadow-sm">
              <div className="flex items-center gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-orange-600 uppercase tracking-wider">Ofertas del día</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 bg-orange-100 text-orange-700 text-sm font-bold rounded-md">
                      -{dailyPromo.descuento_porcentaje}%
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-navy-950">
                    {dailyPromo.titulo}
                  </h2>
                  {dailyPromo.descripcion && (
                    <p className="text-gray-500 text-sm mt-0.5">{dailyPromo.descripcion}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-gray-400">Termina en</span>
                <CountdownTimer />
              </div>
            </div>

            {/* Promoted products grid — NO data-stagger to avoid GSAP hiding cards */}
            <div className={`grid gap-4 ${promotedProducts.length <= 3 ? 'grid-cols-1 min-[375px]:grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>
              {promotedProducts.map((product) => (
                <PromotedProductCard
                  key={product.id}
                  id={product.id}
                  nombre={product.nombre}
                  slug={product.slug}
                  precioOriginal={product.precio_original_calculado}
                  precioDescuento={product.precio_con_descuento}
                  descuento={product.descuento}
                  imagen={product.imagen}
                  stock={product.stock}
                  unidad={product.unidad}
                  medida={product.medida}
                  categoriaSlug={promoCatSlug}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* === Categories: MOBILE === Compact 4-col with circular thumbs */}
      <section id="categorias-mobile" className="lg:hidden px-4 pt-1 pb-2 scroll-mt-24">
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm font-bold text-navy-950 uppercase tracking-wide">
            Categorías principales
          </h2>
          <Link href="/categorias" className="text-xs font-semibold text-orange-600">
            Ver todas
          </Link>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {categorias.slice(0, 8).map((cat) => {
            const catImg = getCategoryImage(cat.imagen, cat.slug);
            return (
              <Link
                key={cat.id}
                href={`/categorias/${cat.slug}`}
                className="flex flex-col items-center gap-1.5 group active:scale-95 transition-transform"
              >
                <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden flex items-center justify-center">
                  {catImg ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={catImg}
                      alt={`${cat.nombre}`}
                      loading="lazy"
                      decoding="async"
                      width={120}
                      height={120}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <svg className="w-7 h-7 text-orange-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  )}
                </div>
                <span className="text-[10px] font-semibold text-navy-950 text-center leading-tight uppercase tracking-tight line-clamp-2">
                  {titleCase(cat.nombre)}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* === Categories: DESKTOP === full grid with overlay text */}
      <section id="categorias" className="hidden lg:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 scroll-mt-24 content-auto">
        <div className="mb-10">
          <h2 className="text-3xl font-bold text-navy-950 mb-2">Encuentra lo que necesitas</h2>
          <p className="text-gray-500">Explora nuestras categorias principales</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 lg:gap-5" data-stagger="0.08">
          {categorias.map((cat) => {
            const catImg = getCategoryImage(cat.imagen, cat.slug);
            return (
              <Link key={cat.id} href={`/categorias/${cat.slug}`} className="group relative rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
                <div className="aspect-[3/2] bg-gray-200 relative overflow-hidden">
                  {catImg ? (
                    <img src={catImg} alt={`${cat.nombre} - JURMAQ Barraca`} loading="lazy" decoding="async" width={400} height={267} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100">
                      <svg className="w-10 h-10 text-orange-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/5" />
                  <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
                    <h3 className="text-sm sm:text-base lg:text-lg font-bold text-white leading-tight">{titleCase(cat.nombre)}</h3>
                    <p className="text-xs sm:text-sm text-white/80 mt-0.5">{cat.product_count} productos</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
        <div className="text-center mt-8">
          <Link href="/categorias" className="inline-flex items-center gap-2 px-6 py-3 border-2 border-orange-600 text-orange-600 hover:bg-orange-600 hover:text-white font-semibold rounded-lg transition-colors">
            Ver todas las categorias
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Featured Products */}
      {(destacados || []).length > 0 && (
        <section id="destacados" className="bg-white pt-4 pb-8 lg:py-16 scroll-mt-24 content-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-3 lg:mb-10">
              <h2 className="text-sm lg:text-3xl font-bold text-navy-950 uppercase tracking-wide lg:normal-case lg:tracking-normal">
                <span className="lg:hidden">Productos destacados</span>
                <span className="hidden lg:inline">Lo más vendido</span>
              </h2>
              <Link href="/categorias" className="text-xs lg:text-sm font-semibold text-orange-600 hover:text-orange-700 transition-colors lg:inline-flex lg:items-center lg:gap-1">
                Ver todos
                <svg className="hidden lg:inline w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </Link>
            </div>
            <div className="grid grid-cols-1 min-[375px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
              {(destacados || []).map((p: any) => (
                <ProductCard key={p.id} id={p.id} nombre={p.nombre} slug={p.slug} precio={p.precio} precio_original={p.precio_original} en_oferta={p.en_oferta} solo_cotizar={p.solo_cotizar} imagen={p.imagen} stock={p.stock} unidad={p.unidad} medida={p.medida} categoriaSlug={catSlugMap[p.categoria_id] || ''} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* New Products */}
      {(nuevos || []).length > 0 && (
        <section id="nuevos" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 scroll-mt-24 content-auto">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl font-bold text-navy-950 mb-1">Recién llegados</h2>
            </div>
            <Link href="/categorias" className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-orange-600 hover:text-orange-700 transition-colors">
              Ver todos
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
          </div>
          <div className="grid grid-cols-1 min-[375px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
            {(nuevos || []).map((p: any) => (
              <ProductCard key={p.id} id={p.id} nombre={p.nombre} slug={p.slug} precio={p.precio} precio_original={p.precio_original} en_oferta={p.en_oferta} solo_cotizar={p.solo_cotizar} imagen={p.imagen} stock={p.stock} unidad={p.unidad} medida={p.medida} isNew categoriaSlug={catSlugMap[p.categoria_id] || ''} />
            ))}
          </div>
        </section>
      )}

      {/* Marcas */}
      <section className="bg-gray-50 border-t border-gray-200 py-12 lg:py-16 content-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl lg:text-3xl font-bold text-navy-950 mb-2">Marcas que nos respaldan</h2>
            <p className="text-gray-500">Trabajamos con los principales fabricantes de acero y materiales de Chile</p>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3 lg:gap-4">
            {[
              { name: "CAP Acero", logo: "/images/marcas/cap.svg" },
              { name: "Cintac", logo: "/images/marcas/cintac.png" },
              { name: "Inchalam", logo: "/images/marcas/inchalam.jpg" },
              { name: "Ternium", logo: "/images/marcas/ternium.svg" },
              { name: "Volcan", logo: "/images/marcas/volcan.png" },
              { name: "Prodac", logo: "/images/marcas/prodac.svg" },
              { name: "CBB Cementos", logo: "/images/marcas/cbb.png" },
            ].map((brand) => (
              <div key={brand.name} className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 flex items-center justify-center aspect-[3/2]">
                <img src={brand.logo} alt={brand.name} className="max-h-12 sm:max-h-14 max-w-full object-contain" loading="lazy" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mobile-only trust strip — slim 3-icon bar near the bottom */}
      <MobileTrustStrip />

      {/* CTA */}
      <section className="bg-navy-950 py-12 lg:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">¿No encuentras lo que buscas?</h2>
          <p className="text-lg text-gray-300 mb-8">Escríbenos por WhatsApp y te ayudamos en minutos. Sin compromiso.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="https://wa.me/56976673577?text=Hola%2C%20necesito%20cotizar%20materiales" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
              Cotizar por WhatsApp
            </a>
            <Link href="https://jurmaq.cl/contacto" className="inline-flex items-center justify-center gap-2 px-6 py-3 border-2 border-white/20 text-white hover:bg-white/10 font-semibold rounded-lg transition-colors">
              Llámanos
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
