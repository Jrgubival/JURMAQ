import { transporter } from '../transport';

/**
 * Templates de email "manuales" que el admin de arriendo dispara desde
 * detalle de cotización/solicitud para reactivar leads, pedir info,
 * coordinar entregas, etc.
 *
 * Cada template tiene asunto, body y CTA configurable. El admin puede
 * además adjuntar `customMessage` que se inserta destacado en el cuerpo.
 *
 * Tier 5 (ad-hoc): admin-driven manual emails.
 */

export type AdminManualEmailKind =
  | 'follow_up'
  | 'need_info'
  | 'quote_reminder'
  | 'reservation_pending'
  | 'delivery_schedule'
  | 'return_schedule'
  | 'thank_you'
  | 'custom';

export interface AdminManualEmailVars {
  /** Nombre del cliente (siempre requerido). */
  nombre: string;
  /** Número de cotización (COT-AAAAMMDD-NNNN). */
  numero_cotizacion?: string;
  /** Nombre de la máquina (ej: "Retroexcavadora CAT 420F"). */
  maquinaria?: string;
  /** Fecha objetivo (entrega/retiro/servicio). Formato dd-mm-aaaa. */
  fecha?: string;
  /** Ubicación del servicio. */
  ubicacion?: string;
  /** Monto pendiente (para reserva pendiente). */
  monto_reserva?: number;
}

export interface SendAdminManualEmailArgs {
  to: string;
  kind: AdminManualEmailKind;
  vars: AdminManualEmailVars;
  /** Texto adicional escrito por el admin (opcional excepto para 'custom'). */
  customMessage?: string;
  /** Quién dispara (para signature). */
  sentByName?: string;
}

const CONSTRUCTORA_URL = (
  process.env.NEXT_PUBLIC_CONSTRUCTORA_URL || 'https://jurmaq.cl'
).replace(/\/$/, '');

const WHATSAPP_LINK = 'https://wa.me/56983221440';
const WHATSAPP_DISPLAY = '+56 9 8322 1440';

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtCLP(n: number): string {
  return `$${Number(n).toLocaleString('es-CL')}`;
}

// ============================================================================
// Plantilla HTML reusable: navy header + body + CTA + footer
// ============================================================================
interface BuildArgs {
  asunto: string;
  preheader: string;
  titulo: string;
  introHtml: string;
  bulletList?: string[];
  customMessage?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  sentByName?: string;
}

function buildHtml(args: BuildArgs): string {
  const bulletsHtml =
    args.bulletList && args.bulletList.length > 0
      ? `<ul style="margin:14px 0;padding:0 0 0 18px;color:#374151;font-size:14px;line-height:1.7;">
          ${args.bulletList.map((b) => `<li style="margin-bottom:4px;">${b}</li>`).join('')}
        </ul>`
      : '';

  const customHtml = args.customMessage
    ? `<div style="background:#fff7ed;border-left:3px solid #ea580c;padding:12px 16px;margin:18px 0;border-radius:4px;">
        <p style="margin:0;color:#7c2d12;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(args.customMessage)}</p>
      </div>`
    : '';

  const ctaHtml =
    args.ctaLabel && args.ctaUrl
      ? `<div style="text-align:center;margin:24px 0 8px;">
          <a href="${args.ctaUrl}" style="display:inline-block;background-color:#0c1d3a;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
            ${escapeHtml(args.ctaLabel)}
          </a>
        </div>`
      : '';

  const signature = args.sentByName
    ? `<p style="margin:24px 0 0;color:#6b7280;font-size:13px;">
        Saludos,<br><strong>${escapeHtml(args.sentByName)}</strong><br>Equipo JURMAQ Arriendo
      </p>`
    : `<p style="margin:24px 0 0;color:#6b7280;font-size:13px;">Saludos,<br><strong>Equipo JURMAQ Arriendo</strong></p>`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(args.asunto)}</title></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="display:none;font-size:1px;color:#f3f4f6;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(args.preheader)}</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background-color:#0c1d3a;padding:28px;text-align:center;border-radius:12px 12px 0 0;">
            <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;">JURMAQ</h1>
            <p style="margin:4px 0 0;color:#fbbf24;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:2px;">Arriendo de Maquinaria</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:32px;">
            <h2 style="margin:0 0 16px;color:#0c1d3a;font-size:20px;">${escapeHtml(args.titulo)}</h2>
            <div style="color:#374151;font-size:15px;line-height:1.6;">${args.introHtml}</div>
            ${bulletsHtml}
            ${customHtml}
            ${ctaHtml}
            ${signature}
          </td>
        </tr>
        <tr>
          <td style="background-color:#f9fafb;padding:20px 32px;text-align:center;">
            <p style="margin:0 0 6px;color:#6b7280;font-size:13px;line-height:1.6;">
              Tel/WhatsApp: ${WHATSAPP_DISPLAY} · contacto@jurmaq.cl<br>
              Av. Poniente 2157, Molina, Maule
            </p>
            <p style="margin:8px 0 0;">
              <a href="${WHATSAPP_LINK}" style="display:inline-block;background-color:#25D366;color:#ffffff;padding:8px 18px;border-radius:6px;text-decoration:none;font-weight:600;font-size:13px;">
                💬 Responder por WhatsApp
              </a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#0c1d3a;padding:16px 32px;text-align:center;border-radius:0 0 12px 12px;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">&copy; ${new Date().getFullYear()} JURMAQ Arriendo · Más de 25 años en la Región del Maule</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

