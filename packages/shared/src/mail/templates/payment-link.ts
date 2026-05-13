import { transporter } from "../transport";
import { formatCLP } from "../utils";

/**
 * Email con link de pago tras aprobación de cotización.
 *
 * Soporta dos modos:
 *  - 'mercadopago': Link al checkout MP que el cliente abre y paga
 *  - 'efectivo': Datos bancarios para transferencia (BANK_NAME/ACCOUNT/RUT
 *    deben estar configurados en env vars o lanza error)
 */
export async function sendPaymentLinkEmail(
  to: string,
  cotizacion: {
    numero: string;
    nombre: string;
    items: Array<{ nombre: string; cantidad: number; precio: number; subtotal: number }>;
    total: number;
  },
  paymentUrl: string,
  method: "mercadopago" | "efectivo"
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

  const bankName = process.env.BANK_NAME;
  const bankAccount = process.env.BANK_ACCOUNT;
  const bankRut = process.env.BANK_RUT;
  const bankEmail = process.env.BANK_EMAIL || "contacto@jurmaq.cl";

  if (method === "efectivo" && (!bankName || !bankAccount || !bankRut)) {
    console.error("Faltan datos bancarios en variables de entorno: BANK_NAME, BANK_ACCOUNT, BANK_RUT");
    throw new Error("Datos bancarios no configurados. Configure BANK_NAME, BANK_ACCOUNT y BANK_RUT en las variables de entorno.");
  }

  const paymentSection =
    method === "mercadopago"
      ? `
      <div style="text-align: center; margin: 24px 0;">
        <p style="color: #374151; font-size: 15px; margin: 0 0 16px;">
          Tu cotizacion ha sido aprobada. Haz click en el boton para completar tu pago de forma segura con MercadoPago:
        </p>
        <a href="${paymentUrl}" style="display: inline-block; background-color: #009ee3; color: #ffffff; padding: 16px 40px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px;">
          Pagar con MercadoPago
        </a>
        <p style="margin: 12px 0 0; color: #6b7280; font-size: 13px;">
          Aceptamos tarjetas de credito, debito y transferencia bancaria.
        </p>
      </div>
    `
      : `
      <div style="margin: 24px 0;">
        <p style="color: #374151; font-size: 15px; margin: 0 0 16px;">
          Tu cotizacion ha sido aprobada. Realiza una transferencia bancaria con los siguientes datos:
        </p>
        <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding: 6px 0; color: #6b7280; font-size: 14px; width: 140px;">Banco:</td>
              <td style="padding: 6px 0; color: #1f2937; font-size: 14px; font-weight: 600;">${bankName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Cuenta:</td>
              <td style="padding: 6px 0; color: #1f2937; font-size: 14px; font-weight: 600;">${bankAccount}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">RUT:</td>
              <td style="padding: 6px 0; color: #1f2937; font-size: 14px; font-weight: 600;">${bankRut}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Email:</td>
              <td style="padding: 6px 0; color: #1f2937; font-size: 14px; font-weight: 600;">${bankEmail}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Monto:</td>
              <td style="padding: 6px 0; color: #ea580c; font-size: 18px; font-weight: 700;">${formatCLP(cotizacion.total)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Asunto:</td>
              <td style="padding: 6px 0; color: #1f2937; font-size: 14px; font-weight: 600;">${cotizacion.numero}</td>
            </tr>
          </table>
        </div>
        <p style="margin: 12px 0 0; color: #9a3412; font-size: 13px; font-weight: 500;">
          Importante: Incluye el numero de cotizacion (${cotizacion.numero}) en el asunto de la transferencia para identificar tu pago.
        </p>
      </div>
    `;

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
                <div style="display: inline-block; background-color: #dbeafe; border-radius: 50%; width: 56px; height: 56px; line-height: 56px; text-align: center; margin-bottom: 12px;">
                  <span style="font-size: 24px;">&#128179;</span>
                </div>
                <h2 style="margin: 0; color: #0c1d3a; font-size: 22px; font-weight: 700;">Cotizacion Aprobada - Link de Pago</h2>
                <p style="margin: 8px 0 0; color: #ea580c; font-size: 16px; font-weight: 600;">#${cotizacion.numero}</p>
              </div>

              <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
                Hola <strong>${cotizacion.nombre}</strong>,
              </p>

              ${paymentSection}

              <h3 style="color: #0c1d3a; font-size: 16px; font-weight: 600; margin: 24px 0 12px;">Resumen de tu pedido</h3>
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

  const subject =
    method === "mercadopago"
      ? `Link de Pago - Cotizacion ${cotizacion.numero} - JURMAQ Barraca`
      : `Datos de Transferencia - Cotizacion ${cotizacion.numero} - JURMAQ Barraca`;

  await transporter.sendMail({
    to,
    subject,
    html: htmlContent,
  });
}
