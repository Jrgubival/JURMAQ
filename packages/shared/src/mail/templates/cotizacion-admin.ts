import { transporter } from "../transport";
import { formatCLP, escapeHtml } from "../utils";
import { env } from "@jurmaq/shared/env";

/**
 * Notificación al admin/equipo cuando entra una cotización nueva.
 * Si el monto >= 500.000 CLP, prepende un banner urgente.
 */
export async function sendCotizacionAdminEmail(cotizacion: {
  numero: string;
  nombre: string;
  email: string;
  telefono: string;
  total: number;
  itemCount: number;
}) {
  const isLargeOrder = cotizacion.total >= 500000;
  const urgencyBanner = isLargeOrder
    ? `
              <div style="background-color: #dc2626; border-radius: 8px; padding: 12px; margin-bottom: 16px; text-align: center;">
                <p style="margin: 0; color: #ffffff; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">&#9888; PEDIDO GRANDE - ATENCION PRIORITARIA</p>
              </div>`
    : "";

  const adminHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
          <tr>
            <td style="background-color: ${isLargeOrder ? "#7f1d1d" : "#0c1d3a"}; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px;">${isLargeOrder ? "&#9888; " : ""}Nueva Cotizacion Recibida</h1>
            </td>
          </tr>
          <tr>
            <td style="background-color: #ffffff; padding: 32px;">
              ${urgencyBanner}
              <div style="background-color: #fff7ed; border-radius: 8px; padding: 16px; margin-bottom: 20px; text-align: center;">
                <p style="margin: 0; color: #ea580c; font-size: 22px; font-weight: 700;">#${cotizacion.numero}</p>
              </div>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 120px;">Cliente:</td>
                  <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 600;">${escapeHtml(cotizacion.nombre)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Email:</td>
                  <td style="padding: 8px 0; color: #1f2937; font-size: 14px;"><a href="mailto:${encodeURIComponent(cotizacion.email)}" style="color: #ea580c;">${escapeHtml(cotizacion.email)}</a></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Telefono:</td>
                  <td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${cotizacion.telefono ? escapeHtml(cotizacion.telefono) : "No proporcionado"}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Productos:</td>
                  <td style="padding: 8px 0; color: #1f2937; font-size: 14px;">${cotizacion.itemCount} items</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Total:</td>
                  <td style="padding: 8px 0; color: #ea580c; font-size: 18px; font-weight: 700;">${formatCLP(cotizacion.total)}</td>
                </tr>
              </table>

              <div style="text-align: center;">
                <a href="${env.NEXTAUTH_URL || "http://localhost:3000"}/admin/barraca/cotizaciones" style="display: inline-block; background-color: #ea580c; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                  Ver en Panel Admin
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #0c1d3a; padding: 16px; text-align: center; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; color: #6b7280; font-size: 11px;">JURMAQ Sistema - Notificacion automatica</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  await transporter.sendMail({
    to: env.ADMIN_EMAIL || "contacto@jurmaq.cl",
    subject: `${isLargeOrder ? "[URGENTE] " : ""}Nueva Cotizacion ${cotizacion.numero} - ${cotizacion.nombre} - ${formatCLP(cotizacion.total)}`,
    html: adminHtml,
  });
}
