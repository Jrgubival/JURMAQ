/**
 * Templates de mensaje OTP por contexto + canal.
 *
 * Convención: para WhatsApp/SMS el formato es plain text con *negritas* de
 * WhatsApp. Para email, devuelve HTML enriquecido.
 *
 * Los templates son explícitos a propósito — no usamos un motor de plantillas
 * porque son textos cortos, transaccionales y queremos auditarlos línea a línea
 * para cumplimiento legal (firma electrónica simple).
 */

import type { OtpContexto, OtpCanal } from './types';

export interface TemplateOptions {
  codigo: string;
  vars?: Record<string, string | number>;
}

const MARCA = 'JURMAQ';

function whatsappBody(contexto: OtpContexto, opts: TemplateOptions): string {
  const { codigo, vars = {} } = opts;
  const nombre = vars.nombre ? `${vars.nombre}, ` : '';

  switch (contexto) {
    case 'firma_contrato': {
      const numero = vars.numero ?? '';
      return [
        `*${MARCA}* — Tu código de firma`,
        '',
        `Hola ${nombre}tu código para firmar el contrato ${numero} es:`,
        '',
        `*${codigo}*`,
        '',
        'Vence en 5 minutos. No lo compartas con nadie.',
        '',
        'Si no fuiste tú, ignora este mensaje.',
      ].join('\n');
    }
    case 'garantia_klap': {
      const monto = vars.monto ?? '';
      const last4 = vars.last4 ?? '';
      const numero = vars.numero ?? '';
      return [
        `*${MARCA}* — Confirma tu garantía`,
        '',
        `Estamos a punto de retener $${monto} en tu tarjeta •••• ${last4} como garantía del arriendo ${numero}.`,
        '',
        `Tu código de confirmación: *${codigo}*`,
        '',
        'Vence en 5 minutos.',
      ].join('\n');
    }
    case 'tarjeta_cambio':
      return [
        `*${MARCA}* — Cambio de tarjeta`,
        '',
        `Código para confirmar el cambio de tu medio de pago: *${codigo}*`,
        '',
        'Vence en 5 minutos. Si no fuiste tú, escríbenos.',
      ].join('\n');
    case 'reset_password':
      return [
        `*${MARCA}* — Restablecer contraseña`,
        '',
        `Tu código de seguridad: *${codigo}*`,
        '',
        'Vence en 10 minutos. Si no solicitaste el cambio, ignora este mensaje.',
      ].join('\n');
    case 'login_2fa':
      return [`*${MARCA}* — Código de acceso: *${codigo}*\n\nVence en 5 minutos.`].join('\n');
    case 'verificacion_email':
    default:
      return [`*${MARCA}* — Código de verificación: *${codigo}*`].join('\n');
  }
}

function smsBody(contexto: OtpContexto, opts: TemplateOptions): string {
  // SMS no soporta negritas. Versión más corta para ahorrar segments.
  const { codigo, vars = {} } = opts;
  switch (contexto) {
    case 'firma_contrato':
      return `JURMAQ: Codigo de firma contrato ${vars.numero ?? ''}: ${codigo}. Vence en 5 min.`;
    case 'garantia_klap':
      return `JURMAQ: Confirma garantia $${vars.monto ?? ''} en tarjeta ${vars.last4 ?? ''}. Codigo: ${codigo}. Vence en 5 min.`;
    case 'tarjeta_cambio':
      return `JURMAQ: Codigo para cambio de tarjeta: ${codigo}. Vence en 5 min.`;
    case 'reset_password':
      return `JURMAQ: Codigo para restablecer password: ${codigo}. Vence en 10 min.`;
    case 'login_2fa':
      return `JURMAQ: Codigo de acceso: ${codigo}. Vence en 5 min.`;
    case 'verificacion_email':
    default:
      return `JURMAQ: Codigo: ${codigo}`;
  }
}

function emailBody(contexto: OtpContexto, opts: TemplateOptions): { subject: string; html: string } {
  const { codigo, vars = {} } = opts;
  const codeBlock = `<div style="font-size:32px;letter-spacing:8px;font-weight:700;text-align:center;padding:20px;background:#f5f5f5;border-radius:8px;font-family:monospace;color:#0c1d3a">${codigo}</div>`;

  const wrap = (title: string, body: string) => ({
    subject: `${title} — JURMAQ`,
    html: `<!doctype html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:24px auto;color:#0c1d3a;padding:0 16px">
<h2 style="margin:0 0 12px 0;color:#0c1d3a">${title}</h2>
${body}
${codeBlock}
<p style="font-size:13px;color:#666;margin-top:24px">Si no fuiste tú, ignora este mensaje. Tu cuenta está protegida.</p>
<hr style="border:0;border-top:1px solid #e5e5e5;margin:32px 0 16px"/>
<p style="font-size:11px;color:#999">JURMAQ — Constructora Jorge Ubilla Rivera E.I.R.L.</p>
</body></html>`,
  });

  switch (contexto) {
    case 'firma_contrato':
      return wrap(
        'Tu código para firmar el contrato',
        `<p>Hola ${vars.nombre ?? ''}, este es tu código para firmar el contrato <strong>${vars.numero ?? ''}</strong>. Vence en 5 minutos.</p>`
      );
    case 'garantia_klap':
      return wrap(
        'Confirma tu garantía',
        `<p>Estamos a punto de retener <strong>$${vars.monto ?? ''}</strong> en tu tarjeta •••• ${vars.last4 ?? ''} como garantía del arriendo <strong>${vars.numero ?? ''}</strong>.</p>`
      );
    case 'tarjeta_cambio':
      return wrap('Cambio de tarjeta', `<p>Código para confirmar el cambio de tu medio de pago. Vence en 5 minutos.</p>`);
    case 'reset_password':
      return wrap(
        'Restablece tu contraseña',
        `<p>Recibimos una solicitud para restablecer la contraseña de tu cuenta. Vence en 10 minutos.</p>`
      );
    case 'login_2fa':
      return wrap('Código de acceso', `<p>Confirma tu inicio de sesión con este código.</p>`);
    case 'verificacion_email':
    default:
      return wrap('Verifica tu email', `<p>Confirma que este email es tuyo.</p>`);
  }
}

export function renderTemplate(
  canal: OtpCanal,
  contexto: OtpContexto,
  opts: TemplateOptions
): { body: string; subject?: string; html?: string } {
  if (canal === 'whatsapp') {
    return { body: whatsappBody(contexto, opts) };
  }
  if (canal === 'sms') {
    return { body: smsBody(contexto, opts) };
  }
  // email
  const e = emailBody(contexto, opts);
  return { body: e.html, subject: e.subject, html: e.html };
}
