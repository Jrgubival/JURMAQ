/**
 * Popup de "ventas online" tal como estaba escrito en código
 * (components/barraca/AvisoVentasOnline.tsx). Archivo liviano y sin
 * dependencias: lo usan el navegador (si /api/contenido/publico falla) y el
 * servidor (respaldo.ts). Es el respaldo: para cambiar el popup se usa D1.
 */
import type { PopupConfig } from "./tipos.ts";

/** Primer instante sin popup: 02-12-2026 00:00 de Chile (= FIN_AVISO_MS de lib/aviso-promo.ts). */
export const POPUP_HASTA_RESPALDO = "2026-12-02T00:00";

export const POPUP_RESPALDO: PopupConfig = {
  activo: true,
  imagen: "/aviso-bodega-perfiles.webp",
  titular: "Estamos recién partiendo con la venta en línea",
  texto: "Por eso, hasta el 1 de diciembre, comprar en la página sale más barato que en el local. Más de 900 productos con precio web.",
  botonPrincipal: { texto: "Ver precios web", enlace: "/categorias" },
  botonSecundario: "Ahora no",
  nota: "El precio web vale solo comprando en la página.",
  notaEnlace: { texto: "Condiciones", enlace: "/terminos#5-precios" },
  desde: null,
  hasta: POPUP_HASTA_RESPALDO,
  cadaDias: 7,
};
