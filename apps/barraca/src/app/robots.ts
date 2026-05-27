import { MetadataRoute } from "next";

const DISALLOW = [
  "/admin/",
  "/api/",
  "/cuenta/",
  "/carrito",
  "/cotizar",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
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
