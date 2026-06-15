import { escapeHtml, formatCLP } from './utils';

/**
 * Sistema de email unificado JURMAQ Barraca (jun-2026).
 *
 * Reemplaza las ~11 plantillas one-off (cada una con su <!DOCTYPE>, wrapper y
 * estilos distintos, sin responsive ni dark mode) por un layout compartido con
 * look de retailer: header de marca, footer completo, botón "bulletproof"
 * (con VML para Outlook) y resumen de pedido con miniaturas de producto.
 *
 * Uso:
 *   import { renderEmailLayout, renderButton, renderOrderItems } from '../layout';
 *   const html = renderEmailLayout({ title, preheader, bodyHtml: `...${renderButton(...)}...` });
 */

export const BRAND = {
  navy: '#0c1d3a',
  navyDark: '#081325',
  orange: '#ea580c',
  text: '#1f2933',
  textMuted: '#6b7280',
  bg: '#eef1f5',
  card: '#ffffff',
  border: '#e5e7eb',
  whatsapp: '#25D366',
} as const;

const WA = '56976673577';
const SITE = 'https://barraca.jurmaq.cl';

const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;

/** Botón "bulletproof": ancho táctil, render consistente incl. Outlook (VML). */
export function renderButton(opts: {
  href: string;
  label: string;
  color?: 'orange' | 'navy' | 'whatsapp';
}): string {
  const bg = opts.color === 'navy' ? BRAND.navy : opts.color === 'whatsapp' ? BRAND.whatsapp : BRAND.orange;
  const href = escapeHtml(opts.href);
  const label = escapeHtml(opts.label);
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>
  <td align="center" bgcolor="${bg}" style="border-radius:8px;">
    <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${href}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="16%" fillcolor="${bg}" stroke="f"><center style="color:#ffffff;font-family:${FONT};font-size:15px;font-weight:700;"><![endif]-->
    <a href="${href}" target="_blank" style="display:inline-block;padding:14px 38px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">${label}</a>
    <!--[if mso]></center></v:roundrect><![endif]-->
  </td>
</tr></table>`;
}

export interface OrderItem {
  nombre: string;
  cantidad: number;
  precio: number;
  imagen?: string | null;
}

/** Resumen de pedido con miniatura + nombre + cant×precio + subtotal. */
export function renderOrderItems(items: OrderItem[]): string {
  const rows = items
    .map(
      (it) => `
  <tr>
    <td width="56" style="padding:12px 0;border-bottom:1px solid ${BRAND.border};vertical-align:top;">
      ${
        it.imagen
          ? `<img src="${escapeHtml(it.imagen)}" width="48" height="48" alt="" style="display:block;width:48px;height:48px;border-radius:6px;border:1px solid ${BRAND.border};background:#ffffff;object-fit:cover;">`
          : `<div style="width:48px;height:48px;border-radius:6px;background:#f3f4f6;border:1px solid ${BRAND.border};"></div>`
      }
    </td>
    <td style="padding:12px 14px;border-bottom:1px solid ${BRAND.border};font-family:${FONT};font-size:14px;color:${BRAND.text};vertical-align:top;">
      ${escapeHtml(it.nombre)}<br>
      <span style="color:${BRAND.textMuted};font-size:12px;">${it.cantidad} × ${formatCLP(it.precio)}</span>
    </td>
    <td style="padding:12px 0;border-bottom:1px solid ${BRAND.border};font-family:${FONT};font-size:14px;font-weight:700;color:${BRAND.text};text-align:right;white-space:nowrap;vertical-align:top;">
      ${formatCLP(it.precio * it.cantidad)}
    </td>
  </tr>`
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rows}</table>`;
}

/** Envuelve el cuerpo en el layout de marca (header + footer + responsive + dark). */
export function renderEmailLayout(opts: {
  title: string;
  preheader?: string;
  bodyHtml: string;
  /** Muestra link de preferencias/desuscripción (solo emails de marketing). */
  marketing?: boolean;
}): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="es" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(opts.title)}</title>
<style>
  @media only screen and (max-width:600px){
    .jm-container{width:100% !important;}
    .jm-px{padding-left:22px !important;padding-right:22px !important;}
    .jm-btn a{display:block !important;}
  }
  @media (prefers-color-scheme:dark){
    .jm-body{background:#0b1220 !important;}
  }
  a{color:${BRAND.orange};}
</style>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:${FONT};">
${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(opts.preheader)}</div>` : ''}
<table role="presentation" class="jm-body" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.bg};padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" class="jm-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
      <tr><td style="background:${BRAND.navy};padding:26px 32px;border-radius:14px 14px 0 0;text-align:center;">
        <span style="font-family:${FONT};font-size:26px;font-weight:800;color:#ffffff;letter-spacing:0.5px;vertical-align:middle;">JURMAQ</span>
        <span style="font-family:${FONT};font-size:12px;font-weight:700;color:${BRAND.orange};text-transform:uppercase;letter-spacing:3px;margin-left:8px;vertical-align:middle;">Barraca</span>
      </td></tr>
      <tr><td class="jm-px" style="background:${BRAND.card};padding:36px 40px;font-family:${FONT};color:${BRAND.text};">
        ${opts.bodyHtml}
      </td></tr>
      <tr><td style="background:${BRAND.navyDark};padding:26px 32px;border-radius:0 0 14px 14px;">
        <p style="margin:0 0 8px;color:#cbd5e1;font-family:${FONT};font-size:13px;line-height:1.7;">
          <strong style="color:#ffffff;">JURMAQ Barraca</strong> — Fierros y materiales de construcción<br>
          Av. Poniente 2157, Molina · Región del Maule<br>
          WhatsApp <a href="https://wa.me/${WA}" style="color:${BRAND.orange};text-decoration:none;">+56 9 7667 3577</a> &nbsp;·&nbsp; <a href="mailto:contacto@jurmaq.cl" style="color:${BRAND.orange};text-decoration:none;">contacto@jurmaq.cl</a>
        </p>
        <p style="margin:12px 0 0;color:#64748b;font-family:${FONT};font-size:11px;line-height:1.5;">
          © ${year} JURMAQ · barraca.jurmaq.cl${opts.marketing ? ` · <a href="${SITE}/cuenta" style="color:#94a3b8;">Preferencias de correo</a>` : ''}
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
