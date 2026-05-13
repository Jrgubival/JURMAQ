import { transporter } from "../transport";
import { formatCLP } from "../utils";

/**
 * Email "cotización recibida" al cliente final tras submit del formulario
 * de barraca. Confirmación + ETA de respuesta + tabla de items.
 */
export async function sendCotizacionEmail(
  to: string,
  cotizacion: {
    numero: string;
    nombre: string;
    items: Array<{ nombre: string; cantidad: number; precio: number; subtotal: number }>;
    total: number;
  }
) {
  const itemsRows = cotizacion.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #1f2937; font-size: 14px;">${item.nombre}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #1f2937; font-size: 14px; text-align: center;">${item.cantidad}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #1f2937; font-size: 14px; text-align: right;">${formatCLP(item.precio)}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; color: #1f2937; font-size: 14px; text-align: right; font-weight: 600;">${formatCLP(item.subtotal)}</td>
    </tr>`
    )
    .join("");

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
              <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; background-color: #fff7ed; border-radius: 50%; width: 56px; height: 56px; line-height: 56px; text-align: center; margin-bottom: 12px;">
                  <span style="font-size: 24px;">&#9989;</span>
                </div>
                <h2 style="margin: 0; color: #0c1d3a; font-size: 22px; font-weight: 700;">Cotizacion Recibida</h2>
                <p style="margin: 8px 0 0; color: #ea580c; font-size: 16px; font-weight: 600;">#${cotizacion.numero}</p>
              </div>

              <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
                Hola <strong>${cotizacion.nombre}</strong>,<br>
                Gracias por confiar en nosotros. Hemos recibido tu solicitud de cotizacion y ya estamos trabajando en ella. A continuacion el detalle de los productos solicitados:
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 20px;">
                <thead>
                  <tr style="background-color: #0c1d3a;">
                    <th style="padding: 10px 12px; color: #ffffff; font-size: 13px; font-weight: 600; text-align: left;">Producto</th>
                    <th style="padding: 10px 12px; color: #ffffff; font-size: 13px; font-weight: 600; text-align: center;">Cant.</th>
                    <th style="padding: 10px 12px; color: #ffffff; font-size: 13px; font-weight: 600; text-align: right;">Precio Unit.</th>
                    <th style="padding: 10px 12px; color: #ffffff; font-size: 13px; font-weight: 600; text-align: right;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsRows}
                </tbody>
                <tfoot>
                  <tr style="background-color: #f9fafb;">
                    <td colspan="3" style="padding: 12px; font-size: 15px; font-weight: 700; color: #0c1d3a; text-align: right;">Total</td>
                    <td style="padding: 12px; font-size: 18px; font-weight: 700; color: #ea580c; text-align: right;">${formatCLP(cotizacion.total)}</td>
                  </tr>
                </tfoot>
              </table>

              <div style="background-color: #eff6ff; border-radius: 8px; padding: 16px; margin-bottom: 20px; text-align: center;">
                <p style="margin: 0; color: #1e40af; font-size: 15px; font-weight: 600; line-height: 1.5;">
                  &#9200; Revisaremos tu pedido y te contactaremos en menos de 2 horas
                </p>
              </div>

              <div style="background-color: #fff7ed; border-left: 4px solid #ea580c; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
                <p style="margin: 0; color: #9a3412; font-size: 14px; line-height: 1.5;">
                  <strong>Nota:</strong> Los precios son referenciales y pueden variar. Nos comunicaremos contigo para confirmar disponibilidad, valores finales y coordinar la entrega.
                </p>
              </div>

              <div style="text-align: center; margin-bottom: 24px;">
                <a href="https://wa.me/56976673577?text=Hola%2C%20consulto%20por%20mi%20cotizacion%20%23${cotizacion.numero}" style="display: inline-block; background-color: #25D366; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
                  Escribenos por WhatsApp
                </a>
              </div>

              <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; text-align: center;">
                <p style="margin: 0 0 8px; color: #0c1d3a; font-size: 14px; font-weight: 600;">Contacto</p>
                <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.8;">
                  Tel: +56 9 7667 3577<br>
                  Email: contacto@jurmaq.cl<br>
                  Av. Poniente 2157, Molina, Maule, Chile
                </p>
              </div>

              <div style="text-align: center; margin-top: 20px; padding: 12px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0; color: #6b7280; font-size: 12px; font-style: italic;">
                  Mas de 25 anos atendiendo en la Region del Maule
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
                Este correo fue enviado automaticamente. No responder a esta direccion.
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
    subject: `Cotizacion ${cotizacion.numero} - JURMAQ Barraca`,
    html: htmlContent,
  });
}
