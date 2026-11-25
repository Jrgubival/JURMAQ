import "server-only";
/**
 * Cableado real de los avisos a Jorge (aviso-operacion.ts): lee el secreto BARRACA_APROBADOR_EMAIL y manda el correo por
 * Resend, sin copia oculta (igual que el código de login y el enlace de aprobación). Todo texto pasa por escapeHtml.
 */
import { escapeHtml, renderButton, renderEmailLayout, transporter } from "@jurmaq/shared/mail/email";
import type { CorreoAviso, DepsAviso } from "./aviso-operacion.ts";
import { baseCanonica } from "./config.ts";

export function htmlCorreoAviso(c: CorreoAviso): string {
  const filas = c.filas
    .map((f) => `<tr><td style="padding:4px 14px 4px 0;color:#6b7280;vertical-align:top;white-space:nowrap;">${escapeHtml(f.etiqueta)}</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(f.valor)}</td></tr>`)
    .join("");
  const botones = c.botones.map((b) => renderButton({ href: b.href, label: b.etiqueta, color: "navy" })).join(" ");
  const bodyHtml = `
<p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#0c1d3a;">${escapeHtml(c.titulo)}</p>
<p style="margin:0 0 14px;font-size:15px;line-height:1.5;">${escapeHtml(c.intro)}</p>
<table style="margin:0 0 18px;font-size:15px;border-collapse:collapse;">${filas}</table>
<div style="text-align:center;margin:22px 0;">${botones}</div>
<p style="margin:0;font-size:13px;color:#6b7280;line-height:1.55;">${escapeHtml(c.pie)}</p>`;
  return renderEmailLayout({ title: c.titulo, preheader: c.asunto, bodyHtml });
}

export function depsAvisoReales(): DepsAviso {
  return {
    // Secreto de Cloudflare (`wrangler secret put BARRACA_APROBADOR_EMAIL`), nunca en el código.
    aprobadorEmail: process.env.BARRACA_APROBADOR_EMAIL,
    base: baseCanonica(),
    async enviar(c) {
      const r = await transporter.sendMail({ to: c.para, subject: c.asunto, html: htmlCorreoAviso(c), skipAdminBcc: true });
      return !r.error;
    },
  };
}
