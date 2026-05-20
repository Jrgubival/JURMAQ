import { escapeHtml } from '../utils';

/**
 * Helper compartido para los 6 email templates Klap.
 * Mantiene el estilo branded consistente con `otp.ts` + `payment-link.ts`.
 */

export interface KlapEmailVars {
  arrendatarioNombre: string;
  numeroContrato: string;
  monto: number;
  cardBrand?: string;
  cardLast4?: string;
  motivo?: string;
  cargoMonto?: number;
  validoHasta?: string;     // fecha en formato es-CL
  portalUrl?: string;
}

export type KlapEmailKind =
  | 'garantia_autorizada'
  | 'garantia_renovada'
  | 'garantia_fallo_renovacion'
  | 'garantia_liberada'
  | 'cargo_aplicado'
  | 'cargo_tardio';

interface KindConfig {
  subject: string;
  banner: string;        // texto en el banner navy
  bannerSub: string;     // texto secundario gold
  title: string;
  body: string;          // HTML inline (puede usar vars escapadas)
  ctaLabel?: string;     // opcional
  ctaHref?: string;
}

function formatMonto(n: number): string {
  return n.toLocaleString('es-CL');
}

export function buildKlapEmailHtml(kind: KlapEmailKind, v: KlapEmailVars): { subject: string; html: string } {
  const cfg = configByKind(kind, v);
  const portalDefault = v.portalUrl || 'https://jurmaq.cl/cuenta';
  const ctaHref = cfg.ctaHref || portalDefault;
  const ctaLabel = cfg.ctaLabel || 'Ver mi contrato';

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(12,29,58,0.08);">
        <tr>
          <td style="background:#0c1d3a;padding:28px 32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.3px;">JURMAQ</h1>
            <p style="margin:6px 0 0;color:#e6b422;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:3px;">${escapeHtml(cfg.bannerSub)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 24px;">
            <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">Hola ${escapeHtml(v.arrendatarioNombre || '')},</p>
            <h2 style="margin:0 0 16px;color:#0c1d3a;font-size:20px;font-weight:700;">${escapeHtml(cfg.title)}</h2>
            <div style="color:#374151;font-size:15px;line-height:1.6;">
              ${cfg.body}
            </div>
            <div style="margin:24px 0 8px;text-align:center;">
              <a href="${escapeHtml(ctaHref)}" style="display:inline-block;padding:12px 28px;background:#ea580c;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">${escapeHtml(ctaLabel)}</a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 24px;">
            <div style="border-top:1px solid #e5e7eb;padding-top:16px;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
                Contrato <strong style="color:#374151;">${escapeHtml(v.numeroContrato || '')}</strong>
                ${v.cardLast4 ? ` · Tarjeta ${escapeHtml(v.cardBrand || '')} •••• ${escapeHtml(v.cardLast4)}` : ''}
              </p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:14px;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:11px;">
              JURMAQ · Constructora Jorge Ubilla Rivera E.I.R.L. · Curicó, Maule
            </p>
            <p style="margin:4px 0 0;color:#9ca3af;font-size:11px;">
              Garantía digital procesada por Klap (Multicaja Pagos S.A.) — PCI DSS certificado.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject: cfg.subject, html };
}

