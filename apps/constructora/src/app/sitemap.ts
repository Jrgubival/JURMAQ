import { MetadataRoute } from "next";

/**
 * Sitemap de jurmaq.cl (Constructora).
 *
 * Solo lista rutas del dominio constructora. barraca.jurmaq.cl tiene su
 * propio sitemap en `apps/barraca/src/app/sitemap.ts`.
 */
// Cachea 24 h: se regeneraba en cada request de bot, con queries a Supabase.
// Ver la nota equivalente en apps/barraca/src/app/sitemap.ts.
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://jurmaq.cl";

  // --- Main site pages ---
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/empresas`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/nosotros`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
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

  // --- Arriendo ---
  // Las landings, fichas y guías se mudaron a rental.jurmaq.cl (sitemap propio).
  // jurmaq.cl responde 301 (ver lib/redireccion-arriendo.ts) y listar una URL
  // que redirige es una señal sucia para Google.

  // --- Proyectos (case studies B2B) ---
  // YA NO van en este sitemap: se mudaron a constructora.jurmaq.cl, que es el
  // sitio de obras civiles. jurmaq.cl/proyectos/* hace 301 hacia allá (ver
  // middleware), y listar una URL que redirige es una señal sucia para Google.
  // Su sitemap propio está en apps/constructora/src/app/constructora/sitemap.ts.

  return staticPages;
}
