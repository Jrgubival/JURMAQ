import { escapeHtml, telefonoWhatsApp, formatCLP } from "./utils";

/**
 * Piezas compartidas por los avisos internos de la barraca (cotización nueva,
 * carrito sin pagar): botones de WhatsApp y llamar, lista de productos.
 */

export const URL_BARRACA = (base?: string) => (base || "https://barraca.jurmaq.cl").replace(/\/+$/, "");

export type ItemAviso = { nombre?: string; cantidad?: number; precio?: number };

const boton = (href: string, texto: string, fondo: string) =>
  `<a href="${href}" style="display:inline-block;background-color:${fondo};color:#ffffff;padding:14px 22px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;margin:4px 6px 4px 0;">${texto}</a>`;

export function botonesContacto(opts: { telefono?: string | null; mensajeWhatsApp: string; panelUrl: string }): string {
  const wa = telefonoWhatsApp(opts.telefono);
  const tel = String(opts.telefono ?? "").replace(/[^\d+]/g, "");
  const partes: string[] = [];
  if (wa) {
    partes.push(boton(`https://wa.me/${wa}?text=${encodeURIComponent(opts.mensajeWhatsApp)}`, "Responder por WhatsApp", "#16a34a"));
    partes.push(boton(`tel:+${wa}`, "Llamar", "#0c1d3a"));
  } else if (tel.length >= 6) {
    partes.push(boton(`tel:${escapeHtml(tel)}`, "Llamar", "#0c1d3a"));
  }
  partes.push(
    `<a href="${escapeHtml(opts.panelUrl)}" style="display:inline-block;color:#0c1d3a;padding:14px 8px;font-size:15px;font-weight:600;text-decoration:underline;">Abrir en el panel</a>`,
  );
  return `<div style="margin:20px 0 4px 0;">${partes.join("")}</div>`;
}

export function listaProductos(items: ItemAviso[]): string {
  if (!items.length) return `<p style="margin:0;color:#6b7280;font-size:14px;">Sin detalle de productos.</p>`;
  const filas = items
    .map((it) => {
      const cant = Number(it.cantidad) || 1;
      const sub = it.precio ? ` <span style="color:#6b7280;">· ${formatCLP((Number(it.precio) || 0) * cant)}</span>` : "";
      return `<tr><td style="padding:6px 0;border-bottom:1px solid #e5e7eb;font-size:15px;color:#1f2937;"><strong>${cant} ×</strong> ${escapeHtml(it.nombre || "Producto")}${sub}</td></tr>`;
    })
    .join("");
  return `<table width="100%" cellpadding="0" cellspacing="0">${filas}</table>`;
}

export const filaDato = (etiqueta: string, valorHtml: string) =>
  `<tr><td style="padding:5px 0;color:#6b7280;font-size:14px;width:90px;vertical-align:top;">${etiqueta}</td><td style="padding:5px 0;color:#1f2937;font-size:15px;">${valorHtml}</td></tr>`;

export const limpiarAsunto = (s: string) => s.replace(/[\r\n]+/g, " ").trim().slice(0, 150);
