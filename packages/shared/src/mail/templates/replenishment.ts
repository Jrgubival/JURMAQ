import { BARRACA_URL, buildPostPurchaseHtml, sendPostPurchaseEmail } from './post-purchase-shared';

/**
 * Email "Volvé a comprar" — 60 días después de la última compra pagada.
 *
 * Re-engagement clásico ecommerce: items de construcción típicos se
 * acaban en ~2 meses (clavos, fijaciones, pintura). Recordatorio gentil
 * con link a "comprar de nuevo" precargando el carrito anterior.
 *
 * Tier 4 D6: Post-purchase email automation.
 */
export async function sendReplenishmentEmail(args: {
  to: string;
  nombre: string;
  numero: string;
}) {
  const html = buildPostPurchaseHtml({
    to: args.to,
    subject: '¿Te estás quedando sin materiales?',
    preheader: 'Volvé a pedir tu compra anterior con un clic',
    emoji: '🛒',
    title: '¿Necesitás reponer materiales?',
    bodyHtml: `
      <p style="margin:0 0 14px;">
        Hola <strong>${args.nombre.split(' ')[0] || 'Cliente'}</strong>,
      </p>
      <p style="margin:0 0 14px;">
        Pasó un tiempo desde tu última compra (<strong>${args.numero}</strong>) y
        capaz ya se te están acabando los materiales. Si querés repetir el pedido
        completo o solo algunos items, tenemos los precios actualizados esperándote.
      </p>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px;margin:18px 0;">
        <p style="margin:0;color:#1e40af;font-size:14px;">
          💡 <strong>Tip:</strong> Desde tu cuenta podés ver tu historial completo
          y &ldquo;repetir cotización&rdquo; para regenerar el carrito en un clic.
        </p>
      </div>
    `,
    ctaLabel: 'Ver mi historial',
    ctaUrl: `${BARRACA_URL}/cuenta/cotizaciones`,
    footerNote: 'Si no querés más recordatorios, podés desuscribirte abajo.',
  });

  await sendPostPurchaseEmail({
    to: args.to,
    subject: '¿Te estás quedando sin materiales? · JURMAQ Barraca',
    html,
  });
}
