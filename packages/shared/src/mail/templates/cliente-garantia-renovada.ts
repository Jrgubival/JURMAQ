import { transporter } from '../transport';
import { buildKlapEmailHtml, type KlapEmailVars } from './klap-shared';

export async function sendGarantiaRenovadaEmail(
  to: string,
  vars: KlapEmailVars,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!to) return { success: false, error: 'destinatario requerido' };
  const { subject, html } = buildKlapEmailHtml('garantia_renovada', vars);
  try {
    const result = await transporter.sendMail({ to, subject, html, skipAdminBcc: true });
    return {
      success: true,
      messageId: typeof result === 'object' && result && 'messageId' in result
        ? String((result as { messageId: unknown }).messageId)
        : undefined,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
