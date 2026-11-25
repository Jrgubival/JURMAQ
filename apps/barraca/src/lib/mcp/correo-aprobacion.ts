import "server-only";
/**
 * Correo con el enlace de aprobación para Jorge. Va SIN copia oculta
 * (skipAdminBcc): el enlace es un secreto de un solo uso y no debe quedar en
 * otras casillas. Todo texto dinámico pasa por escapeHtml.
 */
import { escapeHtml, renderButton, renderEmailLayout, transporter } from "@jurmaq/shared/mail/email";
import { TEXTO_MOTIVO, type AvisoAprobacion } from "./aprobaciones.ts";

export function construirCorreoAprobacion(a: AvisoAprobacion): { asunto: string; html: string } {
  const horas = Math.max(1, Math.round((a.venceEn - Date.now()) / 3_600_000));
  const motivos = a.motivos.map((m) => `<li style="margin:4px 0;">${escapeHtml(TEXTO_MOTIVO[m] ?? m)}</li>`).join("");
  const bodyHtml = `
<p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#0c1d3a;">Claude quiere hacer un cambio en la tienda y necesita tu OK.</p>
<p style="margin:0 0 12px;font-size:15px;line-height:1.5;">${escapeHtml(a.resumen)}</p>
<p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;">Por qué pide aprobación</p>
<ul style="margin:0 0 18px;padding-left:20px;font-size:15px;">${motivos}</ul>
<div style="text-align:center;margin:22px 0;">${renderButton({ href: a.enlace, label: "Revisar y decidir", color: "navy" })}</div>
<p style="margin:0;font-size:13px;color:#6b7280;line-height:1.55;">El enlace sirve una sola vez y vence en unas ${horas} horas. Al abrirlo solo verás el detalle: no pasa nada hasta que toques Aprobar o Rechazar.<br>Si no esperabas este correo, ignóralo: sin tu aprobación el cambio no se hace.</p>`;
  return {
    asunto: "Aprobación pendiente: cambio en la tienda",
    html: renderEmailLayout({ title: "Aprobación pendiente", preheader: "Claude espera tu OK para hacer un cambio en la tienda.", bodyHtml }),
  };
}

export async function enviarCorreoAprobacion(a: AvisoAprobacion): Promise<boolean> {
  const { asunto, html } = construirCorreoAprobacion(a);
  const r = await transporter.sendMail({ to: a.para, subject: asunto, html, skipAdminBcc: true });
  return !r.error;
}
