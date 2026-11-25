/**
 * Lo que se le muestra a Jorge en la pantalla de autorización, en palabras
 * simples. Las piezas que agregan herramientas actualizan estas listas para
 * que lo prometido coincida con lo que Claude realmente puede hacer.
 */
export const PUEDE: readonly string[] = [
  "Ver los productos, precios, categorías y ventas de la tienda.",
  "Cambiar precios, ofertas y textos de la tienda cuando tú se lo pidas.",
  "Prepararte cambios grandes y mostrártelos antes de aplicarlos.",
];

export const NO_PUEDE: readonly string[] = [
  "Ver ni cambiar contraseñas, claves ni usuarios del panel.",
  "Cobrar, devolver ni mover dinero.",
  "Borrar pedidos ni clientes.",
  "Hacer cambios grandes o riesgosos sin tu aprobación por correo (más de 300 productos, un precio que se mueva más de 30 %, precios bajo el costo, descuentos, despacho, términos legales).",
];

export const NOTAS: readonly string[] = [
  "Cada cambio queda anotado y lo puedes deshacer desde Administración, Conexiones.",
  "Puedes cortar el acceso de Claude cuando quieras, en la misma pantalla.",
];
