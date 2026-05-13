import { transporter } from "../transport";
import { formatCLP } from "../utils";

/**
 * Email "te mejoramos el precio" — contraoferta tras revisar cotización
 * de competencia subida por el cliente. Tabla comparativa con ahorro
 * destacado + CTAs accept/reject (acepta-token o sin token según contexto).
 */
export async function sendContraofertaEmail(
  to: string,
  cotizacion: {
    numero: string;
    nombre: string;
    nombreCompetencia: string;
    itemsOriginales: Array<{ nombre: string; cantidad: number; precio: number }>;
    itemsContraoferta: Array<{ nombre: string; cantidad: number; precio: number }>;
    totalOriginal: number;
    totalContraoferta: number;
    mensaje: string;
    ahorroTotal: number;
    acceptToken?: string;
  }
) {
  const ahorroPercent =
    cotizacion.totalOriginal > 0
      ? Math.round((cotizacion.ahorroTotal / cotizacion.totalOriginal) * 100)
      : 0;

  const comparisonRows = cotizacion.itemsContraoferta
    .map((item, idx) => {
      const original = cotizacion.itemsOriginales[idx];
      const precioOriginal = original ? original.precio : item.precio;
      const ahorro = (precioOriginal - item.precio) * item.cantidad;
      return `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #1f2937; font-size: 13px;">${item.nombre}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #1f2937; font-size: 13px; text-align: center;">${item.cantidad}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #dc2626; font-size: 13px; text-align: right; text-decoration: line-through;">${formatCLP(precioOriginal)}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #16a34a; font-size: 13px; text-align: right; font-weight: 700;">${formatCLP(item.precio)}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #16a34a; font-size: 13px; text-align: right;">-${formatCLP(ahorro)}</td>
      </tr>`;
    })
    .join("");

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
          <tr>
            <td style="background-color: #0c1d3a; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">JURMAQ</h1>
              <p style="margin: 4px 0 0; color: #ea580c; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px;">Barraca</p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #ffffff; padding: 32px;">
              <div style="background: linear-gradient(135deg, #16a34a, #059669); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                <p style="margin: 0 0 4px; color: rgba(255,255,255,0.9); font-size: 14px;">Te mejoramos el precio de ${cotizacion.nombreCompetencia}</p>
                <p style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 800; letter-spacing: -1px;">Ahorras ${formatCLP(cotizacion.ahorroTotal)}</p>
                <p style="margin: 4px 0 0; color: rgba(255,255,255,0.9); font-size: 16px; font-weight: 600;">${ahorroPercent}% menos</p>
              </div>

              <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 8px;">
                Hola <strong>${cotizacion.nombre}</strong>,
              </p>
              <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
                Hemos revisado tu cotizacion de <strong>${cotizacion.nombreCompetencia}</strong> y te ofrecemos mejores precios en JURMAQ Barraca:
              </p>

              ${
                cotizacion.mensaje
                  ? `
              <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 14px 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
                <p style="margin: 0; color: #1e40af; font-size: 14px; line-height: 1.5;"><strong>Mensaje:</strong> ${cotizacion.mensaje}</p>
              </div>
              `
                  : ""
              }

              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
                <thead>
                  <tr style="background-color: #0c1d3a;">
                    <th style="padding: 10px 12px; color: #ffffff; font-size: 12px; font-weight: 600; text-align: left;">Producto</th>
                    <th style="padding: 10px 12px; color: #ffffff; font-size: 12px; font-weight: 600; text-align: center;">Cant.</th>
                    <th style="padding: 10px 12px; color: #fca5a5; font-size: 12px; font-weight: 600; text-align: right;">${cotizacion.nombreCompetencia}</th>
                    <th style="padding: 10px 12px; color: #86efac; font-size: 12px; font-weight: 600; text-align: right;">JURMAQ</th>
                    <th style="padding: 10px 12px; color: #86efac; font-size: 12px; font-weight: 600; text-align: right;">Ahorro</th>
                  </tr>
                </thead>
                <tbody>
                  ${comparisonRows}
                </tbody>
                <tfoot>
                  <tr style="background-color: #f0fdf4;">
                    <td colspan="2" style="padding: 14px 12px; font-size: 15px; font-weight: 700; color: #0c1d3a;">Total</td>
                    <td style="padding: 14px 12px; font-size: 15px; font-weight: 600; color: #dc2626; text-align: right; text-decoration: line-through;">${formatCLP(cotizacion.totalOriginal)}</td>
                    <td style="padding: 14px 12px; font-size: 18px; font-weight: 800; color: #16a34a; text-align: right;">${formatCLP(cotizacion.totalContraoferta)}</td>
                    <td style="padding: 14px 12px; font-size: 15px; font-weight: 700; color: #16a34a; text-align: right;">-${formatCLP(cotizacion.ahorroTotal)}</td>
                  </tr>
                </tfoot>
              </table>

              <div style="text-align: center; margin-bottom: 24px;">
                <a href="${baseUrl}/barraca/cotizacion/${cotizacion.numero}?action=accept${cotizacion.acceptToken ? `&token=${encodeURIComponent(cotizacion.acceptToken)}` : ""}" style="display: inline-block; background-color: #16a34a; color: #ffffff; padding: 16px 48px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px; margin-bottom: 12px;">
                  Aceptar Contraoferta
                </a>
                <br>
                <a href="${baseUrl}/barraca/cotizacion/${cotizacion.numero}?action=reject${cotizacion.acceptToken ? `&token=${encodeURIComponent(cotizacion.acceptToken)}` : ""}" style="color: #6b7280; font-size: 13px; text-decoration: underline;">
                  No, gracias. Rechazar contraoferta.
                </a>
              </div>

              <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; text-align: center;">
                <p style="margin: 0 0 8px; color: #0c1d3a; font-size: 14px; font-weight: 600;">Dudas? Contactanos</p>
                <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.8;">
                  WhatsApp: +56 9 7667 3577<br>
                  Email: contacto@jurmaq.cl
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #0c1d3a; padding: 20px 32px; text-align: center; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                &copy; ${new Date().getFullYear()} JURMAQ Barraca. Todos los derechos reservados.
              </p>
              <p style="margin: 4px 0 0; color: #6b7280; font-size: 11px;">
                Cotizacion #${cotizacion.numero}
              </p>
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
    to,
    subject: `Te mejoramos el precio de ${cotizacion.nombreCompetencia} - Cotizacion ${cotizacion.numero}`,
    html: htmlContent,
  });
}
