-- La llave pública (anon) leía `costo` de barraca_productos vía PostgREST:
-- cualquiera podía ver el costo de compra de todos los productos.
-- Se pasa a permisos por columna: anon/authenticated leen todo menos `costo`.
-- El servidor usa service_role (no cambia). Aplicar DESPUÉS de publicar el
-- código que ya no pide '*' con la llave pública (lib/columnas-publicas.ts).
revoke select on public.barraca_productos from anon, authenticated;
grant select (
  id, codigo, nombre, slug, descripcion, precio, stock, peso, unidad,
  categoria_id, imagen, producto_padre_id, medida, activo, destacado,
  created_at, precio_original, en_oferta, solo_cotizar, oferta_fin,
  tamano_envio, largo_cm, ancho_cm, alto_cm, combo_cantidad, combo_precio
) on public.barraca_productos to anon, authenticated;
