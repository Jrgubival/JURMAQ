/**
 * Búsqueda de candidatos de imágenes para productos de barraca.
 *
 * Estrategia en 2 capas:
 *   1. DuckDuckGo image search desde el browser (sin proxy server, sin
 *      consumir billable API calls). Usa flujo de 2 requests: token vqd
 *      → imágenes JSON. Pueden cambiar el HTML de DDG y el regex falla;
 *      por eso hay fallback.
 *   2. Server API curado (`/api/imagenes/search`) que devuelve
 *      imágenes pre-aprobadas por categoría.
 *
 * Antes vivía inline en /admin/barraca/imagenes/page.tsx (página de
 * 796 LOC). Mover el flujo a lib/ permite test unitario y reduce la
 * complejidad del page component.
 */

export interface ImageCandidate {
  url: string;
  alt: string;
  source: string;
}

/**
 * Limpia un nombre de producto para query de imagen: remueve dimensiones,
 * caracteres especiales, y agrega el sufijo "ferreteria producto" para
 * sesgar resultados a fotos de catálogo (no fotos de obra terminada).
 */
function buildImageQuery(productName: string): string {
  return (
    productName
      .replace(/\d+\s*(mm|cm|mt|kg|lt|pulg)/gi, "")
      .replace(/[xX×]/g, " ")
      .replace(/[^\w\sáéíóúñÁÉÍÓÚÑ]/g, "")
      .trim() + " ferreteria producto"
  );
}

/**
 * Extrae el token vqd de DuckDuckGo. DDG cambia el formato cada cierto
 * tiempo, por eso intentamos múltiples patrones antes de rendirnos.
 */
function extractVqdToken(html: string): string | null {
  for (const pat of [/vqd=([\d-]+)&/, /vqd='([\d-]+)'/, /vqd="([\d-]+)"/]) {
    const m = html.match(pat);
    if (m) return m[1];
  }
  return null;
}

/**
 * Busca imágenes en DuckDuckGo desde el browser. Retorna las primeras 6
 * candidatas o lanza si falla.
 *
 * NOTA: hace 2 fetches a duckduckgo.com con `credentials: 'omit'`. No
 * funciona en SSR (necesita `window`/`fetch` del browser).
 */
export async function searchDuckDuckGoImages(
  productName: string
): Promise<ImageCandidate[]> {
  const cleanQuery = buildImageQuery(productName);

  // Step 1: Get vqd token from DuckDuckGo
  const tokenRes = await fetch(
    `https://duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&ia=images&iax=images`,
    { credentials: "omit" }
  );
  const tokenHtml = await tokenRes.text();
  const vqd = extractVqdToken(tokenHtml);
  if (!vqd) throw new Error("vqd token not found in DuckDuckGo response");

  // Step 2: Fetch images JSON with the token
  const imgRes = await fetch(
    `https://duckduckgo.com/i.js?l=cl&o=json&q=${encodeURIComponent(cleanQuery)}&vqd=${vqd}&f=,,,,,&p=1`,
    { credentials: "omit" }
  );
  if (!imgRes.ok) throw new Error(`DuckDuckGo i.js returned ${imgRes.status}`);

  const imgData = await imgRes.json();
  const results = imgData?.results;
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error("DuckDuckGo returned no results");
  }

  return results.slice(0, 6).map((r: { image?: string; thumbnail?: string; title?: string }) => ({
    url: r.image || r.thumbnail || "",
    alt: r.title || productName,
    source: "DuckDuckGo",
  }));
}

/**
 * Búsqueda con fallback al server API curado. Esta es la API pública
 * que el page component debería usar — abstrae la decisión entre
 * DuckDuckGo (preferido) y server fallback.
 */
export async function searchImageCandidates(
  productName: string,
  fallbackEndpoint = "/api/imagenes/search"
): Promise<ImageCandidate[]> {
  try {
    const ddg = await searchDuckDuckGoImages(productName);
    if (ddg.length > 0) return ddg;
  } catch {
    // fall through to server API
  }
  try {
    const res = await fetch(
      `${fallbackEndpoint}?q=${encodeURIComponent(productName)}&limit=6`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.images) ? (data.images as ImageCandidate[]) : [];
  } catch {
    return [];
  }
}
