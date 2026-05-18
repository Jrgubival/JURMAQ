import { transporter } from "@jurmaq/shared/mail/email";
import { formatCLP } from "@jurmaq/shared/format";
const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';
const WHATSAPP_NUMBER = '56976673577';

// ============================================================
// Shared email layout helpers
// ============================================================

function emailHeader(): string {
  return `
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
          <!-- Header -->
          <tr>
            <td style="background-color: #0c1d3a; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">JURMAQ</h1>
              <p style="margin: 4px 0 0; color: #ea580c; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px;">Barraca</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color: #ffffff; padding: 32px;">`;
}

function emailFooter(options: { showUnsubscribe?: boolean } = {}): string {
  const unsubscribeLink = options.showUnsubscribe
    ? `<p style="margin: 8px 0 0;">
        <a href="${BASE_URL}/barraca/suscripcion/cancelar" style="color: #9ca3af; font-size: 11px; text-decoration: underline;">
          Cancelar suscripcion
        </a>
      </p>`
    : '';

  return `
              <!-- WhatsApp -->
              <div style="text-align: center; margin-top: 24px; margin-bottom: 16px;">
                <a href="https://wa.me/${WHATSAPP_NUMBER}" style="display: inline-block; background-color: #25D366; color: #ffffff; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 13px;">
                  Escribenos por WhatsApp
                </a>
              </div>

              <!-- Contact -->
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; text-align: center;">
                <p style="margin: 0; color: #6b7280; font-size: 12px; line-height: 1.8;">
                  Tel: +56 9 7667 3577 | contacto@jurmaq.cl<br>
                  Av. Poniente 2157, Molina, Maule, Chile
                </p>
                <p style="margin: 4px 0 0; color: #9ca3af; font-size: 11px; font-style: italic;">
                  Mas de 25 anos atendiendo en la Region del Maule
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0c1d3a; padding: 20px 32px; text-align: center; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                &copy; ${new Date().getFullYear()} JURMAQ Barraca. Todos los derechos reservados.
              </p>
              ${unsubscribeLink}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ============================================================
// 1. Follow-up email (send 24h after no response to a quote)
// ============================================================

export async function sendFollowUpEmail(to: string, cotizacion: {
  numero: string;
  nombre: string;
  items: Array<{ nombre: string; cantidad: number; precio: number; subtotal: number }>;
  total: number;
}) {
  const itemsRows = cotizacion.items.map(item => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: #1f2937; font-size: 13px;">${item.nombre}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: #1f2937; font-size: 13px; text-align: center;">${item.cantidad}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: #ea580c; font-size: 13px; text-align: right; font-weight: 600;">${formatCLP(item.subtotal)}</td>
    </tr>
  `).join('');

  const htmlContent = `
${emailHeader()}
              <!-- Icon -->
              <div style="text-align: center; margin-bottom: 20px;">
                <span style="font-size: 40px;">&#128172;</span>
              </div>

              <h2 style="margin: 0 0 8px; color: #0c1d3a; font-size: 20px; font-weight: 700; text-align: center;">
                Necesitas ayuda con tu cotizacion?
              </h2>
              <p style="margin: 0 0 4px; color: #ea580c; font-size: 15px; font-weight: 600; text-align: center;">
                #${cotizacion.numero}
              </p>

              <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 20px 0;">
                Hola <strong>${cotizacion.nombre}</strong>,<br><br>
                Notamos que aun no has respondido a tu cotizacion. Queremos asegurarnos de que tengas todo lo que necesitas. Si tienes dudas sobre precios, disponibilidad o formas de pago, estamos para ayudarte.
              </p>

              <!-- Items reminder -->
              <div style="margin-bottom: 20px;">
                <p style="color: #6b7280; font-size: 13px; font-weight: 600; margin: 0 0 8px;">Tu pedido incluye:</p>
                <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                  <thead>
                    <tr style="background-color: #f9fafb;">
                      <th style="padding: 8px 12px; color: #6b7280; font-size: 12px; font-weight: 600; text-align: left;">Producto</th>
                      <th style="padding: 8px 12px; color: #6b7280; font-size: 12px; font-weight: 600; text-align: center;">Cant.</th>
                      <th style="padding: 8px 12px; color: #6b7280; font-size: 12px; font-weight: 600; text-align: right;">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsRows}
                  </tbody>
                  <tfoot>
                    <tr style="background-color: #fff7ed;">
                      <td colspan="2" style="padding: 10px 12px; font-size: 14px; font-weight: 700; color: #0c1d3a; text-align: right;">Total</td>
                      <td style="padding: 10px 12px; font-size: 16px; font-weight: 700; color: #ea580c; text-align: right;">${formatCLP(cotizacion.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <!-- CTA -->
              <div style="text-align: center; margin-bottom: 16px;">
                <a href="mailto:contacto@jurmaq.cl?subject=Consulta%20cotizacion%20${cotizacion.numero}" style="display: inline-block; background-color: #ea580c; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
                  Responder este correo
                </a>
              </div>
              <p style="text-align: center; color: #6b7280; font-size: 13px; margin: 0;">
                O llamanos al <strong>+56 9 7667 3577</strong>
              </p>
${emailFooter()}`;

  await transporter.sendMail({
        to,
    subject: `Necesitas ayuda con tu cotizacion #${cotizacion.numero}? - JURMAQ Barraca`,
    html: htmlContent,
  });
}

