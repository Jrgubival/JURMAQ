import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabasePublic } from "@jurmaq/shared/supabase";
import { CIUDADES, DISTANCIAS_BARRACA, HQ } from "@jurmaq/shared/seo";
import ProductCard from "@/components/barraca/ProductCard";
import { applyDailyPromosToProducts } from "@/lib/promotions";

/**
 * Programmatic SEO landing for `[categoría] en [ciudad]` queries.
 *
 * URL pattern: /categorias/<categoria-slug>/en/<ciudad-slug>
 *   e.g. /categorias/fierros-construccion/en/talca
 *        /categorias/pinturas/en/curico
 *
 * Complementa los landings existentes:
 *  - /categorias/[slug]            → categoría sola (sin ciudad)
 *  - /en/[ciudad]                  → ciudad sola (todos los materiales)
 *  - /material/[slug]-en-[ciudad]  → 8 materiales TOP × 12 ciudades = 96 URLs
 *
 * Este patrón completa la cobertura para queries "{categoria} {ciudad}"
 * sobre TODAS las categorías activas con stock (~20 cat × 12 ciudades).
 *
 * Anti-doorway-page: cada landing inyecta lista REAL de productos desde DB,
 * distancia/tiempo de despacho concreto desde DISTANCIAS_BARRACA y un
 * párrafo de contexto local (rubro económico de la ciudad) tejido con la
 * categoría — contenido único por (categoría, ciudad).
 */

interface CategoriaRow {
  id: number;
  nombre: string;
  slug: string;
  padre_id: number | null;
}

interface ProductoRow {
  id: number;
  codigo: string | null;
  nombre: string;
  slug: string;
  precio: number;
  precio_original: number | null;
  en_oferta: boolean | null;
  solo_cotizar: boolean | null;
  stock: number | null;
  unidad: string | null;
  imagen: string | null;
  medida: string | null;
  categoria_id: number | null;
}

/**
 * Devuelve el set de `categoria_id` que son elegibles para tener landing
 * por ciudad — es decir, que tienen al menos 1 producto activo propio o
 * heredado desde una subcategoría. Sin este filtro, una categoría padre
 * "vacía" generaría una doorway page con el catálogo vacío.
 */
async function getEligibleCategoriaIds(): Promise<Set<number>> {
  const [{ data: allCats }, { data: products }] = await Promise.all([
    supabasePublic
      .from("barraca_categorias")
      .select("id, padre_id")
      .eq("activa", true),
    supabasePublic
      .from("barraca_productos")
      .select("categoria_id")
      .eq("activo", true),
  ]);

  const directHasProducts = new Set<number>();
  for (const p of products || []) {
    if (p.categoria_id != null) directHasProducts.add(p.categoria_id);
  }

  // Cascade: si una subcategoría tiene productos, el padre es elegible.
  const eligible = new Set<number>(directHasProducts);
  for (const cat of allCats || []) {
    if (cat.padre_id != null && directHasProducts.has(cat.id)) {
      eligible.add(cat.padre_id);
    }
  }

  return eligible;
}

