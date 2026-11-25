/**
 * INTERRUPTOR de las escrituras libres: cambios que hoy la IA hace SIN pedir el OK de Jorge
 * (todos quedan en la auditoría y se pueden deshacer). Es una decisión de diseño documentada en
 * docs/MCP-NOTAS.md (sección «Escrituras libres»). Si Jorge decide que alguna debe pedir aprobación,
 * se cambia aquí, en UN solo lugar, de `false` a `true`; no hay que tocar nada más:
 *
 *  - stock                  cambiar el stock de un producto (editar_producto).
 *  - activo                 mostrar u ocultar un producto (editar_producto).
 *  - editar_categoria       renombrar, reordenar, activar o desactivar una categoría.
 *  - confirmar_estado_pedido  cambiar el estado de un pedido (después de previsualizar).
 *  - subir_imagen           subir una imagen al bucket público de la tienda.
 *
 * Con `true`, la primera llamada manda el correo de aprobación a Jorge y no cambia nada; cuando él
 * aprueba, repetir la misma llamada la aplica (una sola vez, ligada al contenido exacto).
 */
export const ESCRITURAS_LIBRES_CON_APROBACION = {
  stock: false,
  activo: false,
  editar_categoria: false,
  confirmar_estado_pedido: false,
  subir_imagen: false,
};

/** ¿Esta herramienta (completa) debe pedir el OK de Jorge? Lo evalúa el servidor antes de ejecutarla. */
export function herramientaPideOk(nombre: string): boolean {
  switch (nombre) {
    case "editar_categoria": return ESCRITURAS_LIBRES_CON_APROBACION.editar_categoria;
    case "confirmar_estado_pedido": return ESCRITURAS_LIBRES_CON_APROBACION.confirmar_estado_pedido;
    case "subir_imagen": return ESCRITURAS_LIBRES_CON_APROBACION.subir_imagen;
    default: return false;
  }
}

/** ¿Alguno de estos campos de un producto debe pedir el OK de Jorge? (stock y activo). */
export function camposDeProductoPidenOk(campos: readonly string[]): boolean {
  return (ESCRITURAS_LIBRES_CON_APROBACION.stock && campos.includes("stock")) ||
    (ESCRITURAS_LIBRES_CON_APROBACION.activo && campos.includes("activo"));
}
