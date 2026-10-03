import { MetadataRoute } from "next";
// Audit A1: usar cliente publico (anon) en sitemap. Lecturas publicas no
// necesitan service_role; ademas reduce el blast-radius del admin client.
// barraca_categorias permite SELECT a anon (ver enable-rls.sql).
// Para productos usamos la vista publica barraca_productos_public que
// excluye `costo` (creada en harden-rls.js) ya que la tabla principal
// tiene REVOKE de anon.
import { supabasePublic } from "@jurmaq/shared/supabase";
import { CIUDADES } from "@jurmaq/shared/seo";
import { GUIAS } from "@/lib/guias-seo-data";

/**
 * Cachea el sitemap 24 h.
 *
 * Sin esto se regeneraba en CADA request de bot: 4 queries sin límite (~4.000
 * filas) para escupir ~2.400 URLs. Google, Bing y los crawlers de IA lo piden
 * varias veces al día cada uno, y cada visita salía en Fluid CPU y en Fast
 * Origin Transfer. El catálogo no cambia lo suficiente como para justificar
 * regenerarlo más seguido que una vez al día.
 */
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://barraca.jurmaq.cl";

  // Static barraca pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/categorias`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    // pSEO: calculadora de fierro (la única que se mantiene; ver commit de simplificación)
    {
      url: `${baseUrl}/calculadora-fierro`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/guias`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/te-mejoramos-el-precio`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/sucursales`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  // pSEO landings por ciudad — `/en/<ciudad-slug>` (audit fase 4.7)
  const ciudadUrls: MetadataRoute.Sitemap = CIUDADES.map((c) => ({
    url: `${baseUrl}/en/${c.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.75,
  }));



  // pSEO guias programaticas — una entry por guia en GUIAS
  const guiasUrls: MetadataRoute.Sitemap = GUIAS.map((g) => ({
    url: `${baseUrl}/guias/${g.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.75,
  }));

  // All active categories
  const { data: categories } = await supabasePublic
    .from('barraca_categorias')
    .select('id, slug, padre_id')
    .eq('activa', true);

  const categoryUrls: MetadataRoute.Sitemap = (categories || []).map(
    (c: { slug: string }) => ({
      url: `${baseUrl}/categorias/${c.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })
  );

  // Las 216 landings `categoría × ciudad` se eliminaron: eran el 59% del build,
  // no estaban enlazadas desde ninguna parte del sitio y eran el mismo template
  // con el nombre de la comuna cambiado. Ese patrón (doorway pages) es
  // exactamente lo que Google penaliza, y encima era el mayor costo de build.
  // Junto con ellas se fue la query sin límite que traía las 1.978 filas de
  // productos solo para decidir qué categorías eran elegibles.

  // Fichas de producto desde la vista pública (sin costo).
  //
  // Hasta oct-2026 esta consulta pedía `updated_at`, columna que la vista NO
  // tiene: PostgREST respondía 400, `data` llegaba null y el sitemap salía con
  // CERO productos. Los bots tenían que descubrirlos recorriendo la paginación
  // de categorías, que era dinámica y gastaba una función por página.
  //
  // PostgREST corta en 1.000 filas: se pide en tramos. Sin lastModified: la
  // vista no tiene fecha de modificación y una fecha inventada le enseña a
  // Google a ignorar el campo. Hay slugs repetidos (productos duplicados en
  // el catálogo); se listan una vez.
  const slugs = new Set<string>();
  for (let desde = 0; desde < 20_000; desde += 1000) {
    const { data, error } = await supabasePublic
      .from('barraca_productos_public')
      .select('slug')
      .eq('activo', true)
      .order('id')
      .range(desde, desde + 999);
    if (error || !data) break;
    for (const p of data as { slug: string | null }[]) if (p.slug) slugs.add(p.slug);
    if (data.length < 1000) break;
  }

  const productUrls: MetadataRoute.Sitemap = [...slugs].map((slug) => ({
    url: `${baseUrl}/producto/${slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [
    ...staticPages,
    ...ciudadUrls,
    ...guiasUrls,
    ...categoryUrls,
    ...productUrls,
  ];
}
