import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabasePublic } from "@jurmaq/shared/supabase";
import { CIUDADES, TOP_PRODUCTOS_BARRACA, HQ, DISTANCIAS_BARRACA } from "@jurmaq/shared/seo";
import { applyDailyPromosToProducts } from "@/lib/promotions";
import { formatCLP } from "@jurmaq/shared/format";
import Breadcrumbs from "@jurmaq/shared/ui/Breadcrumbs";
import CrossLinksGrid from "@jurmaq/shared/ui/CrossLinksGrid";

// ISR: landing pSEO público, cambia rara vez → revalida diariamente.
export const revalidate = 86400;

/**
 * Programmatic SEO landing for `[material] en [ciudad]` queries.
 *
 * URL pattern: /material/<material-slug>-en-<ciudad-slug>
 *   e.g. /material/fierro-estriado-en-curico
 *        /material/cemento-en-molina
 *        /material/perfiles-metalicos-en-talca
 *
 * The two-tokens-in-one-segment approach (vs nested folders) keeps the URL
 * a literal match for the search query users type in Google
 * ("fierro estriado en curicó"), which both helps ranking and looks clean
 * in result snippets.
 *
 * 8 materiales × 12 ciudades = 96 landings, each one statically generated
 * with content unique per (material, ciudad) pair: real product list from
 * DB, ciudad-specific delivery time and rubro, "te mejoramos el precio"
 * CTA prominent, JSON-LD with Service + FAQPage + BreadcrumbList.
 */

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

function parseSlug(slug: string): { material: typeof TOP_PRODUCTOS_BARRACA[number]; ciudad: typeof CIUDADES[number] } | null {
  // Find the material whose slug is a prefix of the request, then check that
  // the suffix is "-en-<ciudad-slug>".
  for (const m of TOP_PRODUCTOS_BARRACA) {
    if (!slug.startsWith(m.slug + "-en-")) continue;
    const ciudadPart = slug.slice((m.slug + "-en-").length);
    const c = CIUDADES.find((x) => x.slug === ciudadPart);
    if (c) return { material: m, ciudad: c };
  }
  return null;
}

