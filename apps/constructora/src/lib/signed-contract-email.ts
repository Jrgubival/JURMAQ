import { renderContrato } from '@/lib/contrato-render';
import { buildRenderVars, injectFirmasIntoHtml } from '@/app/api/admin/contratos/_helpers';
import { sendSignedContractEmail } from '@jurmaq/shared/mail/email';
import { hid } from '@jurmaq/shared/logging';
import { env } from '@jurmaq/shared/env';

/**
 * Renderiza el contrato firmado (con ambas firmas), genera el PDF y envía el
 * email al arrendatario. Si la generación del PDF falla (chromium OOM/timeout),
 * envía igualmente el email con link de descarga.
 *
 * Compartido entre:
 *   - POST /api/public/contratos/firmar/[token]/sign  (envío inmediato post-firma)
 *   - GET/POST /api/cron/email-queue/retry            (reintento; REGENERA el PDF)
 *
 * Antes esta lógica vivía solo en el route de firma y el reintento mandaba el
 * email SIN PDF y con link vacío (audit 2.3).
 */
export async function sendSignedContractEmailAsync(args: {
  contratoId: number;
  numero: string;
  toEmail: string;
  arrendatarioNombre: string;
  telefonoCliente?: string;
  firmaTimestamp: string;
  firmaHash: string;
  firmaIp: string;
  /** Aceptado por compatibilidad con el call site de firma; no se usa al render. */
  firmaUserAgent?: string;
  firmaBase64: string;
  firmaArrendador?: string | null;
  templateContenido: string;
  contrato: Record<string, unknown>;
}) {
  // Build the signed-version vars (with all firma_* metadata visible).
  const vars = buildRenderVars(
    args.contrato as Parameters<typeof buildRenderVars>[0],
    (args.contrato.maquinarias ?? null) as Parameters<typeof buildRenderVars>[1],
  );
  vars.firma_ip = args.firmaIp;
  vars.firma_timestamp = args.firmaTimestamp;
  vars.otp_codigo = 'VERIFICADO';
  vars.firma_email = (args.contrato.arrendatario_email as string) || '';
  vars.hash_sha256 = args.firmaHash;

  const renderedHtml = renderContrato(args.templateContenido, vars);

  // Inject AMBAS firmas — arrendador (JURMAQ) si ya firmó + arrendatario.
  const htmlWithFirma = injectFirmasIntoHtml(renderedHtml, {
    firmaArrendador: args.firmaArrendador ?? null,
    firmaArrendatario: args.firmaBase64,
  });

  // Try to generate a real PDF. If chromium fails, fall back to download link.
  let pdfBuffer: Buffer | undefined;
  try {
    const { htmlToPdfBuffer } = await import('@/lib/pdf-generator');
    pdfBuffer = await htmlToPdfBuffer(htmlWithFirma);
    console.log('[signed-contract-pdf-ok]', args.contratoId, 'bytes=', pdfBuffer.length);
  } catch (err) {
    console.error('[signed-contract-pdf-fail]', hid(args.contratoId), err instanceof Error ? err.message : err);
    pdfBuffer = undefined;
  }

  const baseUrl = env.NEXTAUTH_URL || 'https://jurmaq.cl';
  const pdfUrl = `${baseUrl}/api/admin/contratos/${args.contratoId}/pdf`;

  await sendSignedContractEmail(args.toEmail, {
    numero: args.numero,
    arrendatarioNombre: args.arrendatarioNombre,
    pdfUrl,
    telefonoCliente: args.telefonoCliente,
    pdfBuffer,
  });
}
