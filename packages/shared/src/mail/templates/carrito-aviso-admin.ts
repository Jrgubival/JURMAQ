import { transporter } from "../transport";
import { formatCLP, escapeHtml } from "../utils";
import { env } from "@jurmaq/shared/env";
import { avisosBarraca } from "../barraca";
import { URL_BARRACA, botonesContacto, listaProductos, filaDato, limpiarAsunto, type ItemAviso } from "../aviso-contacto";

/** Aviso interno: alguien dejó un carrito grande sin pagar y hay forma de contactarlo. */
export async function sendCarritoAvisoAdminEmail(carrito: {
  email?: string;
  telefono?: string;
  total: number;
  items: ItemAviso[];
}) {
  const base = URL_BARRACA(env.NEXT_PUBLIC_BARRACA_URL);
  const mensaje = "Hola, soy Jorge de la Barraca JURMAQ. Vi que dejaste productos en tu carrito en la página. ¿Te ayudo a terminar la compra o a cotizar?";
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:16px 8px;"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;">
      <tr><td style="padding:22px 22px 8px 22px;">
        <p style="margin:0 0 2px 0;color:#6b7280;font-size:13px;">Carrito sin pagar</p>
        <p style="margin:0 0 14px 0;color:#0c1d3a;font-size:26px;font-weight:800;">${formatCLP(carrito.total)}</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${filaDato("Teléfono", carrito.telefono ? escapeHtml(carrito.telefono) : "No dejó teléfono")}
          ${filaDato("Correo", carrito.email ? `<a href="mailto:${escapeHtml(carrito.email)}" style="color:#0c1d3a;">${escapeHtml(carrito.email)}</a>` : "No dejó correo")}
        </table>
        ${botonesContacto({ telefono: carrito.telefono, mensajeWhatsApp: mensaje, panelUrl: `${base}/admin` })}
      </td></tr>
      <tr><td style="padding:8px 22px 22px 22px;">
        <p style="margin:12px 0 6px 0;color:#0c1d3a;font-size:14px;font-weight:700;">Productos en el carrito</p>
        ${listaProductos(carrito.items)}
      </td></tr>
    </table>
    <p style="margin:12px 0 0 0;color:#9ca3af;font-size:11px;">Aviso automático de la tienda. Se manda una vez por carrito.</p>
  </td></tr></table>
</body></html>`;

  await transporter.sendMail({
    to: avisosBarraca(),
    subject: limpiarAsunto(`Carrito sin pagar · ${formatCLP(carrito.total)}${carrito.telefono ? "" : " · solo correo"}`),
    html,
  });
}
