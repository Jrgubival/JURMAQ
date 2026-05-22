import { MetadataRoute } from "next";
// Audit A1: usar cliente publico (anon) en sitemap. Lecturas publicas no
// necesitan service_role; ademas reduce el blast-radius del admin client.
// barraca_categorias permite SELECT a anon (ver enable-rls.sql).
// Para productos usamos la vista publica barraca_productos_public que
// excluye `costo` (creada en harden-rls.js) ya que la tabla principal
// tiene REVOKE de anon.
import { supabasePublic } from "@jurmaq/shared/supabase";
import { GUIAS } from "@/lib/guias-seo-data";
import { COMPETIDORES_DATA } from "@/lib/competidores-data";

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
    // pSEO: calculadoras (alto valor SEO informacional, intent comercial)
    {
      url: `${baseUrl}/calculadoras`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/calculadora-fierro`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/calculadora-cemento`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/calculadora-hormigon`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/calculadora-pintura`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/calculadora-zincalum`,
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
    // Comparison landings (alta intención comercial)
    {
      url: `${baseUrl}/alternativa`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/te-mejoramos-el-precio`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.85,
    },
  ];

  // Comparison landings programáticas
  const alternativaUrls: MetadataRoute.Sitemap = COMPETIDORES_DATA.map((c) => ({
    url: `${baseUrl}/alternativa/${c.slug}`,
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
    .select('slug')
    .eq('activa', true);

  const categoryUrls: MetadataRoute.Sitemap = (categories || []).map((c: { slug: string }) => ({
    url: `${baseUrl}/categorias/${c.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // All active products via la vista publica (sin costo). Usamos updated_at
  // real si existe para señalar a Google qué páginas tienen contenido fresco
  // (cambio de precio, stock, descripción) y mejorar crawl prioritization.
  const { data: products } = await supabasePublic
    .from('barraca_productos_public')
    .select('slug, updated_at')
    .eq('activo', true);

  const productUrls: MetadataRoute.Sitemap = (products || []).map((p: { slug: string; updated_at?: string | null }) => ({
    url: `${baseUrl}/producto/${p.slug}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Tier 2 B1: páginas públicas de maestros referidos (link share que
  // arman maestros para sus clientes). Solo maestros activos.
  const { data: maestros } = await supabasePublic
    .from('maestros')
    .select('codigo')
    .eq('activo', true);

  const maestroUrls: MetadataRoute.Sitemap = (maestros || []).map((m: { codigo: string }) => ({
    url: `${baseUrl}/maestros/${m.codigo}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  return [
    ...staticPages,
    ...alternativaUrls,
    ...guiasUrls,
    ...categoryUrls,
    ...productUrls,
    ...maestroUrls,
  ];
}
