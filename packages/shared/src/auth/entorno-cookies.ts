/**
 * Decide si las cookies de sesión van en modo producción (`__Host-` + Secure) o en modo local (`dev-`).
 *
 * Por qué existe: el panel lee la cookie en dos lugares, la ruta /api/auth (que la escribe) y el
 * middleware de /admin (que la lee). Los dos tienen que llegar al MISMO nombre. En Cloudflare Workers el
 * middleware se empaqueta aparte y `NODE_ENV` no siempre llega por `process.env` (solo se reemplaza el
 * texto literal `process.env.NODE_ENV` al compilar). Si un lado decide «producción» y el otro «local», la
 * ruta escribe `__Host-barraca.session-token` y el middleware busca `dev-barraca.session-token`: el login
 * responde bien pero /admin nunca ve la sesión y vuelve a /login.
 *
 * Por eso se mira más de una señal, y basta una para ser producción. Nunca depende de una sola.
 */
export function esEntornoProduccion(senales: {
  /** El literal `process.env.NODE_ENV` (el compilador lo reemplaza). */
  nodeEnv?: string | undefined;
  /** Variable `DESPLIEGUE` de wrangler (`cloudflare` en la tienda publicada). */
  despliegue?: string | undefined;
  /** `AUTH_URL` o `NEXTAUTH_URL`, si existe. */
  authUrl?: string | undefined;
}): boolean {
  if (senales.nodeEnv === 'production') return true;
  if (senales.despliegue?.trim().toLowerCase() === 'cloudflare') return true;
  const url = senales.authUrl?.trim().toLowerCase();
  if (url && url.startsWith('https://')) return true;
  return false;
}
