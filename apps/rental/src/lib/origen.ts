/**
 * Chequeo CSRF de rental. Misma regla de @jurmaq/shared/sanitize: host exacto
 * contra una lista, nunca contra el Host de la petición. Lista propia porque
 * el Worker de prueba vive en un host de workers.dev.
 */
const PERMITIDOS = new Set(
  ['rental.jurmaq.cl', ...(process.env.ORIGENES_PERMITIDOS ?? '').split(',')]
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),
);

export function origenValido(request: { headers: { get(name: string): string | null } }): boolean {
  const fuente = request.headers.get('origin') ?? request.headers.get('referer');
  if (!fuente) return false;
  try {
    return PERMITIDOS.has(new URL(fuente).host.toLowerCase());
  } catch {
    return false;
  }
}