export async function generateStaticParams() {
  const { data: categorias } = await supabasePublic
    .from("barraca_categorias")
    .select("id, slug")
    .eq("activa", true);
  const eligible = await getEligibleCategoriaIds();
  const params: { slug: string; ciudad: string }[] = [];
  for (const cat of categorias || []) {
    if (!eligible.has(cat.id)) continue;
    for (const c of CIUDADES) {
      params.push({ slug: cat.slug, ciudad: c.slug });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; ciudad: string }>;
}): Promise<Metadata> {
  const { slug, ciudad } = await params;
  const c = CIUDADES.find((x) => x.slug === ciudad);
  if (!c) return { title: "Página no encontrada" };

  const { data: cat } = await supabasePublic
    .from("barraca_categorias")
    .select("nombre, slug")
    .eq("slug", slug)
    .eq("activa", true)
    .single();
  if (!cat) return { title: "Categoría no encontrada" };

  const lower = cat.nombre.toLowerCase();
  const distancia = DISTANCIAS_BARRACA[c.slug];

  return {
    title: `${cat.nombre} en ${c.nombre} · Barraca JURMAQ`,
    description: `${cat.nombre} con despacho a ${c.nombre} y comunas vecinas (${distancia.tiempo} desde Molina). Stock continuo, precio publicado y garantía "te mejoramos el precio" frente a Sodimac, Easy o Construmart en menos de 2 horas.`,
    keywords: [
      `${lower} ${c.nombre}`,
      `${lower} precio ${c.nombre}`,
      `comprar ${lower} ${c.nombre}`,
      `${lower} despacho ${c.nombre}`,
      `${lower} ${c.region}`,
      ...c.comunasVecinas.map((cv) => `${lower} ${cv}`),
      `barraca ${c.nombre}`,
      `materiales construcción ${c.nombre}`,
      "te mejoramos el precio",
      "súbenos tu cotización",
      "barraca JURMAQ",
    ],
    openGraph: {
      title: `${cat.nombre} en ${c.nombre} · Barraca JURMAQ`,
      description: `${cat.nombre} con despacho a ${c.nombre} en ${distancia.tiempo}. Te mejoramos el precio de la competencia en menos de 2 horas.`,
      url: `https://barraca.jurmaq.cl/categorias/${cat.slug}/en/${c.slug}`,
      siteName: "Barraca JURMAQ",
      locale: "es_CL",
      type: "website",
      images: [
        {
          url: "/barraca/icon-512.png",
          width: 512,
          height: 512,
          alt: `${cat.nombre} en ${c.nombre}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${cat.nombre} en ${c.nombre} · Barraca JURMAQ`,
      description: `Despacho a ${c.nombre} en ${distancia.tiempo} · Te mejoramos el precio en 2h.`,
    },
    icons: {
      icon: [
        { url: "/barraca/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "/barraca/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: { url: "/barraca/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    },
    alternates: {
      canonical: `https://barraca.jurmaq.cl/categorias/${cat.slug}/en/${c.slug}`,
    },
    manifest: "/barraca/manifest.json",
  };
}

const PRODUCTOS_LIMIT = 12;

export default async function CategoriaEnCiudadPage({
  params,
}: {
  params: Promise<{ slug: string; ciudad: string }>;
}) {
  const { slug, ciudad } = await params;
  const c = CIUDADES.find((x) => x.slug === ciudad);
  if (!c) notFound();

  const { data: categoriaRaw } = await supabasePublic
    .from("barraca_categorias")
    .select("id, nombre, slug, padre_id")
    .eq("slug", slug)
    .eq("activa", true)
    .single();
  if (!categoriaRaw) notFound();
  const categoria = categoriaRaw as CategoriaRow;

  // Subcategorías activas — para incluir sus productos en el grid.
  const { data: subCats } = await supabasePublic
    .from("barraca_categorias")
    .select("id, nombre, slug")
    .eq("padre_id", categoria.id)
    .eq("activa", true)
    .order("nombre");
  const allCatIds = [categoria.id, ...(subCats || []).map((s) => s.id)];

  // Productos: stock primero, después por nombre. Limit 12 (top selección).
  const { data: productosRaw } = await supabasePublic
    .from("barraca_productos")
    .select(
      "id, codigo, nombre, slug, precio, precio_original, en_oferta, solo_cotizar, stock, unidad, imagen, medida, categoria_id"
    )
    .eq("activo", true)
    .in("categoria_id", allCatIds)
    .order("stock", { ascending: false })
    .order("nombre", { ascending: true })
    .limit(PRODUCTOS_LIMIT);

  // Defensive: si generateStaticParams dejó pasar un cat sin productos,
  // 404 antes que renderizar una landing vacía (doorway page).
  if (!productosRaw || productosRaw.length === 0) notFound();

  const productos = (await applyDailyPromosToProducts(
    productosRaw as ProductoRow[]
  )) as ProductoRow[];

  // Total de productos en la categoría (para H2 + AggregateOffer).
  const { count: totalCount } = await supabasePublic
    .from("barraca_productos")
    .select("*", { count: "exact", head: true })
    .eq("activo", true)
    .in("categoria_id", allCatIds);
  const total = totalCount || productos.length;

  // Categoría padre para breadcrumb si aplica.
  let parentCat: { nombre: string; slug: string } | null = null;
  if (categoria.padre_id) {
    const { data: parent } = await supabasePublic
      .from("barraca_categorias")
      .select("nombre, slug")
      .eq("id", categoria.padre_id)
      .single();
    parentCat = parent;
  }

  // Cross-link: otras categorías raíz para variar el contenido en la misma ciudad.
  // Filtramos en TS la categoría actual (si es root) y la padre (si soy subcategoría,
  // ya tiene chip en breadcrumb).
  const { data: siblingCatsRaw } = await supabasePublic
    .from("barraca_categorias")
    .select("id, nombre, slug")
    .eq("activa", true)
    .is("padre_id", null)
    .order("orden", { ascending: true })
    .limit(10);
  const siblingCats = (siblingCatsRaw || []).filter(
    (s) => s.slug !== categoria.slug && s.slug !== parentCat?.slug
  ).slice(0, 8);

  // Ciudades vecinas con landing propia — cluster SEO local.
  const vecinasConLanding = c.comunasVecinas
    .map((nombre) => CIUDADES.find((x) => x.nombre === nombre))
    .filter((x): x is NonNullable<typeof x> => !!x && x.slug !== c.slug);

  const distancia = DISTANCIAS_BARRACA[c.slug];
  const rubrosCortos = c.rubroLocal.slice(0, 2).join(" y ");

  // AggregateOffer — feeds Google's "desde $X" snippet en SERP.
  const pricedProducts = productos.filter(
    (p) => !p.solo_cotizar && p.precio > 0
  );
  const lowPrice =
    pricedProducts.length > 0
      ? pricedProducts.reduce((min, p) => {
          const eff = p.en_oferta && p.precio_original ? p.precio_original : p.precio;
          return eff < min ? eff : min;
        }, Number.MAX_SAFE_INTEGER)
      : 0;
  const highPrice =
    pricedProducts.length > 0
      ? pricedProducts.reduce((max, p) => {
          const eff = p.en_oferta && p.precio_original ? p.precio_original : p.precio;
          return eff > max ? eff : max;
        }, 0)
      : 0;

  const canonicalUrl = `https://barraca.jurmaq.cl/categorias/${categoria.slug}/en/${c.slug}`;

  const collectionPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${canonicalUrl}#collection`,
    name: `${categoria.nombre} en ${c.nombre} · Barraca JURMAQ`,
    description: `${categoria.nombre} con despacho a ${c.nombre} desde Molina (${distancia.km} km · ${distancia.tiempo}). Te mejoramos el precio de Sodimac, Easy o Construmart en menos de 2 horas.`,
    url: canonicalUrl,
    isPartOf: { "@id": "https://barraca.jurmaq.cl/#website" },
    about: { "@type": "Thing", name: categoria.nombre },
    spatialCoverage: {
      "@type": "City",
      name: c.nombre,
      containedInPlace: { "@type": "AdministrativeArea", name: c.region },
    },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: total,
      itemListElement: productos.map((p, i) => {
        const eff = p.en_oferta && p.precio_original ? p.precio_original : p.precio;
        return {
          "@type": "ListItem",
          position: i + 1,
          item: {
            "@type": "Product",
            name: p.nombre,
            url: `https://barraca.jurmaq.cl/producto/${p.slug}`,
            image: p.imagen || undefined,
            offers: {
              "@type": "Offer",
              price: eff,
              priceCurrency: "CLP",
              availability:
                (p.stock ?? 0) > 0
                  ? "https://schema.org/InStock"
                  : "https://schema.org/OutOfStock",
              seller: { "@id": "https://jurmaq.cl/#organization" },
              areaServed: {
                "@type": "City",
                name: c.nombre,
              },
            },
          },
        };
      }),
    },
  };

  const aggregateOfferJsonLd =
    pricedProducts.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "OfferCatalog",
          "@id": `${canonicalUrl}#catalog`,
          name: `${categoria.nombre} en ${c.nombre}`,
          url: canonicalUrl,
          provider: { "@id": "https://jurmaq.cl/#organization" },
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "CLP",
            lowPrice: lowPrice === Number.MAX_SAFE_INTEGER ? 0 : lowPrice,
            highPrice,
            offerCount: pricedProducts.length,
            availability: "https://schema.org/InStock",
            seller: { "@id": "https://jurmaq.cl/#organization" },
            areaServed: {
              "@type": "City",
              name: c.nombre,
              containedInPlace: { "@type": "AdministrativeArea", name: c.region },
            },
          },
        }
      : null;

  const breadcrumbItems: Array<{
    "@type": "ListItem";
    position: number;
    name: string;
    item: string;
  }> = [
    {
      "@type": "ListItem",
      position: 1,
      name: "Barraca JURMAQ",
      item: "https://barraca.jurmaq.cl",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Categorías",
      item: "https://barraca.jurmaq.cl/categorias",
    },
  ];
  if (parentCat) {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: 3,
      name: parentCat.nombre,
      item: `https://barraca.jurmaq.cl/categorias/${parentCat.slug}`,
    });
  }
  breadcrumbItems.push({
    "@type": "ListItem",
    position: parentCat ? 4 : 3,
    name: categoria.nombre,
    item: `https://barraca.jurmaq.cl/categorias/${categoria.slug}`,
  });
  breadcrumbItems.push({
    "@type": "ListItem",
    position: parentCat ? 5 : 4,
    name: c.nombre,
    item: canonicalUrl,
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageJsonLd) }}
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

      <article className="bg-white">
        {/* Hero */}
        <header className="bg-navy-950 text-white py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav aria-label="Breadcrumb" className="text-sm text-gray-500 mb-4 flex flex-wrap items-center gap-1">
              <Link href="/" className="hover:text-white">Barraca JURMAQ</Link>
              <span>›</span>
              <Link href="/categorias" className="hover:text-white">Categorías</Link>
              {parentCat && (
                <>
                  <span>›</span>
                  <Link
                    href={`/categorias/${parentCat.slug}`}
                    className="hover:text-white"
                  >
                    {parentCat.nombre}
                  </Link>
                </>
              )}
              <span>›</span>
              <Link
                href={`/categorias/${categoria.slug}`}
                className="hover:text-white"
              >
                {categoria.nombre}
              </Link>
              <span>›</span>
              <span className="text-white">{c.nombre}</span>
            </nav>
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 bg-orange-600 text-white text-xs font-bold uppercase tracking-wider rounded">
              <span>✓ Despacho a {c.nombre}</span>
              <span className="opacity-70">·</span>
              <span>{distancia.tiempo}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4">
              {categoria.nombre} en {c.nombre} · Barraca JURMAQ
            </h1>
            <p className="text-lg text-gray-200 max-w-3xl mb-2">
              <strong className="text-orange-400">Súbenos tu cotización de Sodimac, Easy o Construmart</strong>{" "}
              y en menos de 2 horas te mejoramos el precio en {categoria.nombre.toLowerCase()}.
              Despacho desde Molina a {c.nombre} en {distancia.tiempo} ({distancia.km} km).
            </p>
            <p className="text-gray-300 max-w-3xl mb-8">
              Atendemos {rubrosCortos} y otras obras del rubro {c.rubroLocal[c.rubroLocal.length - 1]} en {c.nombre}.
              {c.comunasVecinas.length > 0 ? ` También despachamos a ${c.comunasVecinas.join(", ")}.` : ""}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/te-mejoramos-el-precio"
                className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Sube tu cotización
              </Link>
              <a
                href={
                  HQ.whatsapp +
                  `?text=Hola%2C%20necesito%20cotizar%20${encodeURIComponent(
                    categoria.nombre
                  )}%20en%20${encodeURIComponent(c.nombre)}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Cotizar por WhatsApp
              </a>
            </div>
          </div>
        </header>

        {/* Cómo funciona "te mejoramos el precio" */}
        <section className="py-16 bg-orange-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-2">
              Te mejoramos el precio de {categoria.nombre.toLowerCase()} en 2 horas
            </h2>
            <p className="text-gray-700 mb-8 max-w-3xl">
              Si tienes cotización de Sodimac, Easy, Construmart u otra barraca para {categoria.nombre.toLowerCase()},
              te respondemos con contraoferta JURMAQ por correo.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  n: "1",
                  t: "Saca foto/PDF de tu cotización",
                  d: `De ${categoria.nombre.toLowerCase()} en cualquier barraca o homecenter.`,
                },
                {
                  n: "2",
                  t: "Súbela en 30 segundos",
                  d: `En la sección "Sube tu cotización" — tarda menos que un café.`,
                },
                {
                  n: "3",
                  t: "Recibe contraoferta",
                  d: `A tu correo en menos de 2 horas con cuánto ahorras despachando a ${c.nombre}.`,
                },
              ].map((p) => (
                <div key={p.n} className="bg-white p-6 rounded-xl border border-orange-200">
                  <div className="text-3xl font-bold text-orange-600 mb-2">{p.n}</div>
                  <h3 className="font-bold text-navy-950 mb-2">{p.t}</h3>
                  <p className="text-sm text-gray-700">{p.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Productos */}
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-2">
                  {categoria.nombre} disponibles para despacho a {c.nombre}
                </h2>
                <p className="text-gray-700">
                  Mostrando {productos.length} de {total} productos · Stock actualizado · Despacho en {distancia.tiempo}.
                </p>
              </div>
              <Link
                href={`/categorias/${categoria.slug}`}
                className="inline-flex items-center gap-2 text-sm font-semibold text-orange-600 hover:text-orange-700 self-start sm:self-auto whitespace-nowrap"
              >
                Ver toda la categoría →
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {productos.map((p) => (
                <ProductCard
                  key={p.id}
                  id={p.id}
                  nombre={p.nombre}
                  slug={p.slug}
                  precio={p.precio}
                  precio_original={p.precio_original}
                  en_oferta={p.en_oferta ?? undefined}
                  solo_cotizar={p.solo_cotizar ?? undefined}
                  imagen={p.imagen}
                  stock={p.stock ?? 0}
                  unidad={p.unidad}
                  medida={p.medida}
                  categoriaSlug={categoria.slug}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Contexto local — rubro × categoría */}
        <section className="py-16 bg-gray-50 border-y border-gray-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-4">
              ¿Para qué se usa {categoria.nombre.toLowerCase()} en {c.nombre}?
            </h2>
            <p className="text-gray-700 leading-relaxed mb-6">
              {c.contextoLocal} Nuestros clientes de {c.nombre} típicamente compran {categoria.nombre.toLowerCase()}{" "}
              para proyectos de {c.rubroLocal.join(", ")}.
            </p>
            <h3 className="text-sm font-semibold text-navy-950 uppercase tracking-wider mb-3">
              Rubros que atendemos en {c.nombre}
            </h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
              {c.rubroLocal.map((r) => (
                <li
                  key={r}
                  className="flex items-start gap-3 bg-white p-3 rounded-lg border border-gray-200"
                >
                  <span className="text-orange-500 font-bold">›</span>
                  <span className="text-gray-700 text-sm capitalize">{r}</span>
                </li>
              ))}
            </ul>
            {subCats && subCats.length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-navy-950 uppercase tracking-wider mb-3">
                  Subcategorías incluidas
                </h3>
                <div className="flex flex-wrap gap-2">
                  {subCats.map((s) => (
                    <Link
                      key={s.id}
                      href={`/categorias/${s.slug}`}
                      className="px-3 py-1.5 text-sm bg-white border border-gray-300 hover:border-orange-500 hover:bg-orange-50 rounded-full text-gray-700 transition-colors"
                    >
                      {s.nombre}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Despacho */}
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-8">
              Despacho a {c.nombre} desde Molina
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <div className="text-3xl font-bold text-orange-600 mb-2">
                  {distancia.km} km
                </div>
                <p className="text-gray-700">Distancia desde la barraca en Molina</p>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <div className="text-3xl font-bold text-orange-600 mb-2">
                  {distancia.tiempo}
                </div>
                <p className="text-gray-700">Tiempo de despacho típico</p>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <div className="text-lg font-bold text-navy-950 mb-2">
                  También despachamos a
                </div>
                <p className="text-gray-700 text-sm">
                  {c.comunasVecinas.join(", ")}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Cross-link: misma categoría, otras ciudades */}
        <section className="py-12 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-xl font-bold text-navy-950 mb-2">
              {categoria.nombre} en otras ciudades del Maule
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Misma cobertura desde Molina, mismo compromiso de mejor precio.
            </p>
            <div className="flex flex-wrap gap-2">
              {vecinasConLanding.length > 0 && (
                <>
                  {vecinasConLanding.map((v) => (
                    <Link
                      key={v.slug}
                      href={`/categorias/${categoria.slug}/en/${v.slug}`}
                      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-orange-50 border border-orange-300 hover:border-orange-500 rounded text-navy-950 transition-colors"
                    >
                      {categoria.nombre} en {v.nombre}
                      <span className="text-xs text-gray-500">
                        {DISTANCIAS_BARRACA[v.slug].km} km
                      </span>
                    </Link>
                  ))}
                </>
              )}
              {CIUDADES.filter(
                (x) => x.slug !== c.slug && !c.comunasVecinas.includes(x.nombre)
              ).map((other) => (
                <Link
                  key={other.slug}
                  href={`/categorias/${categoria.slug}/en/${other.slug}`}
                  className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-200 hover:border-orange-500 hover:bg-orange-50 rounded transition-colors"
                >
                  {categoria.nombre} en {other.nombre}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Cross-link: otras categorías en esta ciudad */}
        {siblingCats.length > 0 && (
          <section className="py-12">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-xl font-bold text-navy-950 mb-2">
                Otras categorías que despachamos a {c.nombre}
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                Mismo despacho, mismo plazo: {distancia.tiempo} desde Molina.
              </p>
              <div className="flex flex-wrap gap-2">
                {siblingCats.map((s) => (
                  <Link
                    key={s.id}
                    href={`/categorias/${s.slug}/en/${c.slug}`}
                    className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-200 hover:border-orange-500 hover:bg-orange-50 rounded transition-colors"
                  >
                    {s.nombre} en {c.nombre}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CTA final */}
        <section className="py-16 bg-navy-950 text-white text-center">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              ¿Tienes obra en {c.nombre}?
            </h2>
            <p className="text-gray-200 mb-8">
              Súbenos tu cotización de {categoria.nombre.toLowerCase()} y en menos de 2 horas te mejoramos el precio.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                href="/te-mejoramos-el-precio"
                className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 px-8 py-4 rounded-lg font-bold text-lg transition-colors"
              >
                Sube tu cotización
              </Link>
              <a
                href={
                  HQ.whatsapp +
                  `?text=Hola%2C%20obra%20en%20${encodeURIComponent(
                    c.nombre
                  )}%2C%20necesito%20${encodeURIComponent(categoria.nombre)}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 px-8 py-4 rounded-lg font-bold text-lg transition-colors"
              >
                WhatsApp {HQ.telefonoDisplay}
              </a>
            </div>
          </div>
        </section>
      </article>
    </>
  );
}
