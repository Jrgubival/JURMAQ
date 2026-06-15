import { transporter } from "../transport";
import { formatCLP, escapeHtml } from "../utils";
import { renderEmailLayout, renderButton, BRAND } from "../layout";
import { env } from "@jurmaq/shared/env";

/**
 * Email "te mejoramos el precio" — contraoferta tras revisar cotización
 * de competencia subida por el cliente. Tabla comparativa con ahorro
 * destacado + CTAs accept/reject (acepta-token o sin token según contexto).
 */
export async function sendContraofertaEmail(
  to: string,
  cotizacion: {
    numero: string;
    nombre: string;
    nombreCompetencia: string;
    itemsOriginales: Array<{ nombre: string; cantidad: number; precio: number }>;
    itemsContraoferta: Array<{ nombre: string; cantidad: number; precio: number }>;
    totalOriginal: number;
    totalContraoferta: number;
    mensaje: string;
    ahorroTotal: number;
    acceptToken?: string;
  }
) {
  const ahorroPercent =
    cotizacion.totalOriginal > 0
      ? Math.round((cotizacion.ahorroTotal / cotizacion.totalOriginal) * 100)
      : 0;

  const green = "#16a34a";
  const red = "#dc2626";

  const comparisonRows = cotizacion.itemsContraoferta
    .map((item, idx) => {
      const original = cotizacion.itemsOriginales[idx];
      const precioOriginal = original ? original.precio : item.precio;
      const ahorro = (precioOriginal - item.precio) * item.cantidad;
      return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid ${BRAND.border};color:${BRAND.text};font-size:13px;">${escapeHtml(item.nombre)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid ${BRAND.border};color:${BRAND.text};font-size:13px;text-align:center;">${item.cantidad}</td>
        <td style="padding:10px 12px;border-bottom:1px solid ${BRAND.border};color:${red};font-size:13px;text-align:right;text-decoration:line-through;">${formatCLP(precioOriginal)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid ${BRAND.border};color:${green};font-size:13px;text-align:right;font-weight:700;">${formatCLP(item.precio)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid ${BRAND.border};color:${green};font-size:13px;text-align:right;">-${formatCLP(ahorro)}</td>
      </tr>`;
    })
    .join("");

  const baseUrl = env.NEXTAUTH_URL || "http://localhost:3000";

  const acceptUrl = `${baseUrl}/cotizacion/${encodeURIComponent(cotizacion.numero)}?action=accept${cotizacion.acceptToken ? `&token=${encodeURIComponent(cotizacion.acceptToken)}` : ""}`;
  const rejectUrl = `${baseUrl}/cotizacion/${encodeURIComponent(cotizacion.numero)}?action=reject${cotizacion.acceptToken ? `&token=${encodeURIComponent(cotizacion.acceptToken)}` : ""}`;

  const bodyHtml = `
<p style="margin:0 0 6px;font-size:13px;font-weight:700;color:${BRAND.orange};text-transform:uppercase;letter-spacing:1.5px;">Te mejoramos el precio</p>
<h1 style="margin:0 0 20px;font-size:24px;font-weight:800;color:${BRAND.navy};line-height:1.25;letter-spacing:-0.4px;">
  Mejor precio que ${escapeHtml(cotizacion.nombreCompetencia)}
</h1>

<div style="background:${green};border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
  <p style="margin:0 0 4px;color:rgba(255,255,255,0.9);font-size:14px;">Te mejoramos el precio de ${escapeHtml(cotizacion.nombreCompetencia)}</p>
  <p style="margin:0;color:#ffffff;font-size:32px;font-weight:800;letter-spacing:-1px;">Ahorras ${formatCLP(cotizacion.ahorroTotal)}</p>
  <p style="margin:4px 0 0;color:rgba(255,255,255,0.9);font-size:16px;font-weight:600;">${ahorroPercent}% menos</p>
</div>

<p style="margin:0 0 8px;color:${BRAND.text};font-size:15px;line-height:1.6;">
  Hola <strong>${escapeHtml(cotizacion.nombre)}</strong>,
</p>
<p style="margin:0 0 20px;color:${BRAND.text};font-size:15px;line-height:1.6;">
  Revisamos tu cotización de <strong>${escapeHtml(cotizacion.nombreCompetencia)}</strong> y te ofrecemos mejores precios en JURMAQ Barraca:
</p>

${
  cotizacion.mensaje
    ? `
<div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:14px 16px;border-radius:0 8px 8px 0;margin-bottom:20px;">
  <p style="margin:0;color:#1e40af;font-size:14px;line-height:1.5;"><strong>Mensaje:</strong> ${escapeHtml(cotizacion.mensaje)}</p>
</div>`
    : ""
}

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${BRAND.border};border-radius:8px;overflow:hidden;margin-bottom:24px;border-collapse:separate;">
  <thead>
    <tr style="background:${BRAND.navy};">
      <th style="padding:10px 12px;color:#ffffff;font-size:13px;font-weight:600;text-align:left;">Producto</th>
      <th style="padding:10px 12px;color:#ffffff;font-size:13px;font-weight:600;text-align:center;">Cant.</th>
      <th style="padding:10px 12px;color:#fca5a5;font-size:13px;font-weight:600;text-align:right;">${escapeHtml(cotizacion.nombreCompetencia)}</th>
      <th style="padding:10px 12px;color:#86efac;font-size:13px;font-weight:600;text-align:right;">JURMAQ</th>
      <th style="padding:10px 12px;color:#86efac;font-size:13px;font-weight:600;text-align:right;">Ahorro</th>
    </tr>
  </thead>
  <tbody>
    ${comparisonRows}
  </tbody>
  <tfoot>
    <tr style="background:#f0fdf4;">
      <td colspan="2" style="padding:14px 12px;font-size:15px;font-weight:700;color:${BRAND.navy};">Total</td>
      <td style="padding:14px 12px;font-size:15px;font-weight:600;color:${red};text-align:right;text-decoration:line-through;">${formatCLP(cotizacion.totalOriginal)}</td>
      <td style="padding:14px 12px;font-size:18px;font-weight:800;color:${green};text-align:right;">${formatCLP(cotizacion.totalContraoferta)}</td>
      <td style="padding:14px 12px;font-size:15px;font-weight:700;color:${green};text-align:right;">-${formatCLP(cotizacion.ahorroTotal)}</td>
    </tr>
  </tfoot>
</table>

<div class="jm-btn" style="text-align:center;margin-bottom:14px;">
  ${renderButton({ href: acceptUrl, label: "Aceptar contraoferta", color: "orange" })}
</div>
<p style="margin:0 0 4px;text-align:center;">
  <a href="${escapeHtml(rejectUrl)}" style="color:${BRAND.textMuted};font-size:13px;text-decoration:underline;">No, gracias. Rechazar contraoferta.</a>
</p>

<div style="background:#f9fafb;border-radius:8px;padding:20px;text-align:center;margin-top:24px;">
  <p style="margin:0 0 8px;color:${BRAND.navy};font-size:14px;font-weight:600;">¿Dudas? Contáctanos</p>
  <p style="margin:0;color:${BRAND.textMuted};font-size:13px;line-height:1.8;">
    WhatsApp: +56 9 7667 3577<br>
    Email: contacto@jurmaq.cl
  </p>
</div>`;

  const html = renderEmailLayout({
    title: `Te mejoramos el precio de ${cotizacion.nombreCompetencia}`,
    preheader: `Ahorras ${formatCLP(cotizacion.ahorroTotal)} (${ahorroPercent}% menos) en tu cotización ${cotizacion.numero}.`,
    bodyHtml,
  });

  await transporter.sendMail({
    to,
    subject: `Te mejoramos el precio de ${cotizacion.nombreCompetencia} - Cotizacion ${cotizacion.numero}`,
    html,
  });
}
