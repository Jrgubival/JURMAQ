import type { Metadata } from "next";
import Link from "@/components/barraca/Enlace";
import { notFound } from "next/navigation";
// Audit A1+SEO: cliente publico (anon) para lecturas de catalogo. Reduce
// blast-radius del admin client y permite SSG estatico de la landing.
import { supabasePublic } from "@jurmaq/shared/supabase";
import { CIUDADES, TOP_PRODUCTOS_BARRACA, HQ, DISTANCIAS_BARRACA } from "@jurmaq/shared/seo";
import Breadcrumbs from "@jurmaq/shared/ui/Breadcrumbs";
import CrossLinksGrid from "@jurmaq/shared/ui/CrossLinksGrid";
import { safeJsonLd } from '@jurmaq/shared/seo/jsonld';
import { whatsappCtaBarracaCiudad } from "@jurmaq/shared/whatsapp";
import { despachaA, LUGARES_DESPACHO, COBERTURA_CORTA } from "@/lib/cobertura";

interface Categoria {
  id: number;
  nombre: string;
  slug: string;
}

export async function generateStaticParams() {
  return CIUDADES.map((c) => ({ ciudad: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ciudad: string }>;
}): Promise<Metadata> {
  const { ciudad } = await params;
  const c = CIUDADES.find((x) => x.slug === ciudad);
  if (!c) return { title: "Ciudad no encontrada" };
  const cubre = despachaA(c.nombre);
  const km = DISTANCIAS_BARRACA[c.slug].km;
  const entrega = cubre
    ? `Despacho en camión desde Molina (${km} km).`
    : `Retiro en Molina (${km} km). ${COBERTURA_CORTA}`;

  return {
    title: `Barraca de Fierros y Materiales en ${c.nombre} · JURMAQ`,
    description: `Barraca de fierros, perfiles, planchas, tubos, mallas Acma, cementos y +1.600 productos para ${c.nombre} (${c.region}). ${entrega}`,
    keywords: [
      `barraca de fierros ${c.nombre}`,
      `barraca fierros ${c.nombre}`,
      `materiales construcción ${c.nombre}`,
      `materiales construcción online ${c.nombre}`,
      `ferretería ${c.nombre}`,
      `ferretería online ${c.nombre}`,
      `fierro estriado ${c.nombre}`,
      `cemento ${c.nombre}`,
      `planchas zinc ${c.nombre}`,
      `malla acma ${c.nombre}`,
      `pinturas ${c.nombre}`,
      `comprar fierros ${c.nombre}`,
      `comprar materiales ${c.nombre}`,
      `barraca despacho ${c.nombre}`,
      ...c.comunasVecinas.map((cv) => `barraca fierros ${cv}`),
      "JURMAQ Barraca",
    ],
    openGraph: {
      title: `Barraca JURMAQ para ${c.nombre}`,
      description: `+1.600 productos. ${entrega}`,
      url: `https://barraca.jurmaq.cl/en/${c.slug}`,
      siteName: "Barraca JURMAQ",
      locale: "es_CL",
      type: "website",
      images: [
        { url: "/icon-512.png", width: 512, height: 512, alt: `Barraca JURMAQ en ${c.nombre}` },
      ],
    },
    // Sin bloque `icons:`: en Next la página REEMPLAZA el del layout en vez
    // de fusionarse, y este declaraba solo 2 de los 6 iconos, apuntando
    // además a /barraca/*, resto del monolito viejo.
    alternates: {
      canonical: `https://barraca.jurmaq.cl/en/${c.slug}`,
    },
  };
}

export default async function BarracaEnCiudadPage({
  params,
}: {
  params: Promise<{ ciudad: string }>;
}) {
  const { ciudad } = await params;
  const c = CIUDADES.find((x) => x.slug === ciudad);
  if (!c) notFound();
  // Solo se promete despacho a los lugares de ZONAS_DESPACHO (camión propio).
  const cubre = despachaA(c.nombre);
  const km = DISTANCIAS_BARRACA[c.slug].km;

  const { data: catsRaw } = await supabasePublic
    .from("barraca_categorias")
    .select("id, nombre, slug")
    .eq("activa", true)
    .is("padre_id", null)
    .order("orden", { ascending: true })
    .limit(12);
  const categorias: Categoria[] = (catsRaw || []) as Categoria[];

  // Helpers SEO local: ciudades vecinas con landing propia (cluster cluster)
  const vecinasConLanding = c.comunasVecinas
    .map((nombre) => CIUDADES.find((x) => x.nombre === nombre))
    .filter((x): x is NonNullable<typeof x> => !!x && x.slug !== c.slug && despachaA(x.nombre));

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "HardwareStore",
        "@id": `https://barraca.jurmaq.cl/en/${c.slug}#store`,
        name: cubre ? `Barraca JURMAQ — Despacho a ${c.nombre}` : `Barraca JURMAQ — Molina`,
        description: cubre
          ? `Barraca de fierros y materiales de construcción con despacho en camión a ${c.nombre} desde Molina. +1.600 productos disponibles.`
          : `Barraca de fierros y materiales de construcción en Molina. ${COBERTURA_CORTA}`,
        url: `https://barraca.jurmaq.cl/en/${c.slug}`,
        telephone: HQ.telefono,
        priceRange: "$$",
        areaServed: {
          "@type": "City",
          name: c.nombre,
          containedInPlace: { "@type": "AdministrativeArea", name: c.region },
        },
        // Coordenadas de la ciudad atendida — mejora SEO local (Maps Pack).
        geo: {
          "@type": "GeoCoordinates",
          latitude: c.lat,
          longitude: c.lng,
        },
        address: {
          "@type": "PostalAddress",
          streetAddress: "Av. Poniente 2157",
          addressLocality: "Molina",
          addressRegion: "Región del Maule",
          addressCountry: "CL",
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: `¿Despachan a ${c.nombre}?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: cubre
                ? `Sí. Despachamos a ${c.nombre} en nuestro camión desde la barraca en Molina (${km} km). El día de entrega se coordina al confirmar el pedido.`
                : `No. Nuestro camión despacha solo a ${LUGARES_DESPACHO}. Desde ${c.nombre} puedes comprar en línea y retirar en Av. Poniente 2157, Molina (${km} km).`,
            },
          },
          {
            "@type": "Question",
            name: `¿Cuánto cuesta el despacho a ${c.nombre}?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: cubre
                ? `El costo depende del lugar de entrega y se muestra en el carrito antes de pagar.`
                : `No despachamos a ${c.nombre}. El retiro en Molina no tiene costo.`,
            },
          },
          {
            "@type": "Question",
            name: `¿Qué materiales tienen disponibles?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: "Fierros estriados, perfiles, planchas zinc/galvanizadas, tubos, mallas Acma, cementos, áridos, pinturas y +1.600 productos de barraca. Todos con stock real y precio publicado en línea.",
            },
          },
        ],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Barraca JURMAQ", item: "https://barraca.jurmaq.cl" },
          { "@type": "ListItem", position: 2, name: cubre ? `Despacho a ${c.nombre}` : `Barraca para ${c.nombre}`, item: `https://barraca.jurmaq.cl/en/${c.slug}` },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />

      <article className="bg-white">
        <header className="bg-navy-950 text-white py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <Breadcrumbs
              variant="dark"
              className="mb-4"
              items={[
                { label: "Inicio", href: "/" },
                { label: cubre ? `Despacho a ${c.nombre}` : `Barraca para ${c.nombre}` },
              ]}
            />
            <div className="inline-block px-3 py-1 mb-4 bg-marca-600 text-white text-xs font-bold uppercase tracking-wider rounded">
              {cubre ? `✓ Despacho a ${c.nombre}` : "Retiro en Molina"} · {km} km desde Molina
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4">
              Barraca de Fierros y Materiales de Construcción en {c.nombre}
            </h1>
            <p className="text-lg text-gray-200 max-w-3xl mb-2">
              {cubre
                ? `Despacho en camión desde Molina a ${c.nombre} (${km} km).`
                : `Retiro en Av. Poniente 2157, Molina (${km} km). Nuestro camión despacha solo a ${LUGARES_DESPACHO}.`}
            </p>
            <p className="text-gray-300 max-w-3xl mb-8">{c.contextoLocal}</p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/categorias"
                className="inline-flex items-center gap-2 bg-marca-600 hover:bg-marca-700 px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Comprar en línea
              </Link>
              <Link
                href="/sucursales"
                className="inline-flex items-center gap-2 bg-white text-navy-950 hover:bg-gray-100 px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Retiro y despacho
              </Link>
            </div>
          </div>
        </header>

        {/* Categorías destacadas */}
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-2">
              {cubre ? `Materiales que despachamos a ${c.nombre}` : "Materiales de la barraca"}
            </h2>
            <p className="text-gray-700 mb-8">
              Más de 1.600 productos con precio publicado y stock real.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {categorias.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/categorias/${cat.slug}`}
                  className="block bg-white border border-gray-200 hover:border-marca-500 rounded-xl p-4 transition-colors text-center"
                >
                  <h3 className="font-semibold text-navy-950 text-sm">{cat.nombre}</h3>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Productos top */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-8">
              {cubre ? `Lo que más despachamos a ${c.nombre}` : "Lo más pedido"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {TOP_PRODUCTOS_BARRACA.map((p) => (
                <Link
                  key={p.slug}
                  href={`/categorias/${p.categoriaSlug}`}
                  className="block bg-white border border-gray-200 hover:border-marca-500 rounded-xl p-5 transition-colors"
                >
                  <h3 className="text-lg font-bold text-navy-950 mb-2">{p.nombre}</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    {p.searchKeywords.slice(0, 3).join(" · ")}
                  </p>
                  <span className="text-sm text-marca-600 font-semibold">Ver categoría →</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Logística */}
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-8">
              {cubre ? `Despacho a ${c.nombre} desde Molina` : `Retiro en Molina, a ${km} km de ${c.nombre}`}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <div className="text-3xl font-bold text-marca-600 mb-2">{km} km</div>
                <p className="text-gray-700">Distancia desde la barraca</p>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <div className="text-3xl font-bold text-marca-600 mb-2">{cubre ? "En camión" : "Retiro"}</div>
                <p className="text-gray-700">
                  {cubre
                    ? "El día de entrega se coordina al confirmar el pedido"
                    : "En Av. Poniente 2157, Molina"}
                </p>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <div className="text-lg font-bold text-navy-950 mb-2">Nuestro camión despacha a</div>
                <p className="text-gray-700 text-sm">{LUGARES_DESPACHO}</p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ visible — apoya el FAQPage schema con texto crawlable */}
        <section className="py-16 bg-white border-t border-gray-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-8">
              Preguntas frecuentes — Barraca JURMAQ en {c.nombre}
            </h2>
            <dl className="space-y-6">
              <div>
                <dt className="font-semibold text-navy-950 mb-1">¿Despachan a {c.nombre}?</dt>
                <dd className="text-gray-700 text-sm">
                  {cubre
                    ? `Sí. Despachamos a ${c.nombre} en nuestro camión desde la barraca en Molina (${km} km). El día de entrega se coordina al confirmar el pedido.`
                    : `No. Nuestro camión despacha solo a ${LUGARES_DESPACHO}. Desde ${c.nombre} puedes comprar en línea y retirar en Av. Poniente 2157, Molina (${km} km).`}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-navy-950 mb-1">¿Cuánto cuesta el despacho?</dt>
                <dd className="text-gray-700 text-sm">
                  {cubre
                    ? "Depende del lugar de entrega y se muestra en el carrito antes de pagar."
                    : `No despachamos a ${c.nombre}. El retiro en Molina no tiene costo.`}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-navy-950 mb-1">¿Qué materiales tienen?</dt>
                <dd className="text-gray-700 text-sm">
                  Fierros estriados, perfiles, planchas zinc, tubos, mallas Acma, cementos, áridos, pinturas y
                  +1.600 productos. Todos con stock real y precio publicado.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Cluster SEO local: comunas vecinas con landing propia */}
        {vecinasConLanding.length > 0 && (
          <section className="py-12 bg-gray-50 border-t border-gray-200">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-xl font-bold text-navy-950 mb-4">
                También despachamos a estas comunas
              </h2>
              <p className="text-sm text-gray-600 mb-6">
                Despacho en camión desde Molina.
              </p>
              <div className="flex flex-wrap gap-3">
                {vecinasConLanding.map((v) => (
                  <Link
                    key={v.slug}
                    href={`/en/${v.slug}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:border-marca-500 rounded-full text-sm font-medium text-navy-950 transition-colors"
                  >
                    Barraca en {v.nombre}
                    <span className="text-xs text-gray-500">{DISTANCIAS_BARRACA[v.slug].km} km</span>
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
              ¿Tienes una obra en {c.nombre}?
            </h2>
            <p className="text-gray-200 mb-8">
              Compra en línea con Webpay o transferencia. {cubre ? "Te lo llevamos en camión o lo retiras en Molina." : "Retiras en Molina."}
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                href="/categorias"
                className="inline-flex items-center gap-2 bg-marca-600 hover:bg-marca-700 px-8 py-4 rounded-lg font-bold text-lg transition-colors"
              >
                Comprar en línea
              </Link>
              <a
                href={whatsappCtaBarracaCiudad(c.slug, c.nombre)}
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
          title="Ciudades a las que despachamos"
          subtitle={`Despacho en camión desde Molina a ${LUGARES_DESPACHO}.`}
          eyebrow="Cobertura · Maule"
          variant="light"
          items={CIUDADES.filter((x) => x.slug !== c.slug && despachaA(x.nombre))
            .slice(0, 11)
            .map((x) => ({
              label: `Despacho a ${x.nombre}`,
              href: `/en/${x.slug}`,
            }))}
        />
      </article>
    </>
  );
}