// ============================================================
// 2. Abandoned cart email (user had items but didn't submit quote)
// ============================================================

export async function sendAbandonedCartEmail(to: string, items: Array<{
  nombre: string;
  cantidad: number;
  precio: number;
  imagen?: string;
}>) {
  const itemCards = items.slice(0, 6).map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            ${item.imagen ? `<td style="width: 60px; vertical-align: top;">
              <img src="${item.imagen}" alt="${item.nombre}" width="52" height="52" style="border-radius: 6px; object-fit: cover; display: block;" />
            </td>` : ''}
            <td style="vertical-align: middle; padding-left: ${item.imagen ? '12px' : '0'};">
              <p style="margin: 0 0 2px; color: #1f2937; font-size: 14px; font-weight: 600;">${item.nombre}</p>
              <p style="margin: 0; color: #6b7280; font-size: 13px;">
                Cantidad: ${item.cantidad} | ${formatCLP(item.precio)} c/u
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join('');

  const htmlContent = `
${emailHeader()}
              <!-- Icon -->
              <div style="text-align: center; margin-bottom: 20px;">
                <span style="font-size: 40px;">&#128722;</span>
              </div>

              <h2 style="margin: 0 0 8px; color: #0c1d3a; font-size: 20px; font-weight: 700; text-align: center;">
                Dejaste productos en tu carrito
              </h2>

              <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 16px 0 20px; text-align: center;">
                Notamos que estabas viendo algunos productos. Estan esperandote para cuando quieras completar tu pedido.
              </p>

              <!-- Items -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
                ${itemCards}
              </table>

              ${items.length > 6 ? `<p style="text-align: center; color: #6b7280; font-size: 13px; margin: 0 0 16px;">…y ${items.length - 6} producto(s) más</p>` : ''}

              <!-- CTA -->
              <div style="text-align: center; margin-bottom: 16px;">
                <a href="${BASE_URL}/barraca" style="display: inline-block; background-color: #ea580c; color: #ffffff; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px;">
                  Completar mi pedido
                </a>
              </div>

              <p style="text-align: center; color: #6b7280; font-size: 13px; margin: 0;">
                Los precios y disponibilidad pueden variar
              </p>
${emailFooter({ showUnsubscribe: true })}`;

  await transporter.sendMail({
        to,
    subject: 'Dejaste productos en tu carrito - JURMAQ Barraca',
    html: htmlContent,
  });
}

// ============================================================
// 3. Monthly newsletter/offers email
// ============================================================

