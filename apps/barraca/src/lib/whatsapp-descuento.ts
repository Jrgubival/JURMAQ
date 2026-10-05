/**
 * Mensajes de WhatsApp para "Pide tu precio con descuento".
 *
 * Los precios del sitio son de LISTA; el descuento lo da el vendedor por
 * WhatsApp según producto y cantidad. Estos textos los escribió el dueño y se
 * respetan al pie de la letra.
 *
 * Archivo sin dependencias a propósito: lo usan la tarjeta de producto, la
 * ficha, el carrito y el drawer, todos componentes de cliente, y el helper
 * compartido de WhatsApp arrastra el módulo SEO completo al bundle.
 *
 * Codificación: encodeURIComponent convierte tildes y ñ a UTF-8 (%C3%B3…),
 * el guion largo "–" a %E2%80%93 y los saltos de línea a %0A, que es lo que
 * WhatsApp espera en `text=`. No usar URLSearchParams: codifica el espacio
 * como "+" y algunos clientes de WhatsApp lo dejan literal.
 */

/** +56 9 7667 3577 en formato wa.me (sin "+", sin espacios). */
export const TELEFONO_WHATSAPP = "56976673577";

export function urlWhatsapp(texto: string): string {
  return `https://wa.me/${TELEFONO_WHATSAPP}?text=${encodeURIComponent(texto)}`;
}

/**
 * "Hola, quiero precio con descuento para: [nombre] (código [SKU]) – cantidad: "
 *
 * La cantidad queda en blanco para que el cliente la escriba, salvo en la
 * ficha, donde ya la eligió en el selector.
 */
export function mensajeDescuentoProducto(nombre: string, codigo?: string | null, cantidad?: number): string {
  const cod = codigo && codigo.trim() ? ` (código ${codigo.trim()})` : "";
  const cant = cantidad && cantidad > 1 ? String(cantidad) : "";
  return `Hola, quiero precio con descuento para: ${nombre.trim()}${cod} – cantidad: ${cant}`;
}

export interface LineaCotizacion {
  nombre: string;
  codigo?: string | null;
  cantidad: number;
  /** Precio que cobra hoy el sitio (oferta si la hay). */
  precio: number;
  /** Precio normal tachado, cuando el producto está en oferta. */
  precio_tachado?: number | null;
}

const clp = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;

/** Tope de líneas: un link de WhatsApp muy largo se corta en algunos navegadores. */
const MAX_LINEAS = 40;

/**
 * La cotización completa: producto, cantidad y precio de lista de cada uno,
 * más el total de lista. Si un producto está en oferta se informa también el
 * precio de oferta, para que el vendedor no cotice por sobre lo que el cliente
 * ya vio en el sitio.
 */
export function mensajeDescuentoCotizacion(lineas: LineaCotizacion[]): string {
  const partes: string[] = ["Hola, quiero precio con descuento para mi cotización:", ""];
  let totalLista = 0;
  let totalSitio = 0;
  let hayOfertas = false;

  lineas.forEach((l, i) => {
    const lista = l.precio_tachado && l.precio_tachado > l.precio ? l.precio_tachado : l.precio;
    totalLista += lista * l.cantidad;
    totalSitio += l.precio * l.cantidad;
    if (i >= MAX_LINEAS) return;
    const cod = l.codigo && l.codigo.trim() ? ` (código ${l.codigo.trim()})` : "";
    let linea = `• ${l.nombre.trim()}${cod} – cantidad: ${l.cantidad} – precio de lista: ${clp(lista)} c/u`;
    if (lista > l.precio) {
      hayOfertas = true;
      linea += ` (en oferta a ${clp(l.precio)})`;
    }
    partes.push(linea);
  });

  if (lineas.length > MAX_LINEAS) {
    partes.push(`… y ${lineas.length - MAX_LINEAS} productos más (están en mi cotización de la web).`);
  }
  partes.push("", `Total de lista: ${clp(totalLista)}`);
  if (hayOfertas) partes.push(`Total con las ofertas de la web: ${clp(totalSitio)}`);
  return partes.join("\n");
}