function configByKind(kind: KlapEmailKind, v: KlapEmailVars): KindConfig {
  const montoFmt = formatMonto(v.monto);
  const cargoFmt = formatMonto(v.cargoMonto ?? 0);
  const cardTail = v.cardLast4 ? `${v.cardBrand || ''} •••• ${v.cardLast4}` : 'tu tarjeta';

  switch (kind) {
    case 'garantia_autorizada':
      return {
        subject: `Garantía pre-autorizada — ${v.numeroContrato}`,
        bannerSub: 'Garantía digital',
        banner: 'Garantía digital',
        title: 'Tu garantía está pre-autorizada',
        body: `<p>Hemos retenido <strong>$${escapeHtml(montoFmt)}</strong> en ${escapeHtml(cardTail)} como garantía del arriendo <strong>${escapeHtml(v.numeroContrato)}</strong>.</p>
<p><strong>Importante</strong>: este monto <em>NO se cobra</em>. Se libera automáticamente al devolver la máquina sin daños.</p>
<p style="font-size:13px;color:#6b7280;">Si la máquina presenta daños al devolverla, sólo se captura el monto del daño y el resto se libera. Si descubrimos daños después, podríamos cobrarlos en tu tarjeta hasta 90 días post-devolución.</p>`,
        ctaLabel: 'Ver mis garantías',
        ctaHref: 'https://jurmaq.cl/cuenta/garantias',
      };
    case 'garantia_renovada':
      return {
        subject: `Garantía renovada — ${v.numeroContrato}`,
        bannerSub: 'Renovación automática',
        banner: 'Renovación automática',
        title: 'Renovamos tu garantía',
        body: `<p>Como tu contrato sigue vigente, renovamos automáticamente la pre-autorización de <strong>$${escapeHtml(montoFmt)}</strong> en ${escapeHtml(cardTail)} hasta <strong>${escapeHtml(v.validoHasta || 'próximo ciclo')}</strong>.</p>
<p style="font-size:13px;color:#6b7280;">No se requiere ninguna acción de tu parte. El monto sigue retenido (no cobrado).</p>`,
        ctaLabel: 'Ver detalles',
        ctaHref: 'https://jurmaq.cl/cuenta/garantias',
      };
    case 'garantia_fallo_renovacion':
      return {
        subject: `Acción requerida: actualiza tu tarjeta — ${v.numeroContrato}`,
        bannerSub: 'Acción requerida',
        banner: 'Acción requerida',
        title: 'No pudimos renovar tu garantía',
        body: `<p>Intentamos renovar la pre-autorización de <strong>$${escapeHtml(montoFmt)}</strong> en ${escapeHtml(cardTail)} para el contrato <strong>${escapeHtml(v.numeroContrato)}</strong> pero el banco la rechazó.</p>
<p>Esto puede pasar si la tarjeta venció, hay un bloqueo bancario o el cupo está al límite.</p>
<p style="background:#fef3c7;padding:12px;border-radius:8px;font-size:14px;"><strong>Por favor actualiza tu medio de pago</strong> en el portal para mantener la garantía vigente.</p>`,
        ctaLabel: 'Actualizar tarjeta',
        ctaHref: 'https://jurmaq.cl/cuenta/tarjetas',
      };
    case 'garantia_liberada':
      return {
        subject: `Garantía liberada — ${v.numeroContrato}`,
        bannerSub: 'Garantía liberada',
        banner: 'Garantía liberada',
        title: 'Tu garantía fue liberada',
        body: `<p>La máquina del contrato <strong>${escapeHtml(v.numeroContrato)}</strong> fue devuelta sin daños. Liberamos la pre-autorización de <strong>$${escapeHtml(montoFmt)}</strong> en ${escapeHtml(cardTail)}.</p>
<p style="font-size:13px;color:#6b7280;">El ajuste aparecerá en tu próximo estado de cuenta dentro de 1 a 7 días hábiles, según tu banco emisor.</p>
<p>¡Gracias por confiar en JURMAQ!</p>`,
        ctaLabel: 'Ver mi cuenta',
        ctaHref: 'https://jurmaq.cl/cuenta',
      };
    case 'cargo_aplicado':
      return {
        subject: `Cargo aplicado por daños — ${v.numeroContrato}`,
        bannerSub: 'Cargo aplicado',
        banner: 'Cargo aplicado',
        title: 'Aplicamos un cargo por daños',
        body: `<p>Al recibir la máquina del contrato <strong>${escapeHtml(v.numeroContrato)}</strong> detectamos daños valorizados en <strong>$${escapeHtml(cargoFmt)}</strong>.</p>
<p>Capturamos ese monto de la pre-autorización de $${escapeHtml(montoFmt)} en ${escapeHtml(cardTail)}. El saldo restante quedó liberado.</p>
${v.motivo ? `<p style="background:#f3f4f6;padding:12px;border-radius:8px;font-size:13px;"><strong>Detalle del daño:</strong><br>${escapeHtml(v.motivo)}</p>` : ''}
<p style="font-size:13px;color:#6b7280;">Si tienes dudas sobre el cargo, contáctanos respondiendo este email o escribiendo a contacto@jurmaq.cl.</p>`,
        ctaLabel: 'Ver contrato',
        ctaHref: `https://jurmaq.cl/cuenta/contratos`,
      };
    case 'cargo_tardio':
      return {
        subject: `Cargo por daños descubiertos — ${v.numeroContrato}`,
        bannerSub: 'Cargo posterior',
        banner: 'Cargo posterior',
        title: 'Cargo posterior a la devolución',
        body: `<p>Tras la devolución de la máquina del contrato <strong>${escapeHtml(v.numeroContrato)}</strong>, detectamos un daño que no era evidente al momento de la inspección inicial.</p>
<p>Aplicamos un cargo de <strong>$${escapeHtml(cargoFmt)}</strong> en ${escapeHtml(cardTail)} (tarjeta registrada como medio de pago al iniciar el contrato).</p>
${v.motivo ? `<p style="background:#fee2e2;padding:12px;border-radius:8px;font-size:13px;border-left:4px solid #ef4444;"><strong>Motivo:</strong><br>${escapeHtml(v.motivo)}</p>` : ''}
<p style="font-size:13px;color:#6b7280;">Esta facultad está autorizada en la cláusula Cuarta del contrato firmado. Plazo legal: hasta 90 días post-devolución. Si tienes objeciones, escríbenos a contacto@jurmaq.cl dentro de los próximos 7 días con respaldo.</p>`,
        ctaLabel: 'Ver detalle del contrato',
        ctaHref: `https://jurmaq.cl/cuenta/contratos`,
      };
  }
}
