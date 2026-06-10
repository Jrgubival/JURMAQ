import { Resend } from "resend";
import { ADMIN_BCC_EMAILS, EMAIL_FROM } from "../transport";
import { escapeHtml } from "../utils";
import { maskEmail } from "../../logging";
import { formatCLP } from "../../format";
import { HQ } from "../../seo";
import { tieneOperadorIncluido } from "../../seo/operador";
import { env } from "@jurmaq/shared/env";

const resend = new Resend(env.RESEND_API_KEY);

export interface CotizacionArriendoEmailData {
  numero: string;
  cliente_nombre: string;
  cliente_email: string;
  maquinaria_nombre: string;
  /** tipoDb de la máquina — para mostrar "operador/conductor incluido" solo
   *  en los tipos donde es verdad (ver tieneOperadorIncluido). Opcional para
   *  no romper llamadas existentes. */
  maquinaria_tipo?: string | null;
  fecha_servicio: string; // ISO YYYY-MM-DD
  ubicacion_servicio: string;
  unidades_solicitadas: number;
  unidad: string;
  desglose: {
    precio_uso: number;
    traslado_combustible: number;
    traslado_carga: number;
    traslado_operario: number;
    peajes: number;
    subtotal_neto: number;
    iva: number;
    total: number;
  };
  url_publica?: string; // optional link to view online
}

function row(label: string, value: number, opts?: { strong?: boolean; muted?: boolean }) {
  if (!value || value <= 0) return "";
  const td_style = opts?.muted
    ? "padding:8px 0;color:#6b7280;font-size:14px;"
    : opts?.strong
      ? "padding:8px 0;font-weight:700;color:#0c1d3a;font-size:15px;"
      : "padding:8px 0;color:#1f2937;font-size:14px;";
  const td_amt_style = td_style + "text-align:right;";
  return `
    <tr>
      <td style="${td_style}border-bottom:1px solid #f3f4f6;">${escapeHtml(label)}</td>
      <td style="${td_amt_style}border-bottom:1px solid #f3f4f6;">${formatCLP(value)}</td>
    </tr>`;
}

