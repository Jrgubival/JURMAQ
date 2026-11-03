import { transporter } from "../transport";
import { escapeHtml } from "../utils";

export const ASUNTO_LOGIN_RENTAL = "Tu código para entrar al panel de arriendo";

/**
 * Código de 6 dígitos para entrar al panel de rental.jurmaq.cl.
 * Sin BCC (skipAdminBcc): el código es secreto de quien entra.
 */
export async function sendLoginRentalEmail(
  to: string,
  codigo: string,
): Promise<{ success: boolean }> {
  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#fff;border-radius:14px;overflow:hidden;">
        <tr>
          <td style="background:#081428;padding:24px 32px;text-align:center;">
            <span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.3px;">JURMAQ</span>
            <span style="color:#f2b705;font-size:15px;font-weight:600;margin-left:4px;">Arriendo</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 24px;text-align:center;">
            <p style="margin:0 0 20px;color:#081428;font-size:16px;font-weight:600;">Tu código para entrar al panel es:</p>
            <div style="display:inline-block;padding:16px 28px;background:#fbf3db;border:2px solid #f2b705;border-radius:12px;letter-spacing:12px;font-size:34px;font-weight:800;font-family:'SF Mono',Menlo,Monaco,Consolas,monospace;color:#081428;">
              ${escapeHtml(codigo)}
            </div>
            <p style="margin:20px 0 0;color:#6b7280;font-size:13px;line-height:1.55;">
              Sirve por <strong>10 minutos</strong> y una sola vez.<br>
              No se lo des a nadie: nadie de JURMAQ te lo va a pedir.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 24px;">
            <div style="border-top:1px solid #e5e7eb;padding-top:16px;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
                ¿No lo pediste? Ignora este correo, nadie puede entrar sin el código.
              </p>
            </div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

  const result = await transporter.sendMail({
    to,
    subject: ASUNTO_LOGIN_RENTAL,
    html,
    skipAdminBcc: true,
  });
  return { success: !result.error };
}
