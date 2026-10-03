import { MetadataRoute } from "next";

const DISALLOW = [
  "/admin/",
  "/api/",
  "/cuenta/",
  "/carrito",
  "/cotizar",
  // Búsquedas y variantes con filtros: contenido duplicado de la categoría
  // (que ya tiene canonical) y miles de URLs para rastrear. La categoría sin
  // filtros y las fichas siguen abiertas, y el sitemap lista las fichas.
  "/buscar",
  "/*?*sort=",
  "/*?*stock=",
  "/*?*min=",
  "/*?*max=",
  "/*?*page=",
  "/*?*q=",
];

// Rastreadores que no traen clientes y consumen cuota de Vercel/Supabase:
// herramientas SEO de terceros y crawlers de entrenamiento de IA. Los
// buscadores y los crawlers de búsqueda de IA (citas en ChatGPT, Perplexity,
// Gemini) siguen permitidos más abajo.
const BLOQUEADOS = [
  "AhrefsBot",
  "SemrushBot",
  "MJ12bot",
  "DotBot",
  "BLEXBot",
  "DataForSeoBot",
  "PetalBot",
  "Bytespider",
  "GPTBot",
  "CCBot",
  "meta-externalagent",
  "Amazonbot",
  "ImagesiftBot",
  "Barkrowler",
  "SeekportBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // crawlDelay sólo para el resto; Google y Bing tienen su propio bloque.
      { userAgent: "*", allow: "/", disallow: DISALLOW, crawlDelay: 5 },
      ...BLOQUEADOS.map((ua) => ({ userAgent: ua, disallow: "/" })),
      { userAgent: "Googlebot", allow: "/", disallow: DISALLOW },
      { userAgent: "Bingbot", allow: "/", disallow: DISALLOW },
      { userAgent: "Googlebot-Image", allow: ["/", "/icon-192.png", "/icon-512.png"], disallow: DISALLOW },
      // AI search crawlers (ChatGPT/Perplexity/Gemini citaciones).
      // Decidimos permitirles indexar todo público — bloquear los saca de
      // las citaciones cuando un usuario pregunta "¿dónde comprar fierro
      // en Curicó?". Mismas DISALLOW que Googlebot para coherencia.
      { userAgent: "OAI-SearchBot", allow: "/", disallow: DISALLOW },
      { userAgent: "PerplexityBot", allow: "/", disallow: DISALLOW },
      { userAgent: "Google-Extended", allow: "/", disallow: DISALLOW },
      { userAgent: "ClaudeBot", allow: "/", disallow: DISALLOW },
      { userAgent: "GoogleOther", allow: "/", disallow: DISALLOW },
    ],
    sitemap: [
      "https://jurmaq.cl/sitemap.xml",
      "https://barraca.jurmaq.cl/sitemap.xml",
    ],
    host: "https://barraca.jurmaq.cl",
  };
}
