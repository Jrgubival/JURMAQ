/**
 * Slug helpers para URLs SEO-friendly de maquinarias.
 *
 * URL format: `/maquinarias/<slugified-nombre>-<id>`
 * Ejemplo: `/maquinarias/minicargador-cat-246c-9`
 *
 * El backend acepta ambos formatos (id puro o slug-id) para compatibilidad
 * con URLs viejas indexadas en Google.
 */

export function slugifyMaquinaria(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Construye el href público para una maquinaria.
 * Si solo se pasa `id`, devuelve la URL legacy /maquinarias/9 (sigue funcionando
 * pero pierde el bono SEO del slug).
 */
export function maquinariaHref(machine: { id: number | string; nombre?: string }): string {
  if (!machine.nombre) return `/maquinarias/${machine.id}`;
  return `/maquinarias/${slugifyMaquinaria(machine.nombre)}-${machine.id}`;
}

/**
 * Extrae el id numérico de cualquier formato de slug aceptado por
 * `/maquinarias/[id]`:
 *   - `"9"`                       → 9
 *   - `"minicargador-cat-246c-9"` → 9 (tail-id pattern, formato SEO)
 *   - `"minicargador-cat-246c"`   → null (slug puro sin id — requiere lookup por nombre)
 *
 * Usado por las rutas dinámicas de detalle y por la sub-ruta `/en/[ciudad]`
 * para no duplicar el regex.
 */
export function parseSlugId(slug: string): number | null {
  if (/^\d+$/.test(slug)) return Number(slug);
  const tail = slug.match(/-(\d+)$/);
  if (tail) return Number(tail[1]);
  return null;
}
