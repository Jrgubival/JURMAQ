import type { Metadata } from "next";
import Link from "@/components/barraca/Enlace";
import Image from "next/image";
import { supabasePublic } from "@jurmaq/shared/supabase";
import type { Database } from "@jurmaq/shared/db-types";
import ProductCard from "@/components/barraca/ProductCard";
import HeroSlider from "@/components/barraca/HeroSlider";
import MobileHero from "@/components/barraca/MobileHero";
import MarcasCarrusel from "@/components/barraca/MarcasCarrusel";
import MobileTrustStrip from "@/components/barraca/MobileTrustStrip";
import { PROMESA, PROMESA_CORTA_META } from "@/lib/promesa";
import PromotedProductCard from "@/components/barraca/PromotedProductCard";
import CountdownTimer from "@/components/barraca/CountdownTimer";
import { applyDailyPromosToProducts, getDailyPromotions, getPromotedProducts } from "@/lib/promotions";
import { titleCase } from "@jurmaq/shared/format";
import type { ProductoPromocionado } from "@/lib/promotions";
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';
import { familiaDe } from '@/lib/variantes';
import Revelar from '@/components/barraca/Revelar';
import { vistaPrecio, type ProductoConPrecio } from '@/lib/precio-web';

type BarracaCategoriaRow = Database['public']['Tables']['barraca_categorias']['Row'];
type BarracaProductoRow = Database['public']['Tables']['barraca_productos']['Row'];

// Fotos de categoría (ver public/images/barraca/categorias/fotos/CREDITOS.md).
// La columna `imagen` de la base manda si apunta a /images/barraca/.
const categoryImages: Record<string, string> = {
  'fierros-construccion': '/images/barraca/categorias/fotos/fierros-construccion.webp',
  'fijaciones': '/images/barraca/categorias/fotos/fijaciones.webp',
  'herramientas-y-maq': '/images/barraca/categorias/fotos/herramientas-y-maq.webp',
  'pinturas': '/images/barraca/categorias/fotos/pinturas.webp',
  'perfiles-y-planchas': '/images/barraca/categorias/fotos/perfiles-y-planchas.webp',
  'electricidad-e-iluminacion': '/images/barraca/categorias/fotos/electricidad-e-iluminacion.webp',
  'bano-cocina-y-loggia': '/images/barraca/categorias/fotos/bano-cocina-y-loggia.webp',
  'seguridad-industrial': '/images/barraca/categorias/fotos/seguridad-industrial.webp',
  'jardin': '/images/barraca/categorias/fotos/jardin.webp',
  'adhesivos-y-sellantes': '/images/barraca/categorias/fotos/adhesivos-y-sellantes.webp',
  'cerraduras': '/images/barraca/categorias/fotos/cerraduras.webp',
  'quincalleria': '/images/barraca/categorias/fotos/quincalleria.webp',
  'cercos-y-mallas': '/images/barraca/categorias/fotos/cercos-y-mallas.webp',
  'aridos-y-morteros': '/images/barraca/categorias/fotos/aridos-y-morteros.webp',
  'tabiqueria': '/images/barraca/categorias/fotos/tabiqueria.webp',
  'techumbre': '/images/barraca/categorias/fotos/techumbre.webp',
  'aditivos-e-impermeabilizantes': '/images/barraca/categorias/fotos/aditivos-e-impermeabilizantes.webp',
  'aislacion': '/images/barraca/categorias/fotos/aislacion.webp',
};

function getCategoryImage(imagen: string | null, slug: string): string | null {
  if (imagen && imagen.startsWith('/images/barraca/')) return imagen;
  return categoryImages[slug] || imagen || null;
}

