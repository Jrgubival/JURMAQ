import { Resend } from "resend";
import { ADMIN_BCC_EMAILS, EMAIL_FROM } from "../transport";
import { escapeHtml } from "../utils";
import { maskEmail } from "../../logging";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Envía el email del contrato firmado al cliente.
 *
 * Si `pdfBuffer` viene, el PDF se adjunta al email (copia archival inmutable
 * que vive en el inbox del cliente). Si no, el email entrega un link de
 * descarga — fallback cuando puppeteer-core/Chromium no está disponible
 * en un cold start específico.
 *
 * Body también ofrece un botón "Reenviar por WhatsApp" pre-cargado con el
 * teléfono del cliente para que pueda compartir el PDF a un colega.
 *
 * Triggered tras firma de canvas exitosa en /sign.
 *
 * NOTA: NO usa el wrapper transporter porque tiene attachment binario.
 * Llama Resend directamente para no tener que extender la signature del
 * wrapper.
 */
export async function sendSignedContractEmail(
  to: string,
  data: {
    numero: string;
    arrendatarioNombre: string;
    pdfUrl: string;
    telefonoCliente?: string;
    pdfBuffer?: Buffer;
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!to) return { success: false, error: "email destinatario requerido" };

  const waMessage = `Hola, soy ${data.arrendatarioNombre}. Te comparto el contrato firmado ${data.numero}: ${data.pdfUrl}`;
  const waLink = data.telefonoCliente
    ? `https://wa.me/${data.telefonoCliente.replace(/[^\d]/g, "")}?text=${encodeURIComponent(waMessage)}`
    : `https://wa.me/?text=${encodeURIComponent(waMessage)}`;

  const hasAttachment = !!data.pdfBuffer;

  const attachmentBlurb = hasAttachment
    ? `Adjuntamos en este mismo correo el PDF firmado de tu contrato. Es una copia inmutable: lo que ves es lo que quedó firmado, con tu firma electrónica, IP, timestamp y hash del contenido — todo respaldado por la <strong>Ley 19.799</strong>.`
    : `El PDF firmado quedó disponible para descarga desde el link de abajo. Lleva tu firma electrónica, IP, timestamp y hash del contenido — todo respaldado por la <strong>Ley 19.799</strong>.`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(12,29,58,0.08);">
        <tr>
          <td style="background:#0c1d3a;padding:28px 32px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">JURMAQ</h1>
            <p style="margin:6px 0 0;color:#16a34a;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:3px;">Contrato firmado ✓</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 24px;">
            <p style="margin:0 0 16px;color:#0c1d3a;font-size:18px;font-weight:700;">¡Listo, ${escapeHtml(data.arrendatarioNombre)}!</p>
            <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.55;">
              Tu contrato <strong>${escapeHtml(data.numero)}</strong> quedó firmado y registrado en nuestro sistema.
            </p>
            <p style="margin:0 0 28px;color:#374151;font-size:15px;line-height:1.55;">
              ${attachmentBlurb}
            </p>
            <div style="text-align:center;margin:24px 0;">
              <a href="${escapeHtml(data.pdfUrl)}" target="_blank" style="display:inline-block;background:#0c1d3a;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;margin-right:8px;">
                ${hasAttachment ? "Ver online" : "Descargar PDF firmado"}
              </a>
              <a href="${escapeHtml(waLink)}" target="_blank" style="display:inline-block;background:#25D366;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">
                Reenviar por WhatsApp
              </a>
            </div>
            <p style="margin:24px 0 0;color:#6b7280;font-size:13px;line-height:1.55;">
              Si tienes consultas escribenos por WhatsApp a <strong>+56 9 7667 3577</strong> o respondiendo a contacto@jurmaq.cl.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:14px;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:11px;">
              JURMAQ · Constructora Jorge Ubilla Rivera E.I.R.L. · Curicó, Maule
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

  // BCC admin igual que el wrapper
  const bccSet = new Set<string>();
  const toLower = to.trim().toLowerCase();
  for (const admin of ADMIN_BCC_EMAILS) {
    if (admin && admin !== toLower) bccSet.add(admin);
  }
  bccSet.delete(toLower);
  const bcc = Array.from(bccSet);

  try {
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to: [to],
      ...(bcc.length > 0 ? { bcc } : {}),
      subject: `Contrato firmado ${data.numero} — JURMAQ`,
      html,
      ...(data.pdfBuffer
        ? {
            attachments: [
              {
                filename: `JURMAQ-Contrato-${data.numero}.pdf`,
                content: data.pdfBuffer,
              },
            ],
          }
        : {}),
    });

    if (result.error) {
      console.error("[signed-contract-email-fail]", { to: maskEmail(to), numero: data.numero, error: result.error });
      return { success: false, error: result.error.message };
    }
    console.log("[signed-contract-email-ok]", { id: result.data?.id, to: maskEmail(to), numero: data.numero, hasAttachment });
    return { success: true, messageId: result.data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[signed-contract-email-throw]", { to: maskEmail(to), numero: data.numero, message: msg });
    return { success: false, error: msg };
  }
}