export async function sendMonthlyOffersEmail(to: string, offers: Array<{
  nombre: string;
  precioAnterior?: number;
  precioOferta: number;
  imagen?: string;
  categoria?: string;
}>, mesAno?: string) {
  const displayMonth = mesAno || new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });

  // Build a 2-column grid for up to 6 products
  const visibleOffers = offers.slice(0, 6);
  let productGrid = '';

  for (let i = 0; i < visibleOffers.length; i += 2) {
    const left = visibleOffers[i];
    const right = visibleOffers[i + 1];

    const buildCard = (offer: typeof left) => {
      const hasDiscount = offer.precioAnterior && offer.precioAnterior > offer.precioOferta;
      const discountPercent = hasDiscount
        ? Math.round(((offer.precioAnterior! - offer.precioOferta) / offer.precioAnterior!) * 100)
        : 0;

      return `
        <td width="50%" style="padding: 8px; vertical-align: top;">
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; text-align: center;">
            ${offer.imagen
              ? `<img src="${offer.imagen}" alt="${offer.nombre}" width="260" style="width: 100%; height: 140px; object-fit: cover; display: block;" />`
              : `<div style="width: 100%; height: 140px; background-color: #f3f4f6; display: flex; align-items: center; justify-content: center;">
                  <span style="font-size: 32px; color: #d1d5db;">&#128247;</span>
                </div>`
            }
            <div style="padding: 12px;">
              ${offer.categoria ? `<p style="margin: 0 0 4px; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">${offer.categoria}</p>` : ''}
              <p style="margin: 0 0 8px; color: #0c1d3a; font-size: 14px; font-weight: 600; line-height: 1.3;">${offer.nombre}</p>
              ${hasDiscount
                ? `<p style="margin: 0 0 2px; color: #9ca3af; font-size: 12px; text-decoration: line-through;">${formatCLP(offer.precioAnterior!)}</p>
                   <p style="margin: 0; color: #dc2626; font-size: 16px; font-weight: 700;">${formatCLP(offer.precioOferta)}</p>
                   <span style="display: inline-block; background-color: #dc2626; color: #ffffff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; margin-top: 4px;">-${discountPercent}%</span>`
                : `<p style="margin: 0; color: #ea580c; font-size: 16px; font-weight: 700;">${formatCLP(offer.precioOferta)}</p>`
              }
            </div>
          </div>
        </td>`;
    };

    productGrid += `
      <tr>
        ${buildCard(left)}
        ${right ? buildCard(right) : '<td width="50%" style="padding: 8px;"></td>'}
      </tr>`;
  }

  const htmlContent = `
${emailHeader()}
              <!-- Title -->
              <div style="text-align: center; margin-bottom: 24px;">
                <span style="font-size: 36px;">&#127873;</span>
                <h2 style="margin: 8px 0 4px; color: #0c1d3a; font-size: 22px; font-weight: 700;">
                  Ofertas del mes en JURMAQ Barraca
                </h2>
                <p style="margin: 0; color: #ea580c; font-size: 15px; font-weight: 600; text-transform: capitalize;">
                  ${displayMonth}
                </p>
              </div>

              <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 20px; text-align: center;">
                Aprovecha estos precios especiales que tenemos para ti este mes. Stock limitado.
              </p>

              <!-- Product Grid -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                ${productGrid}
              </table>

              <!-- CTA -->
              <div style="text-align: center; margin-bottom: 16px;">
                <a href="${BASE_URL}/barraca" style="display: inline-block; background-color: #ea580c; color: #ffffff; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px;">
                  Ver todas las ofertas
                </a>
              </div>

              <p style="text-align: center; color: #6b7280; font-size: 12px; margin: 0;">
                Precios validos hasta fin de mes o hasta agotar stock
              </p>
${emailFooter({ showUnsubscribe: true })}`;

  await transporter.sendMail({
        to,
    subject: `Ofertas del mes en JURMAQ Barraca - ${displayMonth}`,
    html: htmlContent,
  });
}
