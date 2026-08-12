import { CONSTRUCTORA_URL } from '@/lib/constructora-site';

/**
 * robots.txt de constructora.jurmaq.cl.
 *
 * ## Por qué un Route Handler y no un `robots.ts`
 *
 * Next.js solo reconoce el archivo especial `robots.ts` en la RAÍZ de `app/`
 * — anidado en `app/constructora/` no genera nada y la URL da 404 (verificado).
 * `sitemap.ts` sí funciona anidado, así que ese quedó como archivo especial y
 * este como handler explícito. Ambos los sirve el middleware en la raíz del
 * subdominio (`constructora.jurmaq.cl/robots.txt`).
 *
 * El subdominio necesita su PROPIO robots.txt: `Host` y `Sitemap` tienen que
 * apuntar acá. Si devolviera el del hub, estaríamos declarando el sitemap de
 * jurmaq.cl y Google nunca descubriría las páginas de obra civil.
 */
export const dynamic = 'force-static';

const DISALLOW = ['/admin/', '/api/', '/cuenta/', '/contrato/'];

// Crawlers de IA incluidos a propósito: cuando alguien le pregunta a ChatGPT o
// Perplexity "¿qué constructora hace obra civil industrial en Curicó?",
// queremos ser citables, no estar bloqueados.
const AGENTS = [
  '*',
  'Googlebot',
  'Bingbot',
  'OAI-SearchBot',
  'PerplexityBot',
  'Google-Extended',
  'ClaudeBot',
  'GoogleOther',
];

export function GET(): Response {
  const bloques = AGENTS.map(
    (agent) =>
      [`User-Agent: ${agent}`, 'Allow: /', ...DISALLOW.map((d) => `Disallow: ${d}`)].join('\n')
  );

  const body = [
    ...bloques,
    `Host: ${CONSTRUCTORA_URL}`,
    `Sitemap: ${CONSTRUCTORA_URL}/sitemap.xml`,
    '',
  ].join('\n\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
