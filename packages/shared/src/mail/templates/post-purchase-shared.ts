import { transporter } from '../transport';
import { env } from '@jurmaq/shared/env';

/**
 * Layout compartido para los emails post-compra de barraca.
 *
 * Tier 4 D6: thank-you, review-request, replenishment usan este wrapper
 * para mantener look consistente (navy + naranja barraca, footer JURMAQ).
 */

interface BuildEmailOptions {
  to: string;
  subject: string;
  preheader: string;
  /** Emoji o icono unicode al inicio del body (ej. '🎉'). */
  emoji?: string;
  title: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  /** Opcional: pequeño bloque secundario (e.g. tip / footer disclaimer). */
  footerNote?: string;
}

const BARRACA_URL = (env.NEXT_PUBLIC_BARRACA_URL || 'https://barraca.jurmaq.cl').replace(/\/$/, '');

export function buildPostPurchaseHtml(opts: BuildEmailOptions): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(opts.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <!-- preheader (oculto, visible solo en preview del inbox) -->
  <div style="display:none;font-size:1px;color:#f3f4f6;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${escapeHtml(opts.preheader)}
  </div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background-color:#0c1d3a;padding:28px;text-align:center;border-radius:12px 12px 0 0;">
            <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;">JURMAQ</h1>
            <p style="margin:4px 0 0;color:#ea580c;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:2px;">Barraca</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:32px;">
            ${opts.emoji ? `<div style="text-align:center;font-size:42px;margin-bottom:16px;">${opts.emoji}</div>` : ''}
            <h2 style="margin:0 0 16px;color:#0c1d3a;font-size:22px;text-align:center;">${escapeHtml(opts.title)}</h2>
            <div style="color:#374151;font-size:15px;line-height:1.6;">
              ${opts.bodyHtml}
            </div>
            <div style="text-align:center;margin:28px 0 12px;">
              <a href="${opts.ctaUrl}" style="display:inline-block;background-color:#ea580c;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
                ${escapeHtml(opts.ctaLabel)}
              </a>
            </div>
            ${opts.footerNote ? `<p style="margin:20px 0 0;color:#9ca3af;font-size:12px;text-align:center;line-height:1.5;">${opts.footerNote}</p>` : ''}
          </td>
        </tr>
        <tr>
          <td style="background-color:#f9fafb;padding:20px 32px;text-align:center;">
            <p style="margin:0 0 6px;color:#6b7280;font-size:13px;line-height:1.6;">
              Tel: +56 9 7667 3577 · contacto@jurmaq.cl<br>
              Av. Poniente 2157, Molina, Maule
            </p>
            <p style="margin:0;color:#9ca3af;font-size:11px;font-style:italic;">Más de 25 años en la Región del Maule</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#0c1d3a;padding:18px 32px;text-align:center;border-radius:0 0 12px 12px;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              &copy; ${new Date().getFullYear()} JURMAQ Barraca · <a href="${BARRACA_URL}/cuenta/desuscribir" style="color:#9ca3af;text-decoration:underline;">Desuscribir</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

export async function sendPostPurchaseEmail(args: { to: string; subject: string; html: string }) {
  // BCC admin OK: confirmaciones de compra son interés legítimo del negocio
  // saber qué pedidos fueron confirmados. NO usar skipAdminBcc=true acá.
  await transporter.sendMail({
    to: args.to,
    subject: args.subject,
    html: args.html,
  });
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export { BARRACA_URL };
