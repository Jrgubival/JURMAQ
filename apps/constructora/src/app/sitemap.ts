import { MetadataRoute } from "next";
// Cliente publico (anon) — solo lecturas de maquinarias permitidas a anon.
import { supabasePublic } from "@jurmaq/shared/supabase";
import { CIUDADES, TIPOS_MAQUINA } from "@jurmaq/shared/seo";

/**
 * Sitemap de jurmaq.cl (Constructora).
 *
 * Solo lista rutas del dominio constructora. barraca.jurmaq.cl tiene su
 * propio sitemap en `apps/barraca/src/app/sitemap.ts`.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://jurmaq.cl";

  // --- SEO landings ---
  const tipoLandings: MetadataRoute.Sitemap = TIPOS_MAQUINA.map((t) => ({
    url: `${baseUrl}/arriendo/${t.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.85,
  }));

  const ciudadArriendoLandings: MetadataRoute.Sitemap = CIUDADES.map((c) => ({
    url: `${baseUrl}/arriendo-en/${c.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.85,
  }));

  // --- Main site pages ---
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/maquinarias`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/contacto`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/terminos`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${baseUrl}/privacidad`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];

  // --- Machinery detail pages ---
  // updated_at real si existe — Google premia páginas con contenido fresco.
  const { data: machines } = await supabasePublic
    .from('maquinarias')
    .select('id, updated_at');

  const machineUrls: MetadataRoute.Sitemap = (machines || []).map(
    (m: { id: number | string; updated_at?: string | null }) => ({
      url: `${baseUrl}/maquinarias/${m.id}`,
      lastModified: m.updated_at ? new Date(m.updated_at) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }),
  );

  return [
    ...staticPages,
    ...tipoLandings,
    ...ciudadArriendoLandings,
    ...machineUrls,
  ];
}