// ============================================================================
// Dispatcher por kind
// ============================================================================
interface RenderedTemplate {
  asunto: string;
  html: string;
}

function renderTemplate(args: SendAdminManualEmailArgs): RenderedTemplate {
  const { vars, customMessage, sentByName } = args;
  const nombrePila = (vars.nombre || 'Cliente').split(' ')[0];
  const refCot = vars.numero_cotizacion ? ` (${vars.numero_cotizacion})` : '';
  const cotUrl = vars.numero_cotizacion
    ? `${CONSTRUCTORA_URL}/cuenta/cotizaciones/${encodeURIComponent(vars.numero_cotizacion)}`
    : `${CONSTRUCTORA_URL}/cuenta`;

  switch (args.kind) {
    case 'follow_up': {
      const asunto = `Intentamos contactarte${refCot} · JURMAQ Arriendo`;
      return {
        asunto,
        html: buildHtml({
          asunto,
          preheader: 'Queremos terminar de ayudarte con tu solicitud',
          titulo: `Hola ${nombrePila}, ¿seguimos adelante?`,
          introHtml: `
            <p style="margin:0 0 12px;">
              Intentamos contactarte ${vars.numero_cotizacion ? `por tu solicitud <strong>${vars.numero_cotizacion}</strong>` : 'por tu solicitud de arriendo'} y no pudimos.
              Queremos terminar de ayudarte: para armar una cotización ajustada
              a tu necesidad, ¿podrías contarnos un poco más?
            </p>
          `,
          bulletList: [
            '<strong>Tipo de proyecto:</strong> obra civil, terreno particular, demolición, etc.',
            '<strong>Duración estimada del trabajo:</strong> ¿1 día? ¿una semana?',
            '<strong>Dirección o sector exacto</strong> donde se haría el trabajo',
            '<strong>¿Necesitas operador?</strong> o tienes uno con experiencia',
          ],
          customMessage,
          ctaLabel: 'Responder por WhatsApp',
          ctaUrl: WHATSAPP_LINK,
          sentByName,
        }),
      };
    }

    case 'need_info': {
      const asunto = `Necesitamos un poco más de info${refCot} · JURMAQ Arriendo`;
      return {
        asunto,
        html: buildHtml({
          asunto,
          preheader: 'Pequeños datos pendientes para armar tu cotización',
          titulo: `${nombrePila}, faltan unos datos`,
          introHtml: `
            <p style="margin:0 0 12px;">
              Para mandarte una cotización precisa y sin sorpresas necesitamos
              completar algunos detalles${vars.maquinaria ? ` sobre tu arriendo de <strong>${escapeHtml(vars.maquinaria)}</strong>` : ''}:
            </p>
          `,
          bulletList: [
            '<strong>Fecha exacta de inicio</strong> y duración estimada',
            '<strong>Dirección con ciudad/comuna</strong> (afecta traslado)',
            '<strong>Acceso a la obra:</strong> ¿calle pavimentada? ¿pendiente?',
            '<strong>Operador y combustible:</strong> ¿lo incluimos nosotros o lo manejas tú?',
          ],
          customMessage,
          ctaLabel: 'Responder por WhatsApp',
          ctaUrl: WHATSAPP_LINK,
          sentByName,
        }),
      };
    }

    case 'quote_reminder': {
      const asunto = `Recordatorio: tu cotización ${vars.numero_cotizacion || ''} sigue activa`;
      return {
        asunto,
        html: buildHtml({
          asunto,
          preheader: 'Sigue disponible. ¿Tienes alguna duda que podamos resolver?',
          titulo: `${nombrePila}, tu cotización sigue en pie`,
          introHtml: `
            <p style="margin:0 0 12px;">
              Te enviamos hace unos días la cotización ${vars.numero_cotizacion ? `<strong>${vars.numero_cotizacion}</strong>` : 'de tu arriendo'}${vars.maquinaria ? ` por la ${escapeHtml(vars.maquinaria)}` : ''}.
              Sigue vigente y queremos confirmarte que estamos disponibles para
              resolver cualquier duda antes de avanzar.
            </p>
            <p style="margin:0 0 12px;">
              Si necesitas <strong>ajustar fechas, agregar operador, o conversar
              el precio</strong>, escribinos. Tenemos flexibilidad para que el
              trabajo te calce.
            </p>
          `,
          customMessage,
          ctaLabel: 'Ver mi cotización',
          ctaUrl: cotUrl,
          sentByName,
        }),
      };
    }

    case 'reservation_pending': {
      const asunto = `Falta confirmar reserva${refCot} · JURMAQ Arriendo`;
      const monto = vars.monto_reserva ? fmtCLP(vars.monto_reserva) : 'el 30% inicial';
      return {
        asunto,
        html: buildHtml({
          asunto,
          preheader: 'Para reservar tu máquina necesitamos el inicial',
          titulo: `Reserva pendiente, ${nombrePila}`,
          introHtml: `
            <p style="margin:0 0 12px;">
              Tu cotización ${vars.numero_cotizacion ? `<strong>${vars.numero_cotizacion}</strong>` : ''}${vars.maquinaria ? ` por la ${escapeHtml(vars.maquinaria)}` : ''} está
              aceptada, pero <strong>la máquina aún no está reservada a tu
              nombre</strong> porque falta confirmar el pago inicial.
            </p>
            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px;margin:16px 0;">
              <p style="margin:0;color:#1e40af;font-size:14px;">
                <strong>Monto inicial para reservar:</strong> ${monto}<br>
                Una vez confirmado, bloqueamos la fecha y la máquina queda
                comprometida solo para ti.
              </p>
            </div>
            <p style="margin:0 0 12px;">
              Si necesitas más tiempo, contestá este correo y vemos cómo
              acomodarlo.
            </p>
          `,
          customMessage,
          ctaLabel: 'Pagar reserva',
          ctaUrl: cotUrl,
          sentByName,
        }),
      };
    }

    case 'delivery_schedule': {
      const asunto = `Coordinemos la entrega${refCot}`;
      return {
        asunto,
        html: buildHtml({
          asunto,
          preheader: 'Confirma fecha y hora para llevar la máquina',
          titulo: `${nombrePila}, coordinemos la entrega`,
          introHtml: `
            <p style="margin:0 0 12px;">
              Tenemos tu arriendo confirmado${vars.maquinaria ? ` por la <strong>${escapeHtml(vars.maquinaria)}</strong>` : ''} y queremos
              coordinar la entrega.
            </p>
            <p style="margin:0 0 12px;">
              ${vars.fecha ? `<strong>Fecha propuesta:</strong> ${escapeHtml(vars.fecha)}<br>` : ''}
              ${vars.ubicacion ? `<strong>Lugar:</strong> ${escapeHtml(vars.ubicacion)}<br>` : ''}
              Por favor confirmanos si te calza el horario o proponé uno
              alternativo. También necesitamos:
            </p>
          `,
          bulletList: [
            'Un teléfono del responsable en el sitio de entrega',
            'Indicaciones de acceso (referencia, sector, color portón)',
            '¿Hay rampa o necesitamos camión con uña?',
          ],
          customMessage,
          ctaLabel: 'Confirmar por WhatsApp',
          ctaUrl: WHATSAPP_LINK,
          sentByName,
        }),
      };
    }

    case 'return_schedule': {
      const asunto = `Coordinemos el retiro${refCot}`;
      return {
        asunto,
        html: buildHtml({
          asunto,
          preheader: 'Tu arriendo termina pronto, definamos retiro',
          titulo: `${nombrePila}, fin del arriendo`,
          introHtml: `
            <p style="margin:0 0 12px;">
              Tu arriendo${vars.maquinaria ? ` de la <strong>${escapeHtml(vars.maquinaria)}</strong>` : ''} ${vars.fecha ? `vence el <strong>${escapeHtml(vars.fecha)}</strong>` : 'está por terminar'}.
              Queremos coordinar el retiro para evitar cobros adicionales.
            </p>
          `,
          bulletList: [
            '<strong>Día y hora del retiro:</strong> proponé un horario que te calce',
            '<strong>Estado de la máquina:</strong> ¿quedó limpia? ¿con combustible?',
            '<strong>Acceso para el camión:</strong> mismo lugar de entrega o uno distinto',
            '¿Vas a renovar o necesitas otra máquina? Te mandamos cotización al toque',
          ],
          customMessage,
          ctaLabel: 'Confirmar retiro por WhatsApp',
          ctaUrl: WHATSAPP_LINK,
          sentByName,
        }),
      };
    }

    case 'thank_you': {
      const asunto = `Gracias por elegirnos${refCot}`;
      return {
        asunto,
        html: buildHtml({
          asunto,
          preheader: 'Tu opinión nos importa. Y si necesitas otra máquina, acá estamos.',
          titulo: `Gracias ${nombrePila}!`,
          introHtml: `
            <p style="margin:0 0 12px;">
              Esperamos que ${vars.maquinaria ? `la <strong>${escapeHtml(vars.maquinaria)}</strong>` : 'la máquina'} te haya
              servido bien para tu obra. Trabajar contigo fue un gusto.
            </p>
            <p style="margin:0 0 12px;">
              Si pudieras dedicarnos 2 minutos para contarnos cómo te fue
              (qué te gustó, qué podríamos mejorar), nos ayudaría mucho a
              seguir creciendo. Y si necesitas otra máquina más adelante, ya
              tienes nuestro contacto directo.
            </p>
          `,
          customMessage,
          ctaLabel: 'Responder por WhatsApp',
          ctaUrl: WHATSAPP_LINK,
          sentByName,
        }),
      };
    }

    case 'custom': {
      const asunto = `JURMAQ Arriendo — ${nombrePila}`;
      return {
        asunto,
        html: buildHtml({
          asunto,
          preheader: customMessage ? customMessage.slice(0, 80) : 'Mensaje de JURMAQ',
          titulo: `Hola ${nombrePila}`,
          introHtml: '',
          customMessage: customMessage || '(sin mensaje)',
          ctaLabel: 'Responder por WhatsApp',
          ctaUrl: WHATSAPP_LINK,
          sentByName,
        }),
      };
    }
  }
}

