import 'server-only';
import { formatCLP } from '@jurmaq/shared/format';
import { escapeHtml } from '@jurmaq/shared/mail/utils';
import { transporter } from '@jurmaq/shared/mail/transport';
import { logSafeError, maskEmail } from '@jurmaq/shared/logging';
import { SITIO, enlaceWhatsapp } from './sitio';

export async function enviarAcuseSolicitud(d: {
  numero: string;
  nombre: string;
  correo: string;
  maquina: string;
  cantidad: string;
  lugar: string;
  neto: number;
}): Promise<void> {
  const estimado = d.neto > 0
    ? `<p>Valor referencial: <strong>${escapeHtml(formatCLP(d.neto))} + IVA</strong>. El traslado se cotiza aparte.</p>`
    : '';
  try {
    await transporter.sendMail({
      to: d.correo,
      subject: `Recibimos tu solicitud ${d.numero} · JURMAQ`,
      html: `<div style="font-family:Arial,sans-serif;color:#111;max-width:520px">
        <h2 style="margin:0 0 12px">Recibimos tu solicitud</h2>
        <p>Hola ${escapeHtml(d.nombre)}, te vamos a contactar con la cotización.</p>
        <p><strong>${escapeHtml(d.numero)}</strong><br>${escapeHtml(d.maquina)} · ${escapeHtml(d.cantidad)}<br>${escapeHtml(d.lugar)}</p>
        ${estimado}
        <p>¿Dudas? <a href="${escapeHtml(enlaceWhatsapp(`Hola, tengo una consulta por la solicitud ${d.numero}.`))}">${escapeHtml(SITIO.telefonoVisible)}</a></p>
      </div>`,
    });
  } catch {
    logSafeError('[solicitud-web] correo', { correo: maskEmail(d.correo) });
  }
}
