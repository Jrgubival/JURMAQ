import { transporter } from "../transport";
import { escapeHtml } from "../utils";

/**
 * Envía un código OTP de 6 dígitos por email para verificación de firma de
 * contrato. Lo usa /api/public/contratos/firmar/[token]/request-otp.
 *
 * ¿Por qué email y no SMS?
 *  - Twilio trial sólo permite enviar a números verificados; el plan pago
 *    parte ~USD 20/mes + costo por mensaje. Email es gratis con Resend.
 *  - Legalmente equivalente bajo Ley 19.799 (firma electrónica simple).
 *  - El email del cliente ya se recolecta en el formulario del contrato.
 *
 * Audit A12: NO se hace BCC al admin. El OTP es secreto del firmante;
 * copiarlo a buzones internos es fuga de privacidad y, peor, si esos
 * buzones se comprometen el atacante puede leer códigos en uso para
 * suplantar firmas. El log de envío deja rastro auditable.
 */
export async function sendOtpEmail(
  to: string,
  codigo: string,
  arrendatarioNombre?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!to || typeof to !== "string") {
    return { success: false, error: "email destinatario requerido" };
  }

  const nombre = arrendatarioNombre?.trim() || "";
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(12,29,58,0.08);">
        <tr>
          <td style="background:#0c1d3a;padding:28px 32px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.3px;">JURMAQ</h1>
            <p style="margin:6px 0 0;color:#e6b422;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:3px;">Firma de contrato</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 24px;text-align:center;">
            <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">Hola${nombre ? " " + escapeHtml(nombre) : ""},</p>
            <p style="margin:0 0 24px;color:#0c1d3a;font-size:16px;font-weight:600;">Tu código de verificación es:</p>
            <div style="display:inline-block;padding:18px 32px;background:#fff7ed;border:2px solid #ea580c;border-radius:12px;letter-spacing:14px;font-size:36px;font-weight:800;font-family:'SF Mono',Menlo,Monaco,Consolas,monospace;color:#0c1d3a;">
              ${escapeHtml(codigo)}
            </div>
            <p style="margin:24px 0 0;color:#6b7280;font-size:13px;line-height:1.55;">
              Este código es válido por <strong>15 minutos</strong>.<br>
              Ingrésalo en la página de firma para completar el contrato.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 24px;">
            <div style="border-top:1px solid #e5e7eb;padding-top:16px;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
                <strong style="color:#374151;">¿No solicitaste este código?</strong><br>
                Ignora este correo. Si recibes muchos sin haberlos pedido, escríbenos a contacto@jurmaq.cl.
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
              Firma electrónica simple conforme a la <strong>Ley 19.799</strong> de Chile.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

  try {
    const result = await transporter.sendMail({
      to,
      subject: `Tu código JURMAQ: ${codigo}`,
      html,
      skipAdminBcc: true,
    });
    if (result.error) {
      return { success: false, error: result.error.message || "Error al enviar" };
    }
    return { success: true, messageId: result.data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