/**
 * Devuelve el preview (asunto + html) SIN enviar. Lo usa el modal de
 * preview para que el admin vea exactamente cómo le va a llegar al cliente.
 */
export function previewAdminManualEmail(args: SendAdminManualEmailArgs): RenderedTemplate {
  return renderTemplate(args);
}

/**
 * Envía y retorna el provider ID + el asunto efectivo (para el log).
 */
export async function sendAdminManualEmail(args: SendAdminManualEmailArgs): Promise<{
  ok: boolean;
  asunto: string;
  provider_id?: string;
  error?: string;
}> {
  const { asunto, html } = renderTemplate(args);
  try {
    // skipAdminBcc: false (admin debe quedarse con copia auditoría).
    const result = await transporter.sendMail({
      to: args.to,
      subject: asunto,
      html,
    });
    if (result.error) {
      return { ok: false, asunto, error: String(result.error) };
    }
    return { ok: true, asunto, provider_id: result.data?.id };
  } catch (err) {
    return { ok: false, asunto, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Metadata estática para el modal: label + descripción + variables que cada
 * template necesita. Permite al modal mostrar inputs solo cuando aplican.
 */
export interface KindMeta {
  kind: AdminManualEmailKind;
  label: string;
  description: string;
  requires: Array<keyof AdminManualEmailVars>;
  optional: Array<keyof AdminManualEmailVars>;
  customMessageRequired: boolean;
}

export const ADMIN_MANUAL_EMAIL_KINDS: KindMeta[] = [
  {
    kind: 'follow_up',
    label: '📞 Intentamos contactarte',
    description: 'Cliente no contesta. Pide detalles del proyecto para terminar la cotización.',
    requires: ['nombre'],
    optional: ['numero_cotizacion'],
    customMessageRequired: false,
  },
  {
    kind: 'need_info',
    label: 'ℹ️ Necesitamos más info',
    description: 'Pide fecha exacta, dirección, acceso, operador, combustible.',
    requires: ['nombre'],
    optional: ['numero_cotizacion', 'maquinaria'],
    customMessageRequired: false,
  },
  {
    kind: 'quote_reminder',
    label: '🔄 Recordatorio cotización',
    description: 'Cliente recibió cotización y no respondió. Sigue vigente.',
    requires: ['nombre', 'numero_cotizacion'],
    optional: ['maquinaria'],
    customMessageRequired: false,
  },
  {
    kind: 'reservation_pending',
    label: '💰 Falta reservar',
    description: 'Cliente aceptó pero no pagó el 30% inicial. La máquina no está bloqueada aún.',
    requires: ['nombre'],
    optional: ['numero_cotizacion', 'maquinaria', 'monto_reserva'],
    customMessageRequired: false,
  },
  {
    kind: 'delivery_schedule',
    label: '🚚 Coordinar entrega',
    description: 'Pide fecha, hora, contacto en sitio, acceso para camión.',
    requires: ['nombre'],
    optional: ['numero_cotizacion', 'maquinaria', 'fecha', 'ubicacion'],
    customMessageRequired: false,
  },
  {
    kind: 'return_schedule',
    label: '↩️ Coordinar retiro',
    description: 'Fin del arriendo. Definir día, estado de la máquina, oportunidad renovar.',
    requires: ['nombre'],
    optional: ['numero_cotizacion', 'maquinaria', 'fecha'],
    customMessageRequired: false,
  },
  {
    kind: 'thank_you',
    label: '🙏 Agradecimiento post-arriendo',
    description: 'Cliente terminó el arriendo. Pedir feedback + retención.',
    requires: ['nombre'],
    optional: ['numero_cotizacion', 'maquinaria'],
    customMessageRequired: false,
  },
  {
    kind: 'custom',
    label: '✏️ Mensaje personalizado',
    description: 'Texto libre dentro del wrapper visual JURMAQ. Solo escribe el mensaje.',
    requires: ['nombre'],
    optional: ['numero_cotizacion'],
    customMessageRequired: true,
  },
];
