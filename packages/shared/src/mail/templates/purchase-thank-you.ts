import { BARRACA_URL, sendPostPurchaseEmail } from './post-purchase-shared';
import { renderEmailLayout, renderButton, BRAND } from '../layout';
import { escapeHtml } from "../utils";

/**
 * Email "Gracias por tu compra" — disparado inmediatamente cuando una
 * cotización barraca pasa a estado 'pagada'.
 *
 * Tier 4 D6: Post-purchase email automation.
 * Migrado al layout de marca compartido (../layout) — jun-2026.
 */
export async function sendPurchaseThankYouEmail(args: {
  to: string;
  nombre: string;
  numero: string;
  total: number;
}) {
  const totalFmt = `$${Number(args.total).toLocaleString('es-CL')}`;
  const cotUrl = `${BARRACA_URL}/cuenta/cotizaciones/${encodeURIComponent(args.numero)}`;
  const primerNombre = args.nombre.split(' ')[0] || 'Cliente';

  const bodyHtml = `
    <p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${BRAND.orange};">Compra confirmada</p>
    <h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;color:${BRAND.navy};font-weight:800;">¡Gracias por tu compra, ${escapeHtml(primerNombre)}!</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BRAND.text};">
      Tu pedido <strong style="color:${BRAND.navy};">${escapeHtml(args.numero)}</strong> fue recibido correctamente.
      Ya está en preparación y en breve te avisamos por email cuando salga para entrega.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;margin:0 0 28px;">
      <tr><td style="padding:18px 22px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-size:14px;color:${BRAND.text};">Total pagado</td>
            <td style="font-size:18px;font-weight:800;color:${BRAND.orange};text-align:right;white-space:nowrap;">${totalFmt}</td>
          </tr>
        </table>
        <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#9a3412;">
          ¿Necesitas boleta o factura? Escríbenos por WhatsApp y la generamos en el momento.
        </p>
      </td></tr>
    </table>

    <div style="margin-bottom:14px;">${renderButton({ href: cotUrl, label: 'Ver mi pedido' })}</div>
    <div class="jm-btn">${renderButton({ href: 'https://wa.me/56976673577', label: 'Escríbenos por WhatsApp', color: 'whatsapp' })}</div>

    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:${BRAND.textMuted};">
      ¿Tienes dudas? Estamos disponibles por WhatsApp al
      <a href="https://wa.me/56976673577" style="color:${BRAND.orange};text-decoration:underline;">+56 9 7667 3577</a>.
    </p>
  `;

  const html = renderEmailLayout({
    title: `¡Recibimos tu compra ${args.numero}!`,
    preheader: `Gracias por confiar en JURMAQ. Total: ${totalFmt}`,
    bodyHtml,
  });

  await sendPostPurchaseEmail({
    to: args.to,
    subject: `¡Recibimos tu compra ${args.numero}! · JURMAQ Barraca`,
    html,
  });
}
