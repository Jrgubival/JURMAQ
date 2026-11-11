import { transporter } from "../transport";
import { formatCLP, escapeHtml } from "../utils";
import { env } from "@jurmaq/shared/env";
import { avisosBarraca } from "../barraca";
import { URL_BARRACA, botonesContacto, listaProductos, filaDato, limpiarAsunto, type ItemAviso } from "../aviso-contacto";

/**
 * Aviso interno de cotización nueva (llega a BARRACA_AVISOS_EMAIL, una o varias
 * casillas). Pensado para contestar desde el celular: datos arriba, productos,
 * y botones de WhatsApp y llamar. Si el total >= 500.000 va con banner urgente.
 */
export async function sendCotizacionAdminEmail(cotizacion: {
  numero: string;
  nombre: string;
  empresa?: string;
  email: string;
  telefono: string;
  total: number;
  itemCount: number;
  items?: ItemAviso[];
}) {
  const isLargeOrder = cotizacion.total >= 500000;
  const base = URL_BARRACA(env.NEXT_PUBLIC_BARRACA_URL);
  const panelUrl = `${base}/admin/cotizaciones`;
  const primerNombre = (cotizacion.nombre || "").trim().split(/\s+/)[0] || "";
  const mensaje = `Hola ${primerNombre}, soy Jorge de la Barraca JURMAQ. Recibí tu cotización N° ${cotizacion.numero}. Te la confirmo ahora.`;
  const items = cotizacion.items ?? [];

  const banner = isLargeOrder
    ? `<div style="background-color:#dc2626;border-radius:8px;padding:10px;margin-bottom:14px;text-align:center;color:#ffffff;font-size:13px;font-weight:700;letter-spacing:1px;">PEDIDO GRANDE · ATENCIÓN PRIORITARIA</div>`
    : "";

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:16px 8px;"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;">
      <tr><td style="padding:22px 22px 8px 22px;">
        ${banner}
        <p style="margin:0 0 2px 0;color:#6b7280;font-size:13px;">Cotización web nueva · N° ${escapeHtml(cotizacion.numero)}</p>
        <p style="margin:0 0 14px 0;color:#0c1d3a;font-size:26px;font-weight:800;">${formatCLP(cotizacion.total)}</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${filaDato("Cliente", `<strong>${escapeHtml(cotizacion.nombre)}</strong>`)}
          ${cotizacion.empresa ? filaDato("Empresa", escapeHtml(cotizacion.empresa)) : ""}
          ${filaDato("Teléfono", cotizacion.telefono ? escapeHtml(cotizacion.telefono) : "No dejó teléfono")}
          ${filaDato("Correo", `<a href="mailto:${escapeHtml(cotizacion.email)}" style="color:#0c1d3a;">${escapeHtml(cotizacion.email)}</a>`)}
        </table>
        ${botonesContacto({ telefono: cotizacion.telefono, mensajeWhatsApp: mensaje, panelUrl })}
      </td></tr>
      <tr><td style="padding:8px 22px 22px 22px;">
        <p style="margin:12px 0 6px 0;color:#0c1d3a;font-size:14px;font-weight:700;">Productos (${cotizacion.itemCount})</p>
        ${listaProductos(items)}
      </td></tr>
    </table>
    <p style="margin:12px 0 0 0;color:#9ca3af;font-size:11px;">Aviso automático de la tienda</p>
  </td></tr></table>
</body></html>`;

  await transporter.sendMail({
    to: avisosBarraca(),
    subject: limpiarAsunto(`${isLargeOrder ? "[URGENTE] " : ""}Cotización web nueva · ${formatCLP(cotizacion.total)} · ${cotizacion.nombre}`),
    html,
  });
}
