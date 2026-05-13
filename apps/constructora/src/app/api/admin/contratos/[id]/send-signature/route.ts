import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { NextRequest, NextResponse } from 'next/server';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { transporter } from '@jurmaq/shared/mail/email';
import crypto from 'crypto';

/**
 * Base URL used to construct the public signature link.
 * In production this is jurmaq.cl; in dev it falls back to NEXTAUTH_URL.
 */
function publicBaseUrl(): string {
  if (process.env.NODE_ENV === 'production') {
    return 'https://jurmaq.cl';
  }
  return process.env.NEXTAUTH_URL || 'http://localhost:3000';
}

/**
 * Build the signature email HTML. Kept inline (rather than in lib/email) because
 * it's specific to the contratos flow and unlikely to be reused.
 */
function buildSignatureEmailHtml(params: {
  arrendatarioNombre: string;
  numero: string;
  link: string;
}): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background-color:#0c1d3a;padding:32px;text-align:center;border-radius:12px 12px 0 0;">
            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">JURMAQ</h1>
            <p style="margin:4px 0 0;color:#ea580c;font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:2px;">Arriendo de Maquinaria</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:32px;">
            <h2 style="margin:0 0 16px;color:#0c1d3a;font-size:22px;font-weight:700;">Firma tu contrato</h2>
            <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px;">
              Hola <strong>${params.arrendatarioNombre}</strong>,
            </p>
            <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px;">
              Tu contrato de arriendo <strong>#${params.numero}</strong> esta listo para ser firmado electronicamente.
              Para finalizarlo, haz click en el boton y sigue los pasos:
            </p>
            <ol style="color:#374151;font-size:14px;line-height:1.8;margin:0 0 20px 20px;padding:0;">
              <li>Revisa el contrato completo.</li>
              <li>Solicita el codigo de verificacion (SMS a tu celular).</li>
              <li>Ingresa el codigo de 6 digitos recibido.</li>
              <li>Firma con tu dedo o mouse y confirma.</li>
            </ol>
            <div style="text-align:center;margin:24px 0;">
              <a href="${params.link}" style="display:inline-block;background-color:#ea580c;color:#ffffff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;">
                Firmar Contrato
              </a>
            </div>
            <p style="color:#6b7280;font-size:12px;line-height:1.5;margin:16px 0 0;text-align:center;">
              Este enlace es personal y confidencial. No lo compartas.<br>
              Si no solicitaste este contrato, puedes ignorar este correo.
            </p>
            <div style="background-color:#f9fafb;border-radius:8px;padding:16px;margin-top:24px;text-align:center;">
              <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.6;">
                Dudas? Escribenos por WhatsApp a <a href="https://wa.me/56976673577" style="color:#ea580c;">+56 9 7667 3577</a><br>
                o al correo <a href="mailto:contacto@jurmaq.cl" style="color:#ea580c;">contacto@jurmaq.cl</a>
              </p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background-color:#0c1d3a;padding:16px;text-align:center;border-radius:0 0 12px 12px;">
            <p style="margin:0;color:#9ca3af;font-size:11px;">Constructora Jorge Ubilla Rivera E.I.R.L. - RUT 76.624.872-1</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/**
 * POST /api/admin/contratos/[id]/send-signature
 * Transitions the contract to `pendiente_firma` and emails the arrendatario
 * a link to the public signature page.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isValidOrigin(request)) {
      return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
    }

    const session = await requirePermission('contratos', 'update');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { id } = await params;
    const numericId = parseInt(id, 10);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      return NextResponse.json({ error: 'ID invalido' }, { status: 400 });
    }

    const { data: contrato, error: fetchError } = await supabaseAdmin
      .from('contratos')
      .select('*')
      .eq('id', numericId)
      .single();

    if (fetchError || !contrato) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
    }

    if (contrato.estado === 'firmado' || contrato.estado === 'anulado') {
      return NextResponse.json(
        { error: `No se puede enviar para firma un contrato en estado "${contrato.estado}"` },
        { status: 409 }
      );
    }

    // Cada envio genera (o renueva) el token con un expiry de 24h. Antes
    // reusabamos el token existente eternamente; ahora el admin que reenvia
    // refresca la ventana de firma y lo viejo queda invalido.
    const firmaToken: string = crypto.randomBytes(32).toString('hex');
    const firmaTokenExpiraAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Flip estado to pendiente_firma and persist new token + expiry.
    const update: Record<string, unknown> = {
      estado: 'pendiente_firma',
      firma_token: firmaToken,
      firma_token_expira_at: firmaTokenExpiraAt,
    };

    const { error: updateError } = await supabaseAdmin
      .from('contratos')
      .update(update)
      .eq('id', numericId);

    if (updateError) {
      const code = (updateError as { code?: string }).code;
      const msg = (updateError as { message?: string }).message || '';
      if (code === 'PGRST204' || /firma_token_expira_at/.test(msg)) {
        console.error('[send-signature] columna firma_token_expira_at no existe. Ejecuta migrate-firma-token-expiry.sql');
        return NextResponse.json(
          { error: 'Falta migracion: ejecuta scripts/migrate-firma-token-expiry.sql en Supabase' },
          { status: 503 }
        );
      }
      throw updateError;
    }

    // Build public link.
    const link = `${publicBaseUrl()}/contrato/firmar/${firmaToken}`;

    // Send the email. We log failures but return success on the main flow
    // because the status is already updated — admin can resend if needed.
    const arrendatarioDisplayName: string =
      (contrato.arrendatario_tipo === 'juridica'
        ? contrato.arrendatario_razon_social
        : contrato.arrendatario_nombre) || 'Cliente';

    const emailHtml = buildSignatureEmailHtml({
      arrendatarioNombre: arrendatarioDisplayName,
      numero: contrato.numero,
      link,
    });

    try {
      await transporter.sendMail({
        to: contrato.arrendatario_email,
        subject: 'Firma tu contrato de arriendo - JURMAQ',
        html: emailHtml,
      });
      // PII-redacted log: contract id is enough to correlate in DB without
      // leaking the customer email through Vercel function logs.
      console.log('[contrato-signature-email-ok]', contrato.id);
    } catch (emailError: unknown) {
      const msg = emailError instanceof Error ? emailError.message : String(emailError);
      console.error('[contrato-signature-email-fail]', contrato.id, msg);
      return NextResponse.json(
        {
          success: true,
          warning: 'Contrato marcado como pendiente_firma, pero el envio del correo fallo',
          link,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: true,
      estado: 'pendiente_firma',
      link,
    });
  } catch (error) {
    console.error('Error al enviar contrato para firma:', error);
    return NextResponse.json({ error: 'Error al enviar contrato para firma' }, { status: 500 });
  }
}
