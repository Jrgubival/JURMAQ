/**
 * Columnas de barraca_productos que puede leer la llave pública (anon).
 * `costo` NO está: es dato interno y la base no se lo da a anon
 * (migración 2026_11_01_barraca_productos_sin_costo_publico.sql). Toda consulta
 * con supabasePublic a barraca_productos debe pedir columnas de esta lista,
 * nunca '*'.
 */
export const COLUMNAS_PRODUCTO_PUBLICAS =
  'id, codigo, nombre, slug, descripcion, precio, stock, peso, unidad, categoria_id, imagen, producto_padre_id, medida, activo, destacado, created_at, precio_original, en_oferta, solo_cotizar, oferta_fin, tamano_envio, largo_cm, ancho_cm, alto_cm, combo_cantidad, combo_precio' as const;