export const metadata: Metadata = {
  title:
    "Barraca de Fierros y Materiales · Curicó · JURMAQ",
  description:
    `Fierro estriado, perfiles, planchas, tubos, mallas Acma, pinturas y +1.600 productos en Barraca JURMAQ Curicó · Molina. Despacho a Teno, Romeral, Talca y toda la Región del Maule. ${PROMESA}.`,
  keywords: [
    // Brand + value prop
    "barraca jurmaq",
    "te mejoramos el precio",
    "comprar fierro en línea",
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
      `Barraca de Fierros JURMAQ · Molina · Despacho a Curicó y todo el Maule · ${PROMESA_CORTA_META}`,
    description:
      `+1.600 productos: fierros, perfiles, planchas, tubos, mallas, pinturas. Despacho a toda la Región del Maule. ${PROMESA}.`,
    url: "https://barraca.jurmaq.cl",
    siteName: "Barraca JURMAQ",
    locale: "es_CL",
    type: "website",
    images: [
      {
        url: "/og-image-barraca-1200x630.png",
        width: 1200,
        height: 630,
        alt: "Barraca de Fierros JURMAQ — Curicó, Molina y Región del Maule",
      },
      {
        url: "/icon-512.png",
        width: 512,
        height: 512,
        alt: "Barraca JURMAQ",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Barraca JURMAQ · Fierros y Materiales en Molina · Despacho a Curicó y el Maule",
    description:
      `${PROMESA}. Despacho a toda la Región del Maule.`,
  },
  // Sin bloque `icons:` ni `manifest:` a propósito.
  //
  // En Next el campo `icons` NO se fusiona con el del layout: la página lo
  // REEMPLAZA entero. Estas cuatro declaraban un subconjunto (y apuntando a
  // /barraca/*, resto del monolito viejo), así que /categorias servía 3
  // <link rel=icon> contra los 6 del resto del sitio. Heredando del layout
  // hay una sola fuente de verdad.
  alternates: {
    canonical: "https://barraca.jurmaq.cl",
  },
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

// Atajos de la portada en celular: lo que más se busca en una barraca.
const ATAJOS = [
  { label: "Fierro estriado", q: "fierro estriado" },
  { label: "Perfiles", q: "perfil" },
  { label: "Zinc", q: "zinc" },
  { label: "Cemento", q: "cemento" },
  { label: "Planchas", q: "plancha" },
  { label: "Tubos", q: "tubo" },
  { label: "Malla", q: "malla" },
];

export default async function BarracaHomePage() {
  // Fetch ALL parent categories, then sort by product count (most popular first)
  const { data: rawCategorias } = await supabasePublic
    .from('barraca_categorias')
    .select('id, nombre, slug, imagen')
    .eq('activa', true)
    .is('padre_id', null);

  // Conteo por categoría, contado en el servidor.
  //
  // Traer las filas y contarlas en JS chocaba con el tope de 1.000 de PostgREST
  // (hay 1.978 productos activos). Acá el daño era doble: además de mostrar un
  // número falso, la portada ORDENA por este conteo para elegir qué 6
  // categorías destacar — con el conteo truncado elegía las 6 equivocadas.
  const allCatIds = (rawCategorias || []).map((c) => c.id);
  const productCounts: Record<number, number> = {};
  if (allCatIds.length > 0) {
    const counts = await Promise.all(
      allCatIds.map(async (id: number) => {
        const { count } = await supabasePublic
          .from('barraca_productos')
          .select('id', { count: 'exact', head: true })
          .eq('activo', true)
          .eq('categoria_id', id);
        return [id, count || 0] as const;
      }),
    );
    for (const [id, n] of counts) productCounts[id] = n;
  }
  // Sort by product count descending (most popular first), take top 6
  const categorias: Categoria[] = (rawCategorias || [])
    .map((c) => ({ ...c, product_count: productCounts[c.id] || 0 }))
    .sort((a: Categoria, b: Categoria) => b.product_count - a.product_count)
    .slice(0, 6);

  // Precios mínimos REALES para el banner de portada. Se consultan acá y no
  // se escriben en el slider, para que "desde $3.990" nunca sea una cifra que
  // la base ya no tiene.
  async function precioMinimo(patron: string): Promise<number | null> {
    const { data } = await supabasePublic
      .from('barraca_productos')
      .select('precio')
      .eq('activo', true)
      .gt('stock', 0)
      .gt('precio', 0)
      .ilike('nombre', patron)
      .order('precio', { ascending: true })
      .limit(1)
      .maybeSingle();
    return data?.precio ?? null;
  }
  const [precioFierro, precioTubo] = await Promise.all([
    precioMinimo('Fierro Estriado%'),
    precioMinimo('Tub %'),
  ]);

  // Filas de la portada: UNA variante por familia y sin repetir entre filas.
  // El 47% del catálogo son variantes de medida; ordenando por nombre o por
  // id salían cinco "Angulo Doblado Negro" seguidos y ocho "Zincalum"
  // seguidos, y la portada parecía tener cuatro productos. Se traen más de la
  // cuenta y se filtra por familia (src/lib/variantes.ts).
  const SELECT_TARJETA = 'id, codigo, nombre, slug, precio, precio_original, en_oferta, solo_cotizar, stock, unidad, imagen, medida, categoria_id';
  const POR_FILA = 10;
  function unaPorFamilia<T extends { id: number; nombre: string } & ProductoConPrecio>(lista: T[], n: number, excluir: Set<string>): T[] {
    const out: T[] = [];
    if (n <= 0) return out; // con n=0 el bucle devolvía 1: la fila salía con 11
    for (const p of lista) {
      // La portada sólo muestra lo que se puede comprar hoy.
      if (!vistaPrecio(p).disponible) continue;
      const fam = familiaDe(p.nombre) || p.nombre.toLowerCase();
      if (excluir.has(fam)) continue;
      excluir.add(fam);
      out.push(p);
      if (out.length >= n) break;
    }
    return out;
  }
  const { data: destacadosRaw } = await supabasePublic
    .from('barraca_productos')
    .select(SELECT_TARJETA)
    .eq('activo', true)
    .gt('stock', 0)
    .eq('destacado', true)
    .order('stock', { ascending: false })
    .limit(60);
  const { data: masStockRaw } = await supabasePublic
    .from('barraca_productos')
    .select(SELECT_TARJETA)
    .eq('activo', true)
    .gt('stock', 0)
    .not('imagen', 'is', null)
    .order('stock', { ascending: false })
    .limit(80);
  const { data: nuevosRaw } = await supabasePublic
    .from('barraca_productos')
    .select(SELECT_TARJETA)
    .eq('activo', true)
    .gt('stock', 0)
    .not('imagen', 'is', null)
    .order('id', { ascending: false })
    .limit(80);
  const familiasUsadas = new Set<string>();
  // "Los más vendidos": los marcados como destacados y, si no alcanzan, los
  // de más stock (lo que más se repone es lo que más sale).
  const destacadosBase = unaPorFamilia(destacadosRaw || [], POR_FILA, familiasUsadas);
  const relleno = unaPorFamilia(masStockRaw || [], POR_FILA - destacadosBase.length, familiasUsadas);
  const destacados = await applyDailyPromosToProducts([...destacadosBase, ...relleno]);
  const nuevos = await applyDailyPromosToProducts(unaPorFamilia(nuevosRaw || [], POR_FILA, familiasUsadas));

  // Build category ID -> slug lookup for product images
  const allProductCatIds = [
    ...new Set([
      ...destacados.map((p) => p.categoria_id),
      ...nuevos.map((p) => p.categoria_id),
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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Inicio", item: "https://jurmaq.cl" },
              { "@type": "ListItem", position: 2, name: "Barraca de Fierros", item: "https://barraca.jurmaq.cl" },
            ],
          }),
        }}
      />
      {/* Hero — MobileHero (lg:hidden) replaces the slider on small screens
          so the user sees products faster. Desktop keeps the full slider.
          El H1 vive dentro de MobileHero en mobile y abajo en desktop. */}
      <MobileHero />
      <div className="hidden lg:block">
        <HeroSlider precios={{ fierro: precioFierro, tubo: precioTubo }} />
      </div>

      {/* Franja de confianza, como la que va bajo el banner en Sodimac y Easy:
          cuatro hechos concretos, con ícono, sobre blanco. Reemplaza la prosa
          con cifras en serif itálica y la banda roja de despacho. El H1 se
          conserva para SEO pero deja de ser un titular de revista. */}
      <section aria-label="Por qué comprar en JURMAQ" className="hidden lg:block bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ul className="grid grid-cols-3 divide-x divide-gray-200">
            {[
              { t: 'Despacho a todo el Maule', d: 'Curicó, Talca, Linares, Molina y más', href: '/sucursales', icon: 'M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0' },
              { t: 'Retiro en Molina', d: 'Av. Poniente 2157 · Lun–Sáb', href: '/sucursales', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z' },
              { t: 'Compra en línea, sin registro', d: 'Mercado Pago o transferencia', href: '/categorias', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z' },
            ].map((it) => (
              <li key={it.t}>
                <Link href={it.href} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <svg className="w-6 h-6 text-marca-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d={it.icon} />
                  </svg>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-bold text-navy-950 leading-tight">{it.t}</span>
                    <span className="block text-xs text-gray-500 leading-tight mt-0.5">{it.d}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <h1 className="sr-only">Barraca de fierros y materiales de construcción en Molina, con despacho a Curicó y todo el Maule</h1>

      {/* === OFERTAS DEL DIA === */}
      {dailyPromo && promotedProducts.length > 0 && (
        <section className="py-12 lg:py-16 bg-gray-50 border-t border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Promo banner bar — Editorial hairline */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-10 border border-[#EAEAEA] bg-white rounded-2xl px-6 py-5">
              <div className="flex items-center gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em]">
                      Ofertas del día
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 border border-[#EAEAEA] text-[#111111] text-[11px] font-medium tabular-nums rounded-full">
                      −{dailyPromo.descuento_porcentaje}%
                    </span>
                  </div>
                  <h2
                    className="text-[#111111] tracking-tight"
                    style={{ fontSize: 'clamp(1.25rem, 2vw, 1.625rem)', fontWeight: 500 }}
                  >
                    {dailyPromo.titulo}
                  </h2>
                  {dailyPromo.descripcion && (
                    <p className="text-[#787774] text-sm mt-1 leading-relaxed">
                      {dailyPromo.descripcion}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em]">
                  Termina en
                </span>
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
                  codigo={product.codigo}
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

      {/* === Celular: atajos + categorías en riel deslizable ===
          Antes era una grilla 4+2 de miniaturas de 64 px con el nombre en
          mayúscula cortado ("ELECTRICIDAD E…"). Ahora: una fila de atajos a lo
          que más se busca y las categorías como tarjetas con foto que se
          deslizan con el dedo, como en las apps de las tiendas grandes. */}
      <section id="categorias-mobile" className="lg:hidden fondo-acero pt-4 pb-6 scroll-mt-24">
        <nav aria-label="Lo más buscado" className="px-4 mb-5">
          <ul className="flex gap-2 overflow-x-auto riel -mx-4 px-4">
            {ATAJOS.map((a) => (
              <li key={a.q} className="shrink-0">
                <Link
                  href={`/buscar?q=${encodeURIComponent(a.q)}`}
                  className="inline-flex items-center h-9 px-3.5 rounded-full bg-white border border-gray-200 text-[13px] font-medium text-navy-950 active:bg-gray-100"
                >
                  {a.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-end justify-between mb-3 px-4">
          <h2 className="text-lg font-extrabold text-navy-950 leading-none">Categorías</h2>
          <Link href="/categorias" className="text-sm font-semibold text-marca-600 min-h-[32px] inline-flex items-center">
            Ver todas
          </Link>
        </div>
        <Revelar>
          <ul className="flex gap-3 overflow-x-auto riel snap-x snap-mandatory px-4 scroll-px-4 pb-1">
            {categorias.map((cat) => {
              const catImg = getCategoryImage(cat.imagen, cat.slug);
              return (
                <li key={cat.id} data-revelar className="snap-start shrink-0 w-[124px]">
                  <Link
                    href={`/categorias/${cat.slug}`}
                    className="block bg-white rounded-xl overflow-hidden border border-gray-200/80 active:scale-[0.97] transition-transform"
                  >
                    <div className="aspect-[4/3] bg-gray-100 overflow-hidden">
                      {catImg ? (
                        <Image src={catImg} alt="" width={248} height={186} sizes="124px" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-100" />
                      )}
                    </div>
                    <p className="px-2.5 py-2 text-[13px] font-semibold text-navy-950 leading-tight line-clamp-2 min-h-[2.75rem]">
                      {titleCase(cat.nombre)}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Revelar>
      </section>

      {/* === Categories: DESKTOP === full grid with overlay text */}
      <section id="categorias" className="hidden lg:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 scroll-mt-24 content-auto">
        <div className="mb-10">
          <h2 className="text-2xl font-extrabold text-navy-950 mb-1">Compra por categoría</h2>
          <p className="text-gray-500">Fierro, perfiles, planchas, herramientas y más. Todo con stock y precio visible.</p>
        </div>
        {/* Mosaico de categorías al modo retail: tarjeta blanca, la foto con
            aire (sin sangrar, sin degradado negro encima), el nombre debajo en
            negrita y el conteo en gris. Es la tarjeta de categoría de Sodimac
            y Easy, que es lo que el dueño pidió parecerse. */}
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-4">
          {categorias.map((cat) => {
            const catImg = getCategoryImage(cat.imagen, cat.slug);
            return (
              <Link key={cat.id} href={`/categorias/${cat.slug}`} className="group block bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-navy-950 transition-colors">
                {/* Foto a sangre (560 px, recortada al cuadrado). Antes era el
                    packshot de un producto suelto sobre blanco —un tarro de
                    cloro para Jardín, un enchufe para Electricidad— y el dueño
                    lo vio "pobre y feo". */}
                <div className="aspect-square bg-gray-100 overflow-hidden">
                  {catImg ? (
                    <Image src={catImg} alt={`${cat.nombre} - JURMAQ Barraca`} loading="lazy" width={560} height={560} sizes="(max-width: 1024px) 33vw, 16vw" className="w-full h-full object-cover transition-transform duration-300 ease-out [@media(hover:hover)]:group-hover:scale-[1.04]" />
                  ) : (
                    <div className="w-full h-full bg-gray-50" />
                  )}
                </div>
                <div className="px-3 pt-2.5 pb-3 text-center">
                  <h3 className="text-[13px] font-bold text-navy-950 leading-tight group-hover:text-marca-600 transition-colors">{titleCase(cat.nombre)}</h3>
                  <p className="text-[11px] text-gray-500 mt-0.5 tabular-nums">{cat.product_count} productos</p>
                </div>
              </Link>
            );
          })}
        </div>
        <div className="text-center mt-8">
          <Link href="/categorias" className="inline-flex items-center gap-2 px-6 py-3 border-2 border-marca-600 text-marca-600 hover:bg-marca-600 hover:text-white font-semibold rounded-lg transition-colors">
            Ver todas las categorias
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Featured Products */}
      {(destacados || []).length > 0 && (
        <section id="destacados" className="bg-white pt-6 pb-8 lg:py-16 scroll-mt-24 content-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-3 lg:mb-10">
              <h2 className="text-lg lg:text-2xl font-extrabold text-navy-950 leading-none">
                Los más vendidos
              </h2>
              <Link href="/categorias" className="text-sm font-semibold text-marca-600 hover:text-marca-700 transition-colors lg:inline-flex lg:items-center lg:gap-1">
                Ver todos
                <svg className="hidden lg:inline w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </Link>
            </div>
            <Revelar className="flex gap-3 overflow-x-auto riel snap-x snap-mandatory -mx-4 px-4 scroll-px-4 pb-2 md:grid md:grid-cols-3 lg:grid-cols-5 md:gap-4 md:mx-0 md:px-0 md:overflow-visible md:pb-0">
              {destacados.map((p) => (
                <div key={p.id} data-revelar className="snap-start shrink-0 w-[46vw] max-w-[200px] md:w-auto md:max-w-none"><ProductCard id={p.id} nombre={p.nombre} codigo={p.codigo} slug={p.slug} precio={p.precio} precio_original={p.precio_original} en_oferta={p.en_oferta} solo_cotizar={p.solo_cotizar} imagen={p.imagen} stock={p.stock} unidad={p.unidad} medida={p.medida} categoriaSlug={p.categoria_id != null ? (catSlugMap[p.categoria_id] || '') : ''} /></div>
              ))}
            </Revelar>
          </div>
        </section>
      )}

      {/* Franja marina: cómo se retira, despacha y paga. */}
      <MobileTrustStrip />

      {/* New Products */}
      {(nuevos || []).length > 0 && (
        <section id="nuevos" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-16 scroll-mt-24 content-auto">
          <div className="flex items-center justify-between mb-3 lg:mb-10">
            <div>
              <h2 className="text-lg lg:text-2xl font-extrabold text-navy-950 leading-none">Recién llegados</h2>
            </div>
            <Link href="/categorias" className="inline-flex items-center gap-1 text-sm font-semibold text-marca-600 hover:text-marca-700 transition-colors">
              Ver todos
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
          </div>
          <Revelar className="flex gap-3 overflow-x-auto riel snap-x snap-mandatory -mx-4 px-4 scroll-px-4 pb-2 md:grid md:grid-cols-3 lg:grid-cols-5 md:gap-4 md:mx-0 md:px-0 md:overflow-visible md:pb-0">
            {nuevos.map((p) => (
              <div key={p.id} data-revelar className="snap-start shrink-0 w-[46vw] max-w-[200px] md:w-auto md:max-w-none"><ProductCard id={p.id} nombre={p.nombre} codigo={p.codigo} slug={p.slug} precio={p.precio} precio_original={p.precio_original} en_oferta={p.en_oferta} solo_cotizar={p.solo_cotizar} imagen={p.imagen} stock={p.stock} unidad={p.unidad} medida={p.medida} isNew categoriaSlug={p.categoria_id != null ? (catSlugMap[p.categoria_id] || '') : ''} /></div>
            ))}
          </Revelar>
        </section>
      )}

      {/* Marcas. El fondo alterna con la sección de arriba: "Recién llegados"
          va sobre el gris de la página, así que acá blanco; si no hay
          recién llegados, arriba queda "Más vendidos" (blanco) y acá gris. */}
      <section className={`${(nuevos || []).length > 0 ? 'bg-white' : 'bg-gray-50'} border-t border-b border-gray-200 py-14 lg:py-20 content-auto`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-extrabold text-navy-950">Marcas que trabajamos</h2>
          </div>
          {/* Carrusel continuo de los fabricantes con los que trabaja la barraca.
              Los nueve llevan su logo oficial; CAP e Inchalam vienen de los
              archivos que mandó el dueño (azul sobre transparente, recortados a
              120 px de alto). Prodac salió de la lista a pedido del dueño. */}
          <MarcasCarrusel
            marcas={[
              { nombre: "CAP Acero", logo: "/images/barraca/marcas/cap.png" },
              { nombre: "Cintac", logo: "/images/barraca/marcas/cintac.jpg" },
              { nombre: "Inchalam", logo: "/images/barraca/marcas/inchalam.png" },
              { nombre: "Ternium", logo: "/images/barraca/marcas/ternium.svg" },
              { nombre: "Volcán", logo: "/images/barraca/marcas/volcan.svg" },
              { nombre: "Polpaico", logo: "/images/barraca/marcas/polpaico.png" },
              { nombre: "Melón", logo: "/images/barraca/marcas/melon.png" },
              { nombre: "CBB Cementos", logo: "/images/barraca/marcas/cbb.png" },
              { nombre: "Sherwin Williams", logo: "/images/barraca/marcas/sherwin.svg" },
            ]}
          />
        </div>
      </section>

    </>
  );
}
