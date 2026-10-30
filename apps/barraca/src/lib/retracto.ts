import lista from '@/data/sin-retracto.json';

/**
 * Productos sin derecho a retracto (Términos y Condiciones 11.5): hechos según
 * las especificaciones del cliente (cortes a medida, pintura entonada). La
 * lista la decide el dueño en src/data/sin-retracto.json, por código.
 * Devuelve el motivo, o null si el producto sí tiene retracto.
 */
const PRODUCTOS = lista.productos as Record<string, string>;

export function motivoSinRetracto(codigo: string | null | undefined): string | null {
  if (!codigo) return null;
  return PRODUCTOS[String(codigo).trim()] ?? null;
}