export async function generateStaticParams() {
  const params: { slug: string }[] = [];
  for (const m of TOP_PRODUCTOS_BARRACA) {
    for (const c of CIUDADES) {
      params.push({ slug: `${m.slug}-en-${c.slug}` });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const parsed = parseSlug(slug);
  if (!parsed) return { title: "Página no encontrada" };

  const { material, ciudad } = parsed;
  const lower = material.nombre.toLowerCase();

  return {
    title: `${material.nombre} en ${ciudad.nombre} · Te mejoramos el precio en 2h · Barraca JURMAQ`,
    description: `Compra ${lower} en ${ciudad.nombre} (${ciudad.region}). Despacho desde Molina en ${DISTANCIAS_BARRACA[ciudad.slug].tiempo}. Súbenos tu cotización de Sodimac, Easy o Construmart y en menos de 2 horas te mejoramos el precio. ${material.descripcionCorta}`,
    keywords: [
      `${lower} ${ciudad.nombre}`,
      `${lower} precio ${ciudad.nombre}`,
      `comprar ${lower} ${ciudad.nombre}`,
      `${lower} ${ciudad.region}`,
      `${lower} despacho ${ciudad.nombre}`,
      `${lower} barraca ${ciudad.nombre}`,
      ...material.searchKeywords.map((k) => `${k} ${ciudad.nombre}`),
      ...material.searchKeywords,
      ...ciudad.comunasVecinas.map((cv) => `${lower} ${cv}`),
      "te mejoramos el precio",
      "súbenos tu cotización",
      "barraca JURMAQ",
    ],
    openGraph: {
      title: `${material.nombre} en ${ciudad.nombre} · Barraca JURMAQ`,
      description: `${material.descripcionCorta} Despacho a ${ciudad.nombre} en ${DISTANCIAS_BARRACA[ciudad.slug].tiempo}. Te mejoramos el precio de la competencia en menos de 2 horas.`,
      url: `https://barraca.jurmaq.cl/material/${slug}`,
      siteName: "Barraca JURMAQ",
      locale: "es_CL",
      type: "website",
      images: [
        { url: "/barraca/icon-512.png", width: 512, height: 512, alt: `${material.nombre} en ${ciudad.nombre}` },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${material.nombre} en ${ciudad.nombre} · Te mejoramos el precio en 2h`,
      description: `${material.descripcionCorta} · Despacho ${DISTANCIAS_BARRACA[ciudad.slug].tiempo} a ${ciudad.nombre}.`,
    },
    icons: {
      icon: [
        { url: "/barraca/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "/barraca/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: { url: "/barraca/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    },
    alternates: {
      canonical: `https://barraca.jurmaq.cl/material/${slug}`,
    },
    manifest: "/barraca/manifest.json",
  };
}

function formatPrice(p: number): string {
  return `${formatCLP(p)}`;
}

export default async function MaterialEnCiudadPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const parsed = parseSlug(slug);
  if (!parsed) notFound();

  const { material, ciudad } = parsed;

  // Find the category by slug — products are queried via this.
  const { data: cat } = await supabasePublic
    .from("barraca_categorias")
    .select("id, nombre, slug")
    .eq("slug", material.categoriaSlug)
    .single();

  let productos: ProductoRow[] = [];
  if (cat) {
    // Include subcategories of the matched category.
    const { data: subCats } = await supabasePublic
      .from("barraca_categorias")
      .select("id")
      .eq("padre_id", cat.id);
    const allCatIds = [cat.id, ...(subCats || []).map((s: { id: number }) => s.id)];

    const { data: prods } = await supabasePublic
      .from("barraca_productos")
      .select("id, codigo, nombre, slug, precio, precio_original, en_oferta, solo_cotizar, stock, unidad, imagen, medida, categoria_id")
      .eq("activo", true)
      .gt("stock", 0)
      .ilike("nombre", `%${material.nombre.split(" ")[0]}%`)
      .in("categoria_id", allCatIds)
      .order("precio", { ascending: true })
      .limit(8);
    productos = await applyDailyPromosToProducts((prods || []) as ProductoRow[]);
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `https://barraca.jurmaq.cl/material/${slug}#service`,
        name: `${material.nombre} en ${ciudad.nombre}`,
        serviceType: `Venta y despacho de ${material.nombre.toLowerCase()}`,
        description: `${material.descripcionCorta} Despacho desde Molina a ${ciudad.nombre} en ${DISTANCIAS_BARRACA[ciudad.slug].tiempo}. Te mejoramos el precio de la competencia en menos de 2 horas.`,
        provider: { "@id": "https://jurmaq.cl/#organization" },
        areaServed: { "@type": "City", name: ciudad.nombre, containedInPlace: { "@type": "AdministrativeArea", name: ciudad.region } },
        offers: productos
          .filter((p) => !p.solo_cotizar && p.precio > 0)
          .slice(0, 5)
          .map((p) => ({
            "@type": "Offer",
            url: `https://barraca.jurmaq.cl/producto/${p.slug}`,
            name: p.nombre,
            priceCurrency: "CLP",
            price: p.en_oferta && p.precio_original ? p.precio_original : p.precio,
            availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          })),
      },
      {
        "@type": "FAQPage",
        mainEntity: material.faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Barraca JURMAQ", item: "https://barraca.jurmaq.cl" },
          { "@type": "ListItem", position: 2, name: material.nombrePlural, item: `https://barraca.jurmaq.cl/categorias/${material.categoriaSlug}` },
          { "@type": "ListItem", position: 3, name: `${material.nombre} en ${ciudad.nombre}`, item: `https://barraca.jurmaq.cl/material/${slug}` },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="bg-white">
        <header className="bg-navy-950 text-white py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <Breadcrumbs
              variant="dark"
              className="mb-4"
              items={[
                { label: "Inicio", href: "/" },
                { label: material.nombrePlural, href: `/categorias/${material.categoriaSlug}` },
                { label: ciudad.nombre },
              ]}
            />
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 bg-orange-600 text-white text-xs font-bold uppercase tracking-wider rounded">
              <span>✓ Despacho a {ciudad.nombre}</span>
              <span className="opacity-70">·</span>
              <span>{DISTANCIAS_BARRACA[ciudad.slug].tiempo}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4">
              {material.nombre} en {ciudad.nombre}
            </h1>
            <p className="text-lg text-gray-200 max-w-3xl mb-2">
              <strong className="text-orange-400">Súbenos tu cotización de Sodimac, Easy o Construmart</strong> y en menos de 2 horas te mejoramos el precio. {material.descripcionCorta}
            </p>
            <p className="text-gray-300 max-w-3xl mb-8">
              Despacho desde Molina a {ciudad.nombre} ({DISTANCIAS_BARRACA[ciudad.slug].km} km · {DISTANCIAS_BARRACA[ciudad.slug].tiempo}). Servicio para {ciudad.rubroLocal.slice(0, 2).join(" y ")} en la zona.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/te-mejoramos-el-precio"
                className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Sube tu cotización
              </Link>
              <a
                href={HQ.whatsapp + `?text=Hola%2C%20necesito%20cotizar%20${encodeURIComponent(material.nombre)}%20en%20${encodeURIComponent(ciudad.nombre)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Cotizar por WhatsApp
              </a>
            </div>
          </div>
        </header>

        {/* Cómo funciona el price-match */}
        <section className="py-16 bg-orange-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-2">
              ¿Cómo te mejoramos el precio en 2 horas?
            </h2>
            <p className="text-gray-700 mb-8">
              Si tienes cotización de Sodimac, Easy, Construmart u otra barraca para {material.nombre.toLowerCase()}, te respondemos con contraoferta JURMAQ por correo.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { n: "1", t: "Saca foto/PDF de tu cotización", d: `De ${material.nombre.toLowerCase()} en cualquier barraca o homecenter.` },
                { n: "2", t: "Súbela en 30 segundos", d: `En la sección "Sube tu cotización" — toma 30 segundos.` },
                { n: "3", t: "Recibe contraoferta", d: `A tu correo en menos de 2 horas. Si te conviene, aceptas.` },
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

        {/* Productos destacados de este material */}
        {productos.length > 0 && (
          <section className="py-16">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-2">
                {material.nombrePlural} disponibles para despacho a {ciudad.nombre}
              </h2>
              <p className="text-gray-700 mb-8">
                Stock actualizado · Precios publicados · Despacho en {DISTANCIAS_BARRACA[ciudad.slug].tiempo}.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {productos.map((p) => {
                  const showOffer = p.en_oferta && p.precio_original && p.precio_original > 0;
                  const finalPrice = showOffer ? p.precio_original! : p.precio;
                  return (
                    <Link
                      key={p.id}
                      href={`/producto/${p.slug}`}
                      className="block bg-white border border-gray-200 hover:border-orange-500 rounded-xl p-5 transition-colors"
                    >
                      <h3 className="text-base font-bold text-navy-950 mb-1 leading-tight">{p.nombre}</h3>
                      {p.medida && <p className="text-xs text-gray-500 mb-3">{p.medida}</p>}
                      {p.solo_cotizar ? (
                        <p className="text-base font-bold text-indigo-700">Consultar precio</p>
                      ) : showOffer ? (
                        <div>
                          <p className="text-xs text-gray-500 line-through">{formatPrice(p.precio)}</p>
                          <p className="text-xl font-extrabold text-orange-600">{formatPrice(finalPrice)}<span className="text-xs text-gray-500 font-medium ml-1">/{p.unidad || "un"}</span></p>
                        </div>
                      ) : (
                        <p className="text-xl font-extrabold text-navy-950">{formatPrice(p.precio)}<span className="text-xs text-gray-500 font-medium ml-1">/{p.unidad || "un"}</span></p>
                      )}
                      <span className="inline-block mt-3 text-sm text-orange-600 font-semibold">Ver detalle →</span>
                    </Link>
                  );
                })}
              </div>
              <div className="mt-8">
                <Link
                  href={`/categorias/${material.categoriaSlug}`}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-orange-600 hover:text-orange-700"
                >
                  Ver todos los {material.nombrePlural.toLowerCase()} →
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Para qué se usa */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-4">
              ¿Para qué se usa {material.nombre.toLowerCase()}?
            </h2>
            <p className="text-gray-700 mb-6 max-w-3xl">{material.descripcionLarga}</p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {material.usosTipicos.map((u, i) => (
                <li key={i} className="flex items-start gap-3 bg-white p-4 rounded-lg border border-gray-200">
                  <span className="text-orange-500 font-bold">›</span>
                  <span className="text-gray-700">{u}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Variantes comunes */}
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-6">
              Variantes más vendidas
            </h2>
            <div className="flex flex-wrap gap-2">
              {material.variantesComunes.map((v) => (
                <span key={v} className="px-4 py-2 bg-navy-950 text-white rounded-full text-sm font-medium">
                  {v}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Logística */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-8">
              Despacho a {ciudad.nombre} desde Molina
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <div className="text-3xl font-bold text-orange-600 mb-2">{DISTANCIAS_BARRACA[ciudad.slug].km} km</div>
                <p className="text-gray-700">Distancia desde la barraca</p>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <div className="text-3xl font-bold text-orange-600 mb-2">{DISTANCIAS_BARRACA[ciudad.slug].tiempo}</div>
                <p className="text-gray-700">Tiempo de despacho típico</p>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <div className="text-lg font-bold text-navy-950 mb-2">También despachamos a</div>
                <p className="text-gray-700 text-sm">{ciudad.comunasVecinas.join(", ")}</p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-8">
              Preguntas frecuentes sobre {material.nombre.toLowerCase()}
            </h2>
            <div className="space-y-6">
              {material.faq.map((f, i) => (
                <div key={i} className="border-b border-gray-200 pb-6">
                  <h3 className="text-lg font-bold text-navy-950 mb-2">{f.q}</h3>
                  <p className="text-gray-700 leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Cross-link a otros materiales en la misma ciudad */}
        <section className="py-12 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-xl font-bold text-navy-950 mb-4">
              Otros materiales que despachamos a {ciudad.nombre}
            </h2>
            <div className="flex flex-wrap gap-2">
              {TOP_PRODUCTOS_BARRACA.filter((m) => m.slug !== material.slug).map((m) => (
                <Link
                  key={m.slug}
                  href={`/material/${m.slug}-en-${ciudad.slug}`}
                  className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-200 hover:border-orange-500 hover:bg-orange-50 rounded transition-colors"
                >
                  {m.nombre} en {ciudad.nombre}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Cross-link a este material en otras ciudades */}
        <section className="py-12">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-xl font-bold text-navy-950 mb-4">
              {material.nombre} en otras ciudades del Maule
            </h2>
            <div className="flex flex-wrap gap-2">
              {CIUDADES.filter((c) => c.slug !== ciudad.slug).map((c) => (
                <Link
                  key={c.slug}
                  href={`/material/${material.slug}-en-${c.slug}`}
                  className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-200 hover:border-orange-500 hover:bg-orange-50 rounded transition-colors"
                >
                  {material.nombre} en {c.nombre}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="py-16 bg-navy-950 text-white text-center">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              ¿Tienes una obra en {ciudad.nombre}?
            </h2>
            <p className="text-gray-200 mb-8">
              Súbenos tu cotización y en menos de 2 horas te mejoramos el precio.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                href="/te-mejoramos-el-precio"
                className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 px-8 py-4 rounded-lg font-bold text-lg transition-colors"
              >
                Sube tu cotización
              </Link>
              <a
                href={HQ.whatsapp + `?text=Hola%2C%20obra%20en%20${encodeURIComponent(ciudad.nombre)}%2C%20necesito%20${encodeURIComponent(material.nombre)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 px-8 py-4 rounded-lg font-bold text-lg transition-colors"
              >
                WhatsApp +56 9 7667 3577
              </a>
            </div>
          </div>
        </section>

        <CrossLinksGrid
          title={`${material.nombre} en otras ciudades del Maule`}
          subtitle={`Despachamos ${material.nombre.toLowerCase()} desde Molina a Curicó, Talca, Linares y toda la región. Cotiza tu obra donde estés.`}
          eyebrow="Cobertura · Maule"
          variant="light"
          items={CIUDADES.filter((c) => c.slug !== ciudad.slug)
            .slice(0, 11)
            .map((c) => ({
              label: `${material.nombre} en ${c.nombre}`,
              href: `/material/${material.slug}-en-${c.slug}`,
            }))}
        />
      </article>
    </>
  );
}
