import { transporter } from "../transport";
import { renderEmailLayout, renderButton, renderOrderItems, BRAND } from "../layout";
import { formatCLP, escapeHtml } from "../utils";

/**
 * Email "cotización recibida" al cliente final tras submit del formulario
 * de barraca. Confirmación + ETA de respuesta + resumen de items.
 * Usa el layout de marca compartido (../layout).
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
  const itemsSummary = renderOrderItems(
    cotizacion.items.map((item) => ({
      nombre: item.nombre,
      cantidad: item.cantidad,
      precio: item.precio,
    }))
  );

  const whatsappHref = `https://wa.me/56976673577?text=Hola%2C%20consulto%20por%20mi%20cotizacion%20%23${encodeURIComponent(
    cotizacion.numero
  )}`;

  const body = `
    <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${BRAND.orange};">Cotización recibida</p>
    <h1 style="margin:0 0 4px;font-size:24px;line-height:1.25;color:${BRAND.navy};font-weight:800;">Gracias, ${escapeHtml(cotizacion.nombre)}</h1>
    <p style="margin:0 0 20px;font-size:15px;font-weight:700;color:${BRAND.orange};">N° ${escapeHtml(cotizacion.numero)}</p>

    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${BRAND.text};">
      Hemos recibido tu solicitud de cotización y ya estamos trabajando en ella. A continuación, el detalle de los productos solicitados:
    </p>

    ${itemsSummary}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 28px;">
      <tr>
        <td style="padding:14px 0 0;font-size:16px;font-weight:800;color:${BRAND.navy};">Total</td>
        <td style="padding:14px 0 0;font-size:18px;font-weight:800;color:${BRAND.orange};text-align:right;white-space:nowrap;">${formatCLP(cotizacion.total)}</td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f8fa;border:1px solid ${BRAND.border};border-radius:10px;margin-bottom:20px;">
      <tr><td style="padding:16px 22px;text-align:center;">
        <p style="margin:0;font-size:15px;font-weight:700;line-height:1.5;color:${BRAND.navy};">
          &#9200; Revisaremos tu pedido y te contactaremos en menos de 2 horas
        </p>
      </td></tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff7ed;border-left:4px solid ${BRAND.orange};border-radius:0 10px 10px 0;margin-bottom:28px;">
      <tr><td style="padding:14px 18px;">
        <p style="margin:0;font-size:13px;line-height:1.6;color:#9a3412;">
          <strong>Nota:</strong> Los precios son referenciales y pueden variar. Nos comunicaremos contigo para confirmar disponibilidad, valores finales y coordinar la entrega.
        </p>
      </td></tr>
    </table>

    <div class="jm-btn">${renderButton({ href: whatsappHref, label: "Escríbenos por WhatsApp", color: "whatsapp" })}</div>

    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:${BRAND.textMuted};text-align:center;">
      Más de 25 años atendiendo en la Región del Maule.
    </p>
  `;

  const html = renderEmailLayout({
    title: `Cotización ${cotizacion.numero} - JURMAQ Barraca`,
    preheader: `Recibimos tu cotización #${cotizacion.numero}. Te contactamos en menos de 2 horas.`,
    bodyHtml: body,
  });

  await transporter.sendMail({
    to,
    subject: `Cotizacion ${cotizacion.numero} - JURMAQ Barraca`,
    html,
  });
}
