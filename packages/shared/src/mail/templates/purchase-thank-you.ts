import { BARRACA_URL, buildPostPurchaseHtml, sendPostPurchaseEmail } from './post-purchase-shared';
import { escapeHtml } from "../utils";

/**
 * Email "Gracias por tu compra" — disparado inmediatamente cuando una
 * cotización barraca pasa a estado 'pagada'.
 *
 * Tier 4 D6: Post-purchase email automation.
 */
export async function sendPurchaseThankYouEmail(args: {
  to: string;
  nombre: string;
  numero: string;
  total: number;
}) {
  const totalFmt = `$${Number(args.total).toLocaleString('es-CL')}`;
  const cotUrl = `${BARRACA_URL}/cuenta/cotizaciones/${encodeURIComponent(args.numero)}`;
  const html = buildPostPurchaseHtml({
    to: args.to,
    subject: `¡Recibimos tu compra ${args.numero}!`,
    preheader: `Gracias por confiar en JURMAQ. Total: ${totalFmt}`,
    emoji: '🎉',
    title: '¡Gracias por tu compra!',
    bodyHtml: `
      <p style="margin:0 0 14px;">
        Hola <strong>${escapeHtml(args.nombre.split(' ')[0] || 'Cliente')}</strong>,
      </p>
      <p style="margin:0 0 14px;">
        Tu pedido <strong>${escapeHtml(args.numero)}</strong> fue recibido correctamente.
        Ya está en preparación y en breve te avisamos por email cuando salga
        para entrega.
      </p>
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:14px;margin:18px 0;">
        <p style="margin:0;color:#9a3412;font-size:14px;">
          <strong>Total pagado:</strong> ${totalFmt}<br>
          Si necesitás boleta o factura, escribinos al WhatsApp y la
          generamos en el momento.
        </p>
      </div>
    `,
    ctaLabel: 'Ver mi pedido',
    ctaUrl: cotUrl,
    footerNote:
      '¿Tenés dudas? Escribinos al WhatsApp <a href="https://wa.me/56976673577" style="color:#ea580c;text-decoration:underline;">+56 9 7667 3577</a>',
  });

  await sendPostPurchaseEmail({
    to: args.to,
    subject: `¡Recibimos tu compra ${args.numero}! · JURMAQ Barraca`,
    html,
  });
}
