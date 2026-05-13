import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
// Audit A1+SEO: cliente publico (anon) para lecturas de catalogo. Reduce
// blast-radius del admin client y permite SSG estatico de la landing.
import { supabasePublic } from "@jurmaq/shared/supabase";
import { CIUDADES, TOP_PRODUCTOS_BARRACA, HQ } from "@jurmaq/shared/seo";

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

  return {
    title: `Barraca de Fierros y Materiales en ${c.nombre} · Te mejoramos el precio en 2h · JURMAQ`,
    description: `Barraca de fierros, perfiles, planchas, tubos, mallas Acma, cementos y +1.600 productos en ${c.nombre} (${c.region}). Despacho desde Molina en ${c.tiempoDespacho}. Súbenos tu cotización de Sodimac, Easy o Construmart y en menos de 2 horas te mejoramos el precio.`,
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
      `te mejoramos el precio ${c.nombre}`,
      `súbenos tu cotización ${c.nombre}`,
      `comprar fierros ${c.nombre}`,
      `comprar materiales ${c.nombre}`,
      `barraca despacho ${c.nombre}`,
      ...c.comunasVecinas.map((cv) => `barraca fierros ${cv}`),
      "JURMAQ Barraca",
    ],
    openGraph: {
      title: `Barraca JURMAQ en ${c.nombre} · Te mejoramos el precio en 2h`,
      description: `+1.600 productos. Despacho a ${c.nombre} en ${c.tiempoDespacho}. Súbenos tu cotización de la competencia y en menos de 2 horas te llega contraoferta JURMAQ por correo.`,
      url: `https://barraca.jurmaq.cl/en/${c.slug}`,
      siteName: "Barraca JURMAQ",
      locale: "es_CL",
      type: "website",
      images: [
        { url: "/barraca/icon-512.png", width: 512, height: 512, alt: `Barraca JURMAQ en ${c.nombre}` },
      ],
    },
    icons: {
      icon: [
        { url: "/barraca/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "/barraca/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: { url: "/barraca/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    },
    alternates: {
      canonical: `https://barraca.jurmaq.cl/en/${c.slug}`,
    },
    manifest: "/barraca/manifest.json",
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
    .filter((x): x is NonNullable<typeof x> => !!x && x.slug !== c.slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "HardwareStore",
        "@id": `https://barraca.jurmaq.cl/en/${c.slug}#store`,
        name: `Barraca JURMAQ — Despacho a ${c.nombre}`,
        slogan: "Súbenos tu cotización y en menos de 2 horas te mejoramos el precio",
        description: `Barraca de fierros y materiales de construcción con despacho a ${c.nombre} desde Molina. +1.600 productos disponibles. Te mejoramos el precio de Sodimac, Easy o Construmart.`,
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
              text: `Sí. Despachamos a ${c.nombre} desde nuestra barraca en Molina (${c.distanciaKm} km). Tiempo de despacho típico: ${c.tiempoDespacho}. También cubrimos comunas vecinas: ${c.comunasVecinas.join(", ")}.`,
            },
          },
          {
            "@type": "Question",
            name: `¿Cuánto cuesta el despacho a ${c.nombre}?`,
            acceptedAnswer: {
              "@type": "Answer",
              text: `El costo de despacho varía según volumen y peso del pedido. Súbenos tu cotización en la página y te indicamos el precio total con despacho incluido a ${c.nombre} en menos de 2 horas.`,
            },
          },
          {
            "@type": "Question",
            name: "¿Cómo funciona la garantía 'Te mejoramos el precio'?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Súbenos foto o PDF de tu cotización de Sodimac, Easy, Construmart u otra barraca. En menos de 2 horas te enviamos por correo nuestra contraoferta JURMAQ. Si te conviene, aceptas; si no, no pasa nada.",
            },
          },
          {
            "@type": "Question",
            name: `¿Qué materiales tienen disponibles para despacho a ${c.nombre}?`,
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
          { "@type": "ListItem", position: 2, name: `Despacho a ${c.nombre}`, item: `https://barraca.jurmaq.cl/en/${c.slug}` },
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
            <nav aria-label="Breadcrumb" className="text-sm text-gray-400 mb-4">
              <Link href="/" className="hover:text-white">Barraca JURMAQ</Link>
              <span className="mx-2">›</span>
              <span className="text-white">Despacho a {c.nombre}</span>
            </nav>
            <div className="inline-block px-3 py-1 mb-4 bg-orange-600 text-white text-xs font-bold uppercase tracking-wider rounded">
              ✓ Despacho a {c.nombre} · {c.tiempoDespacho}
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-4">
              Barraca de Fierros y Materiales de Construcción en {c.nombre}
            </h1>
            <p className="text-lg text-gray-200 max-w-3xl mb-2">
              <strong className="text-orange-400">Súbenos tu cotización de Sodimac, Easy o Construmart</strong> y
              en menos de 2 horas te mejoramos el precio. Despacho desde Molina a {c.nombre}{" "}
              en {c.tiempoDespacho} ({c.distanciaKm} km).
            </p>
            <p className="text-gray-300 max-w-3xl mb-8">{c.contextoLocal}</p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/cotizar"
                className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Súbenos tu cotización
              </Link>
              <Link
                href="/categorias"
                className="inline-flex items-center gap-2 bg-white text-navy-950 hover:bg-gray-100 px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Ver +1.600 productos
              </Link>
            </div>
          </div>
        </header>

        {/* Cómo funciona el price-match */}
        <section className="py-16 bg-orange-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-2">
              Te mejoramos el precio en menos de 2 horas
            </h2>
            <p className="text-gray-700 mb-8">
              Si tienes cotización de Sodimac, Easy, Construmart u otra barraca, te respondemos
              con contraoferta JURMAQ por correo.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl border border-orange-200">
                <div className="text-3xl font-bold text-orange-600 mb-2">1</div>
                <h3 className="font-bold text-navy-950 mb-2">Saca foto/PDF de tu cotización</h3>
                <p className="text-sm text-gray-700">Cualquier barraca o homecenter — Sodimac, Easy, Construmart, otra ferretería.</p>
              </div>
              <div className="bg-white p-6 rounded-xl border border-orange-200">
                <div className="text-3xl font-bold text-orange-600 mb-2">2</div>
                <h3 className="font-bold text-navy-950 mb-2">Súbela en barraca.jurmaq.cl</h3>
                <p className="text-sm text-gray-700">En la sección &quot;Sube tu cotización&quot; — toma 30 segundos.</p>
              </div>
              <div className="bg-white p-6 rounded-xl border border-orange-200">
                <div className="text-3xl font-bold text-orange-600 mb-2">3</div>
                <h3 className="font-bold text-navy-950 mb-2">Recibe contraoferta en 2h</h3>
                <p className="text-sm text-gray-700">Te llega al correo con cuánto ahorras. Si te conviene, aceptas. Si no, no pasa nada.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Categorías destacadas */}
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-2">
              Materiales que despachamos a {c.nombre}
            </h2>
            <p className="text-gray-700 mb-8">
              Más de 1.600 productos con precio publicado y stock real.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {categorias.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/categorias/${cat.slug}`}
                  className="block bg-white border border-gray-200 hover:border-orange-500 rounded-xl p-4 transition-colors text-center"
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
              Lo que más despachamos a {c.nombre}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {TOP_PRODUCTOS_BARRACA.map((p) => (
                <Link
                  key={p.slug}
                  href={`/categorias/${p.categoriaSlug}`}
                  className="block bg-white border border-gray-200 hover:border-orange-500 rounded-xl p-5 transition-colors"
                >
                  <h3 className="text-lg font-bold text-navy-950 mb-2">{p.nombre}</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    {p.searchKeywords.slice(0, 3).join(" · ")}
                  </p>
                  <span className="text-sm text-orange-600 font-semibold">Ver categoría →</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Logística */}
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-navy-950 mb-8">
              Despacho a {c.nombre} desde Molina
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <div className="text-3xl font-bold text-orange-600 mb-2">{c.distanciaKm} km</div>
                <p className="text-gray-700">Distancia desde la barraca</p>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <div className="text-3xl font-bold text-orange-600 mb-2">{c.tiempoDespacho}</div>
                <p className="text-gray-700">Tiempo de despacho típico</p>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <div className="text-lg font-bold text-navy-950 mb-2">También despachamos a</div>
                <p className="text-gray-700 text-sm">{c.comunasVecinas.join(", ")}</p>
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
                  Sí. Despachamos a {c.nombre} desde nuestra barraca en Molina ({c.distanciaKm} km). Tiempo de
                  despacho típico: {c.tiempoDespacho}. También cubrimos {c.comunasVecinas.join(", ")}.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-navy-950 mb-1">¿Cuánto cuesta el despacho?</dt>
                <dd className="text-gray-700 text-sm">
                  Varía según volumen y peso del pedido. Súbenos tu cotización y en menos de 2 horas te indicamos
                  el precio total con despacho incluido a {c.nombre}.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-navy-950 mb-1">¿Cómo funciona &quot;Te mejoramos el precio&quot;?</dt>
                <dd className="text-gray-700 text-sm">
                  Súbenos foto o PDF de tu cotización de Sodimac, Easy, Construmart u otra barraca. En menos de
                  2 horas te enviamos por correo nuestra contraoferta. Si te conviene, aceptas; si no, no pasa nada.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-navy-950 mb-1">¿Qué materiales despachan?</dt>
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
                Misma cobertura, mismo despacho desde Molina.
              </p>
              <div className="flex flex-wrap gap-3">
                {vecinasConLanding.map((v) => (
                  <Link
                    key={v.slug}
                    href={`/en/${v.slug}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:border-orange-500 rounded-full text-sm font-medium text-navy-950 transition-colors"
                  >
                    Barraca en {v.nombre}
                    <span className="text-xs text-gray-500">{v.distanciaKm} km</span>
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
              Súbenos tu cotización y en menos de 2 horas te mejoramos el precio.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                href="/cotizar"
                className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 px-8 py-4 rounded-lg font-bold text-lg transition-colors"
              >
                Sube tu cotización
              </Link>
              <a
                href={HQ.whatsapp + `?text=Hola%2C%20obra%20en%20${encodeURIComponent(c.nombre)}%2C%20necesito%20cotizar%20materiales`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 px-8 py-4 rounded-lg font-bold text-lg transition-colors"
              >
                WhatsApp +56 9 7667 3577
              </a>
            </div>
          </div>
        </section>
      </article>
    </>
  );
}
