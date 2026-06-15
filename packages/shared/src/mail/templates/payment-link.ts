import { transporter } from "../transport";
import { renderEmailLayout, renderButton, renderOrderItems, BRAND } from "../layout";
import { formatCLP, escapeHtml } from "../utils";
import { env } from "@jurmaq/shared/env";

/**
 * Email con link de pago tras aprobación de cotización.
 *
 * Soporta dos modos:
 *  - 'mercadopago': Link al checkout MP que el cliente abre y paga
 *  - 'efectivo': Datos bancarios para transferencia (BANK_NAME/ACCOUNT/RUT
 *    deben estar configurados en env vars o lanza error)
 *
 * Usa el layout de marca compartido (../layout).
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
  const bankName = env.BANK_NAME;
  const bankAccount = env.BANK_ACCOUNT;
  const bankRut = env.BANK_RUT;
  const bankEmail = env.BANK_EMAIL || "contacto@jurmaq.cl";

  if (method === "efectivo" && (!bankName || !bankAccount || !bankRut)) {
    console.error("Faltan datos bancarios en variables de entorno: BANK_NAME, BANK_ACCOUNT, BANK_RUT");
    throw new Error("Datos bancarios no configurados. Configure BANK_NAME, BANK_ACCOUNT y BANK_RUT en las variables de entorno.");
  }

  const paymentSection =
    method === "mercadopago"
      ? `
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:${BRAND.text};">
        Tu cotización ha sido aprobada. Haz clic en el botón para completar tu pago de forma segura con MercadoPago:
      </p>
      <div style="margin-bottom:10px;">${renderButton({ href: paymentUrl, label: "Pagar con MercadoPago" })}</div>
      <p style="margin:0 0 28px;text-align:center;color:${BRAND.textMuted};font-size:13px;">
        Aceptamos tarjetas de crédito, débito y transferencia bancaria.
      </p>
    `
      : `
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:${BRAND.text};">
        Tu cotización ha sido aprobada. Realiza una transferencia bancaria con los siguientes datos:
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f8fa;border:1px solid ${BRAND.border};border-radius:10px;margin-bottom:16px;">
        <tr><td style="padding:18px 22px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:6px 0;color:${BRAND.textMuted};font-size:14px;width:120px;">Banco</td>
              <td style="padding:6px 0;color:${BRAND.text};font-size:14px;font-weight:700;">${escapeHtml(bankName ?? "")}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:${BRAND.textMuted};font-size:14px;">Cuenta</td>
              <td style="padding:6px 0;color:${BRAND.text};font-size:14px;font-weight:700;">${escapeHtml(bankAccount ?? "")}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:${BRAND.textMuted};font-size:14px;">RUT</td>
              <td style="padding:6px 0;color:${BRAND.text};font-size:14px;font-weight:700;">${escapeHtml(bankRut ?? "")}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:${BRAND.textMuted};font-size:14px;">Email</td>
              <td style="padding:6px 0;color:${BRAND.text};font-size:14px;font-weight:700;">${escapeHtml(bankEmail)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:${BRAND.textMuted};font-size:14px;">Monto</td>
              <td style="padding:6px 0;color:${BRAND.orange};font-size:18px;font-weight:800;">${formatCLP(cotizacion.total)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:${BRAND.textMuted};font-size:14px;">Asunto</td>
              <td style="padding:6px 0;color:${BRAND.text};font-size:14px;font-weight:700;">${escapeHtml(cotizacion.numero)}</td>
            </tr>
          </table>
        </td></tr>
      </table>
      <p style="margin:0 0 28px;color:#9a3412;font-size:13px;font-weight:500;line-height:1.5;">
        Importante: incluye el número de cotización (${escapeHtml(cotizacion.numero)}) en el asunto de la transferencia para identificar tu pago.
      </p>
    `;

  const items = renderOrderItems(
    cotizacion.items.map((item) => ({
      nombre: item.nombre,
      cantidad: item.cantidad,
      precio: item.precio,
    }))
  );

  const body = `
    <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${BRAND.orange};">Cotización aprobada · Link de pago</p>
    <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:${BRAND.navy};font-weight:800;">Cotización #${escapeHtml(cotizacion.numero)}</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${BRAND.text};">
      Hola <strong>${escapeHtml(cotizacion.nombre)}</strong>,
    </p>

    ${paymentSection}

    <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:${BRAND.navy};">Resumen de tu pedido</p>
    ${items}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
      <tr>
        <td style="padding:12px 0 0;font-size:16px;font-weight:800;color:${BRAND.navy};text-align:right;">Total</td>
        <td style="padding:12px 0 0;font-size:18px;font-weight:800;color:${BRAND.orange};text-align:right;white-space:nowrap;width:120px;">${formatCLP(cotizacion.total)}</td>
      </tr>
    </table>

    <p style="margin:28px 0 12px;font-size:14px;line-height:1.6;color:${BRAND.text};">¿Tienes dudas con tu pago? Escríbenos y te ayudamos.</p>
    <div class="jm-btn">${renderButton({ href: `https://wa.me/56976673577?text=Hola%2C%20consulto%20por%20mi%20cotizacion%20%23${encodeURIComponent(cotizacion.numero)}`, label: "Escríbenos por WhatsApp", color: "whatsapp" })}</div>
  `;

  const title =
    method === "mercadopago"
      ? `Link de pago · Cotización ${cotizacion.numero}`
      : `Datos de transferencia · Cotización ${cotizacion.numero}`;

  const preheader =
    method === "mercadopago"
      ? `Tu cotización #${cotizacion.numero} fue aprobada. Completa tu pago con MercadoPago.`
      : `Tu cotización #${cotizacion.numero} fue aprobada. Datos para transferir: ${formatCLP(cotizacion.total)}.`;

  const html = renderEmailLayout({
    title,
    preheader,
    bodyHtml: body,
  });

  const subject =
    method === "mercadopago"
      ? `Link de Pago - Cotizacion ${cotizacion.numero} - JURMAQ Barraca`
      : `Datos de Transferencia - Cotizacion ${cotizacion.numero} - JURMAQ Barraca`;

  await transporter.sendMail({
    to,
    subject,
    html,
  });
}