function buildEmailHtml(data: CotizacionArriendoEmailData): string {
  const fechaFmt = new Date(data.fecha_servicio).toLocaleDateString("es-CL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>Cotización ${escapeHtml(data.numero)}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:24px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <tr>
      <td style="background:#0c1d3a;padding:24px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">JURMAQ</h1>
        <p style="margin:4px 0 0;color:#cbd5e1;font-size:13px;">Cotización de arriendo de maquinaria</p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;">
        <h2 style="margin:0 0 4px;color:#0c1d3a;font-size:18px;">¡Gracias por tu solicitud, ${escapeHtml(data.cliente_nombre)}!</h2>
        <p style="margin:0 0 20px;color:#6b7280;font-size:14px;">
          Recibimos tu solicitud de cotización. A continuación el detalle completo.
        </p>

        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin-bottom:20px;">
          <p style="margin:0 0 8px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Número de cotización</p>
          <p style="margin:0;font-size:20px;font-weight:700;color:#ea580c;font-family:'Courier New',monospace;">${escapeHtml(data.numero)}</p>
        </div>

        <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:20px;">
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-size:13px;border-bottom:1px solid #f3f4f6;">Máquina</td>
            <td style="padding:8px 0;color:#1f2937;font-size:13px;text-align:right;font-weight:600;border-bottom:1px solid #f3f4f6;">${escapeHtml(data.maquinaria_nombre)}${
              tieneOperadorIncluido(data.maquinaria_tipo)
                ? `<br><span style="font-size:12px;font-weight:600;color:#346538;">${data.maquinaria_tipo === "camion" ? "Conductor incluido en la tarifa" : "Operador incluido en la tarifa"}</span>`
                : ""
            }</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-size:13px;border-bottom:1px solid #f3f4f6;">Fecha del servicio</td>
            <td style="padding:8px 0;color:#1f2937;font-size:13px;text-align:right;border-bottom:1px solid #f3f4f6;">${escapeHtml(fechaFmt)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-size:13px;border-bottom:1px solid #f3f4f6;">Ubicación</td>
            <td style="padding:8px 0;color:#1f2937;font-size:13px;text-align:right;border-bottom:1px solid #f3f4f6;">${escapeHtml(data.ubicacion_servicio)}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-size:13px;">Duración</td>
            <td style="padding:8px 0;color:#1f2937;font-size:13px;text-align:right;">${data.unidades_solicitadas} ${escapeHtml(data.unidad)}${data.unidades_solicitadas !== 1 ? "s" : ""}</td>
          </tr>
        </table>

        <h3 style="margin:24px 0 8px;color:#0c1d3a;font-size:16px;">Desglose</h3>
        <table cellpadding="0" cellspacing="0" width="100%">
          ${row("Uso de máquina", data.desglose.precio_uso)}
          ${row("Traslado combustible", data.desglose.traslado_combustible)}
          ${row("Carga / descarga", data.desglose.traslado_carga)}
          ${row("Operario tiempo trabajado", data.desglose.traslado_operario)}
          ${row("Peajes", data.desglose.peajes)}
          ${row("Subtotal neto", data.desglose.subtotal_neto, { strong: true })}
          ${row("IVA 19%", data.desglose.iva, { muted: true })}
          <tr>
            <td style="padding:16px 0 0;font-weight:700;color:#0c1d3a;font-size:18px;">Total con IVA</td>
            <td style="padding:16px 0 0;text-align:right;font-weight:700;color:#ea580c;font-size:20px;">${formatCLP(data.desglose.total)}</td>
          </tr>
        </table>

        <div style="margin-top:24px;padding:14px;background:#dbeafe;border:1px solid #93c5fd;border-radius:6px;">
          <p style="margin:0;color:#1e40af;font-size:13px;line-height:1.6;">
            <strong>¿Aceptas la cotización?</strong><br>
            Responde a este email o contáctanos por WhatsApp al
            <a href="${HQ.whatsapp}" style="color:#1e40af;text-decoration:underline;">${HQ.telefonoDisplay}</a>
            para coordinar la entrega y firmar el contrato.
          </p>
        </div>

        ${data.url_publica
          ? `<p style="margin:20px 0 0;text-align:center;">
              <a href="${escapeHtml(data.url_publica)}" style="display:inline-block;background:#ea580c;color:#fff;padding:10px 22px;border-radius:6px;font-weight:600;text-decoration:none;">Ver cotización online</a>
            </p>`
          : ""}

        <p style="margin:24px 0 0;font-size:11px;color:#9ca3af;line-height:1.5;">
          Esta cotización es válida por 30 días desde su emisión.
          Los precios incluyen IVA y son en pesos chilenos (CLP).
          Para cualquier consulta responde a este email o escríbenos a <a href="mailto:contacto@jurmaq.cl" style="color:#9ca3af;">contacto@jurmaq.cl</a>.
        </p>
      </td>
    </tr>
    <tr>
      <td style="background:#f9fafb;padding:16px 24px;text-align:center;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:11px;color:#9ca3af;">
          JURMAQ — Constructora Jorge Ubilla Rivera E.I.R.L.<br>
          <a href="https://jurmaq.cl" style="color:#9ca3af;">jurmaq.cl</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export async function sendCotizacionArriendoEmail(data: CotizacionArriendoEmailData) {
  const subject = `Cotización ${data.numero} — JURMAQ`;
  try {
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to: [data.cliente_email],
      bcc: ADMIN_BCC_EMAILS.length > 0 ? ADMIN_BCC_EMAILS : undefined,
      subject,
      html: buildEmailHtml(data),
    });

    if (result.error) {
      console.error("[cot-arriendo-email-fail]", { to: maskEmail(data.cliente_email), numero: data.numero, error: result.error });
      return { success: false, error: result.error.message };
    }
    console.log("[cot-arriendo-email-ok]", { id: result.data?.id, to: maskEmail(data.cliente_email), numero: data.numero });
    return { success: true, messageId: result.data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cot-arriendo-email-throw]", { to: maskEmail(data.cliente_email), numero: data.numero, message: msg });
    return { success: false, error: msg };
  }
}
