import type { Metadata } from "next";
import { supabasePublic } from "@jurmaq/shared/supabase";
import { notFound } from "next/navigation";
import CatalogoCategoria from "@/components/barraca/CatalogoCategoria";
import {
  POR_PAGINA,
  PARAMETROS_POR_DEFECTO,
  categoriaPorSlug,
  productosDeCategoria,
} from "@/lib/catalogo";
import type { Database } from "@jurmaq/shared/db-types";
import Breadcrumbs, { type BreadcrumbItem } from "@jurmaq/shared/ui/Breadcrumbs";
import CrossLinksGrid from "@jurmaq/shared/ui/CrossLinksGrid";
import { CIUDADES } from "@jurmaq/shared/seo";
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';
import { PROMESA, PROMESA_CORTA_META } from "@/lib/promesa";

type BarracaCategoriaRow = Pick<
  Database['public']['Tables']['barraca_categorias']['Row'],
  'id' | 'nombre' | 'slug'
>;
type BarracaProductoRow = Pick<
  Database['public']['Tables']['barraca_productos']['Row'],
  'id' | 'codigo' | 'nombre' | 'slug' | 'precio' | 'precio_original' | 'en_oferta' | 'solo_cotizar' | 'stock' | 'unidad' | 'imagen' | 'medida' | 'categoria_id'
>;

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
  const allCatIds = [cat.id, ...(subcatRows || []).map((s) => s.id)];

  const { count: productTotal } = await supabasePublic
    .from('barraca_productos')
    .select('*', { count: 'exact', head: true })
    .eq('activo', true)
    .in('categoria_id', allCatIds);
  const productCount = { total: productTotal || 0 };

  const lowerName = cat.nombre.toLowerCase();
  return {
    title: `${cat.nombre} en Molina · Despacho a Curicó y el Maule · Barraca JURMAQ`,
    description: `${productCount.total} productos de ${lowerName} con precio publicado en Barraca JURMAQ Curicó · Molina. Despacho a Teno, Romeral, Talca y toda la Región del Maule. ${PROMESA}.`,
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
      title: `${cat.nombre} · Barraca JURMAQ Curicó · ${PROMESA_CORTA_META}`,
      description: `${productCount.total} productos de ${lowerName} con precio publicado y stock. Despacho a toda la Región del Maule. Cotiza online. ${PROMESA}.`,
      url: `https://barraca.jurmaq.cl/categorias/${cat.slug}`,
      siteName: "Barraca JURMAQ",
      locale: "es_CL",
      type: "website",
      images: [
        {
          url: "/icon-512.png",
          width: 512,
          height: 512,
          alt: `${cat.nombre} en Barraca JURMAQ Curicó · Molina`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${cat.nombre} · Barraca JURMAQ Curicó`,
      description: `${productCount.total} productos. ${PROMESA}.`,
    },
    // Sin bloque `icons:`: en Next la página REEMPLAZA el del layout en vez
    // de fusionarse, y este declaraba solo 2 de los 6 iconos, apuntando
    // además a /barraca/*, resto del monolito viejo.
    alternates: {
      canonical: `https://barraca.jurmaq.cl/categorias/${cat.slug}`,
    },
  };
}

// Página estática: se genera una vez por categoría y se refresca cada hora.
// Antes leía searchParams (orden, stock, precio, página) y eso la volvía
// dinámica: cada visita y cada bot ejecutaba una función y ~8 consultas a
// Supabase. Los filtros ahora corren en el navegador (CatalogoCategoria) contra
// /api/catalogo, que sale de caché. Ver src/lib/catalogo.ts.
export const revalidate = 3600;

export async function generateStaticParams() {
  const { data } = await supabasePublic
    .from('barraca_categorias')
    .select('slug')
    .eq('activa', true);
  return (data ?? []).map((c: { slug: string }) => ({ slug: c.slug }));
}

export default async function CategoriaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const cat = await categoriaPorSlug(slug);
  if (!cat) notFound();
  const { categoria, catIds } = cat;

  // Conteo por subcategoría: una consulta `head` por subcategoría, en vez de
  // descargar la categoria_id de cada producto para contarlas en JS.
  const subcats: SubCat[] = await Promise.all(
    cat.subcats.map(async (s: BarracaCategoriaRow) => {
      const { count } = await supabasePublic
        .from('barraca_productos')
        .select('id', { count: 'exact', head: true })
        .eq('activo', true)
        .eq('categoria_id', s.id);
      return { id: s.id, nombre: s.nombre, slug: s.slug, product_count: count ?? 0 };
    }),
  );

  const { productos, total } = await productosDeCategoria(catIds, PARAMETROS_POR_DEFECTO);
  const offset = 0;

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
  const pricedProducts = (productos || []).filter((p: BarracaProductoRow) => !p.solo_cotizar && p.precio > 0);
  const lowPrice = pricedProducts.reduce(
    (min: number, p: BarracaProductoRow) => {
      const effective = p.en_oferta && p.precio_original ? p.precio_original : p.precio;
      return effective < min ? effective : min;
    },
    Number.MAX_SAFE_INTEGER
  );
  const highPrice = pricedProducts.reduce(
    (max: number, p: BarracaProductoRow) => {
      const effective = p.en_oferta && p.precio_original ? p.precio_original : p.precio;
      return effective > max ? effective : max;
    },
    0
  );

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${categoria.nombre} - Barraca JURMAQ`,
    description: `Productos de ${categoria.nombre.toLowerCase()} disponibles en Barraca JURMAQ Curicó. ${PROMESA}. Despacho a toda la Región del Maule.`,
    numberOfItems: total,
    itemListElement: (productos || []).map((p: BarracaProductoRow, i: number) => {
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
            availability: (p.stock ?? 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
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
        dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }}
      />
      {aggregateOfferJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(aggregateOfferJsonLd) }}
        />
      )}
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      <Breadcrumbs
        variant="light"
        className="mb-10"
        items={(() => {
          const items: BreadcrumbItem[] = [
            { label: "Inicio", href: "/" },
            { label: "Categorías", href: "/categorias" },
          ];
          if (parentCat) {
            items.push({ label: parentCat.nombre, href: `/categorias/${parentCat.slug}` });
          }
          items.push({ label: categoria.nombre });
          return items;
        })()}
      />

      <CatalogoCategoria
        slug={categoria.slug}
        nombre={categoria.nombre}
        subcats={subcats}
        inicial={productos}
        totalInicial={total}
        porPagina={POR_PAGINA}
      />
    </div>
    <CrossLinksGrid
      title="Despacho a todo el Maule"
      subtitle={`Llevamos ${categoria.nombre.toLowerCase()} y todo lo que necesitas para tu obra a Curicó, Talca, Linares y comunas vecinas.`}
      eyebrow="Cobertura · Maule"
      variant="light"
      items={CIUDADES.slice(0, 12).map((ciudad) => ({
        label: `Despacho a ${ciudad.nombre}`,
        href: `/en/${ciudad.slug}`,
      }))}
    />
    </>
  );
}
