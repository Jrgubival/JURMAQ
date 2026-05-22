import { BARRACA_URL, buildPostPurchaseHtml, sendPostPurchaseEmail } from './post-purchase-shared';

/**
 * Email "¿Cómo te fue?" — disparado 7 días después de la compra.
 *
 * Pide al cliente que deje review del producto. El link va al producto
 * directamente (no a un form de review fuera de contexto). Tier 4 D2 ya
 * tiene la sección ReviewsList en /producto/[slug] con formulario embebido.
 *
 * Tier 4 D6: Post-purchase email automation.
 */
interface ProductoSimple {
  nombre: string;
  slug: string;
}

export async function sendReviewRequestEmail(args: {
  to: string;
  nombre: string;
  numero: string;
  productos: ProductoSimple[];
}) {
  // Limito a 3 productos featured para no spamear el email.
  const featured = (args.productos || []).slice(0, 3);
  const lista = featured.map(
    (p) => `
      <li style="margin:0 0 8px;">
        <a href="${BARRACA_URL}/producto/${encodeURIComponent(p.slug)}#reviews" style="color:#ea580c;text-decoration:none;font-weight:600;">
          ${escapeHtml(p.nombre)} →
        </a>
      </li>
    `,
  ).join('');

  const html = buildPostPurchaseHtml({
    to: args.to,
    subject: '¿Cómo te fue con tu compra?',
    preheader: 'Tu opinión nos ayuda a mejorar y ayuda a otros clientes',
    emoji: '⭐',
    title: '¿Cómo te fue con tu compra?',
    bodyHtml: `
      <p style="margin:0 0 14px;">
        Hola <strong>${args.nombre.split(' ')[0] || 'Cliente'}</strong>,
      </p>
      <p style="margin:0 0 14px;">
        Hace una semana recibiste tu pedido <strong>${args.numero}</strong>.
        Tu opinión sobre los productos nos ayuda a mejorar y ayuda a otros
        maestros y clientes a decidir con confianza.
      </p>
      ${
        featured.length > 0
          ? `<p style="margin:0 0 8px;font-weight:600;color:#0c1d3a;">¿Calificás estos productos?</p>
             <ul style="margin:0 0 16px;padding:0 0 0 18px;color:#374151;font-size:14px;line-height:1.6;">
               ${lista}
             </ul>`
          : ''
      }
      <p style="margin:18px 0 0;font-size:13px;color:#6b7280;">
        Toma 30 segundos. Sin formulario largo. Solo elegís estrellas y, si
        querés, dejás un comentario corto.
      </p>
    `,
    ctaLabel: 'Dejar mi reseña ⭐',
    ctaUrl:
      featured.length > 0
        ? `${BARRACA_URL}/producto/${encodeURIComponent(featured[0].slug)}#reviews`
        : `${BARRACA_URL}/cuenta/cotizaciones/${args.numero}`,
    footerNote: 'Solo enviamos un recordatorio. No insistimos.',
  });

  await sendPostPurchaseEmail({
    to: args.to,
    subject: `¿Qué te pareció tu compra ${args.numero}? · JURMAQ Barraca`,
    html,
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
