import type { Metadata } from "next";
import Link from "@/components/barraca/Enlace";
import Image from "next/image";
import { supabasePublic } from "@jurmaq/shared/supabase";
import type { Database } from "@jurmaq/shared/db-types";
import ProductCard from "@/components/barraca/ProductCard";
import { conCombos } from "@/lib/combos-servidor";
import HeroSlider from "@/components/barraca/HeroSlider";
import MarcasCarrusel from "@/components/barraca/MarcasCarrusel";
import PromotedProductCard from "@/components/barraca/PromotedProductCard";
import { applyDailyPromosToProducts, getDailyPromotions, getPromotedProducts } from "@/lib/promotions";
import { titleCase } from "@jurmaq/shared/format";
import type { ProductoPromocionado } from "@/lib/promotions";
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';
import { familiaDe } from '@/lib/variantes';
import masVendidos from '@/data/mas-vendidos.json';
import { vistaPrecio, type ProductoConPrecio } from '@/lib/precio-web';
import { ZONAS_DESPACHO } from '@/lib/despacho/zonas';

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
    `Fierro estriado, perfiles, planchas, tubos, mallas Acma, pinturas y +1.600 productos en Barraca JURMAQ Curicó · Molina. Retiro en Molina y despacho en camión a Molina, Curicó, Talca y alrededores.`,
  keywords: [
    // Brand + value prop
    "barraca jurmaq",
    "comprar fierro en línea",
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
    // Localidades servidas (solo las de ZONAS_DESPACHO)
    ...ZONAS_DESPACHO.map((z) => z.nombre),
  ],
  openGraph: {
    title:
      "Barraca de Fierros JURMAQ · Molina · Despacho a Curicó, Talca y alrededores",
    description:
      "+1.600 productos: fierros, perfiles, planchas, tubos, mallas, pinturas. Retiro en Molina y despacho en camión a Molina, Curicó, Talca y alrededores.",
    url: "https://barraca.jurmaq.cl",
    siteName: "Barraca JURMAQ",
    locale: "es_CL",
    type: "website",
    images: [
      {
        url: "/og-image-barraca-1200x630.png",
        width: 1200,
        height: 630,
        alt: "Barraca de Fierros JURMAQ — Molina, Curicó y Talca",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Barraca JURMAQ · Fierros y Materiales en Molina · Despacho a Curicó y Talca",
    description:
      "Retiro en Molina y despacho en camión a Molina, Curicó, Talca y alrededores.",
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
  // Por cantidad de productos; 10 llenan la fila de círculos en escritorio.
  const categorias: Categoria[] = (rawCategorias || [])
    .map((c) => ({ ...c, product_count: productCounts[c.id] || 0 }))
    .sort((a: Categoria, b: Categoria) => b.product_count - a.product_count)
    .slice(0, 10);

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
  // Segunda fila: fierro y perfiles (lo "duro" de la barraca), no lo último
  // que entró: así salía una tuerca. Categorías madre + sus subcategorías.
  const { data: catsDuras } = await supabasePublic
    .from('barraca_categorias')
    .select('id, slug, padre_id');
  const madresDuras = new Set(
    (catsDuras || []).filter((c) => ['fierros-construccion', 'perfiles-y-planchas', 'techumbre'].includes(c.slug)).map((c) => c.id),
  );
  const idsDuras = (catsDuras || []).filter((c) => madresDuras.has(c.id) || (c.padre_id != null && madresDuras.has(c.padre_id))).map((c) => c.id);
  const { data: nuevosRaw } = await supabasePublic
    .from('barraca_productos')
    .select(SELECT_TARJETA)
    .eq('activo', true)
    .gt('stock', 0)
    .not('imagen', 'is', null)
    .in('categoria_id', idsDuras.length ? idsDuras : [-1])
    .order('stock', { ascending: false })
    .limit(120);
  const familiasUsadas = new Set<string>();
  // "Los más vendidos": el ranking real de ventas del mes en pesos (columna
  // "Venta mes" de la planilla de precios, ver src/data/mas-vendidos.json),
  // una medida por familia. Si no alcanzan, los destacados y los de más stock.
  const ranking: string[] = masVendidos.codigos;
  const { data: vendidosRaw } = await supabasePublic
    .from('barraca_productos')
    .select(SELECT_TARJETA)
    .eq('activo', true)
    .in('codigo', ranking);
  const posicion = new Map(ranking.map((c, i) => [c, i]));
  const vendidosOrden = (vendidosRaw || []).sort(
    (a, b) => (posicion.get(String(a.codigo)) ?? 999) - (posicion.get(String(b.codigo)) ?? 999),
  );
  const vendidos = unaPorFamilia(vendidosOrden, POR_FILA, familiasUsadas);
  const destacadosBase = [...vendidos, ...unaPorFamilia(destacadosRaw || [], POR_FILA - vendidos.length, familiasUsadas)];
  const relleno = unaPorFamilia(masStockRaw || [], POR_FILA - destacadosBase.length, familiasUsadas);
  const destacados = await conCombos(await applyDailyPromosToProducts([...destacadosBase, ...relleno]));
  const nuevos = await conCombos(await applyDailyPromosToProducts(unaPorFamilia(nuevosRaw || [], POR_FILA, familiasUsadas)));

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
              // Sólo la barraca: la constructora (jurmaq.cl) es otro negocio.
              { "@type": "ListItem", position: 1, name: "Barraca de Fierros JURMAQ", item: "https://barraca.jurmaq.cl" },
            ],
          }),
        }}
      />
      {/* Carrusel con fotos reales del local, igual en celular y escritorio. */}
      <HeroSlider precios={{ fierro: precioFierro, tubo: precioTubo }} />

      <h1 className="sr-only">Barraca de fierros y materiales de construcción en Molina, con despacho a Curicó, Talca y alrededores</h1>

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

      {/* Categorías: círculos con foto en una fila que se desliza (elegido por
          el dueño, oct-2026: ocupa poco y no abruma). En escritorio caben todas
          en la fila. */}
      <section id="categorias" aria-labelledby="titulo-categorias" className="bg-white pt-6 pb-2 lg:pt-10 scroll-mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-3">
            <h2 id="titulo-categorias" className="text-lg lg:text-2xl font-bold text-navy-950 leading-none">Categorías</h2>
            <Link href="/categorias" className="text-sm font-semibold text-marca-600 hover:text-marca-700 min-h-[32px] inline-flex items-center">
              Ver todas
            </Link>
          </div>
          <ul className="riel flex gap-4 lg:gap-0 lg:justify-between overflow-x-auto snap-x -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 pb-3">
            {categorias.map((cat) => {
              const catImg = getCategoryImage(cat.imagen, cat.slug);
              return (
                <li key={cat.id} className="snap-start shrink-0 w-[76px] lg:w-[112px]">
                  <Link href={`/categorias/${cat.slug}`} className="group block text-center">
                    <span className="block mx-auto w-[76px] h-[76px] lg:w-[104px] lg:h-[104px] rounded-full overflow-hidden bg-gray-100 ring-1 ring-gray-200 group-hover:ring-2 group-hover:ring-marca-600 transition-[box-shadow] duration-150">
                      {catImg ? (
                        <Image src={catImg} alt="" width={192} height={192} sizes="96px" className="w-full h-full object-cover" />
                      ) : null}
                    </span>
                    <span className="mt-2 block text-xs lg:text-[13px] font-medium text-navy-950 leading-tight line-clamp-2">
                      {titleCase(cat.nombre)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
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
            <div className="flex gap-3 overflow-x-auto riel snap-x snap-mandatory -mx-4 px-4 scroll-px-4 pb-2 md:grid md:grid-cols-3 lg:grid-cols-5 md:gap-4 md:mx-0 md:px-0 md:overflow-visible md:pb-0">
              {destacados.map((p) => (
                <div key={p.id} className="snap-start shrink-0 w-[46vw] max-w-[200px] md:w-auto md:max-w-none"><ProductCard id={p.id} nombre={p.nombre} codigo={p.codigo} slug={p.slug} precio={p.precio} precio_original={p.precio_original} en_oferta={p.en_oferta} solo_cotizar={p.solo_cotizar} imagen={p.imagen} stock={p.stock} unidad={p.unidad} medida={p.medida} combo={p.combo} categoriaSlug={p.categoria_id != null ? (catSlugMap[p.categoria_id] || '') : ''} /></div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* New Products */}
      {(nuevos || []).length > 0 && (
        <section id="nuevos" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-16 scroll-mt-24 content-auto">
          <div className="flex items-center justify-between mb-3 lg:mb-10">
            <div>
              <h2 className="text-lg lg:text-2xl font-extrabold text-navy-950 leading-none">Fierro, perfiles y techumbre</h2>
            </div>
            <Link href="/categorias/fierros-construccion" className="inline-flex items-center gap-1 text-sm font-semibold text-marca-600 hover:text-marca-700 transition-colors">
              Ver todos
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto riel snap-x snap-mandatory -mx-4 px-4 scroll-px-4 pb-2 md:grid md:grid-cols-3 lg:grid-cols-5 md:gap-4 md:mx-0 md:px-0 md:overflow-visible md:pb-0">
            {nuevos.map((p) => (
              <div key={p.id} className="snap-start shrink-0 w-[46vw] max-w-[200px] md:w-auto md:max-w-none"><ProductCard id={p.id} nombre={p.nombre} codigo={p.codigo} slug={p.slug} precio={p.precio} precio_original={p.precio_original} en_oferta={p.en_oferta} solo_cotizar={p.solo_cotizar} imagen={p.imagen} stock={p.stock} unidad={p.unidad} medida={p.medida} combo={p.combo} categoriaSlug={p.categoria_id != null ? (catSlugMap[p.categoria_id] || '') : ''} /></div>
            ))}
          </div>
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
