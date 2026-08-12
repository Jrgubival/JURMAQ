import { MetadataRoute } from 'next';
import { SERVICIOS_OBRAS } from '@/lib/servicios-obras-data';
import { PROYECTOS } from '@/lib/proyectos-data';
import { COMUNAS_OBRA, CONSTRUCTORA_URL } from '@/lib/constructora-site';

/**
 * Sitemap de constructora.jurmaq.cl.
 *
 * Next lo genera en `/constructora/sitemap.xml`; el middleware lo sirve en
 * `constructora.jurmaq.cl/sitemap.xml`, que es la URL que declara robots.txt
 * y la que se envía a Search Console.
 *
 * Todas las URLs se escriben contra `CONSTRUCTORA_URL` —nunca contra
 * jurmaq.cl— porque un sitemap que lista URLs de otro host es ignorado.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = CONSTRUCTORA_URL;
  const now = new Date();

  const estaticas: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    {
      url: `${base}/servicios`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${base}/proyectos`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${base}/nosotros`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.7,
    },
    {
      url: `${base}/cotizar-obra`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.85,
    },
  ];

  const servicios: MetadataRoute.Sitemap = SERVICIOS_OBRAS.map((s) => ({
    url: `${base}/servicios/${s.slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.85,
  }));

  const comunas: MetadataRoute.Sitemap = COMUNAS_OBRA.map((c) => ({
    url: `${base}/obras-civiles-en/${c.slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    // Curicó es la comuna base: es la query con más volumen y la que mejor
    // convierte, así que va con prioridad más alta que el resto.
    priority: c.distanciaKm === 0 ? 0.9 : 0.75,
  }));

  const proyectos: MetadataRoute.Sitemap = PROYECTOS.map((p) => ({
    url: `${base}/proyectos/${p.slug}`,
    lastModified: new Date(p.fechaPublicacion),
    changeFrequency: 'yearly' as const,
    priority: 0.8,
  }));

  return [...estaticas, ...servicios, ...comunas, ...proyectos];
}
