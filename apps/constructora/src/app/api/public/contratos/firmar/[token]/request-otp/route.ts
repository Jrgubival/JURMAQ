import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { rateLimit } from '@jurmaq/shared/rate-limit';
import { generateOtpCode } from '@/lib/twilio-sms';
import { sendOtpEmail } from '@jurmaq/shared/mail/email';
import { logContratoEvent, resolveIpGeolocation } from '@/lib/contratos-audit';
import { getClientIp } from '@jurmaq/shared/rate-limit';
import { renderTemplate, normalizarTelefonoCL } from '@jurmaq/shared/otp';
import bcrypt from 'bcryptjs';
import { hid } from '@jurmaq/shared/logging';

/**
 * POST /api/public/contratos/firmar/[token]/request-otp
 *
 * Flow:
 *  1. Validate token -> lookup contract.
 *  2. Rate-limit to 3 OTP requests / 15 minutes per contract.
 *  3. Invalidate any existing unverified OTPs for this contract (delete them).
 *  4. Generate a new 6-digit code, store with expiry = NOW + 15 minutes.
 *  5. Send via EMAIL (replaced SMS — Twilio trial cannot send to unverified
 *     numbers in Chile and the paid tier is ~USD 20/mo + per-message).
 *     Email has equivalent legal validity under Ley 19.799 (firma
 *     electrónica simple) — same evidence package: OTP + IP + timestamp +
 *     canvas + content hash.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    if (!isValidOrigin(request)) {
      return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
    }

    const { token } = await params;
    if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
      return NextResponse.json({ error: 'Token invalido' }, { status: 400 });
    }

    const { data: contrato, error } = await supabaseAdmin
      .from('contratos')
      .select('id, numero, estado, arrendatario_email, arrendatario_telefono, arrendatario_nombre, arrendatario_razon_social, cedula_url, rut_verified, firma_token_expira_at')
      .eq('firma_token', token)
      .single();

    if (error || !contrato) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
    }

    if (contrato.estado === 'firmado' || contrato.estado === 'vigente') {
      return NextResponse.json(
        { error: 'Este contrato ya fue firmado' },
        { status: 409 }
      );
    }
    if (contrato.estado === 'anulado') {
      return NextResponse.json({ error: 'Este contrato fue anulado' }, { status: 410 });
    }
    if (contrato.firma_token_expira_at && Number.isFinite(new Date(contrato.firma_token_expira_at).getTime()) && new Date(contrato.firma_token_expira_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Este enlace de firma vencio. Solicita al administrador que reenvie el contrato.' }, { status: 410 });
    }

    if (!contrato.arrendatario_email) {
      return NextResponse.json(
        { error: 'El contrato no tiene email configurado para enviar el código' },
        { status: 400 }
      );
    }

    // Gate the OTP behind identity upload. The customer can't proceed to OTP
    // until they've verified their RUT (with módulo-11 dígito verificador) and
    // uploaded a photo of their cédula. This raises the firma electrónica
    // simple to "casi-FEA" by binding the signing event to a verifiable
    // identity document instead of just an email address.
    if (!contrato.cedula_url || !contrato.rut_verified) {
      return NextResponse.json(
        {
          error: 'Antes de solicitar el código debes verificar tu identidad: ingresa tu RUT y sube tu cédula.',
          identity_required: true,
        },
        { status: 412 }
      );
    }

    // Rate limit: 3 OTPs per 15 minutes per contract id.
    const limiter = rateLimit(`contrato-otp:${contrato.id}`, {
      maxAttempts: 3,
      windowSeconds: 15 * 60,
    });
    if (!limiter.success) {
      return NextResponse.json(
        {
          error: 'Demasiados intentos. Intenta nuevamente en unos minutos.',
          resetAt: limiter.resetAt,
        },
        { status: 429 }
      );
    }

    // Invalidate previous unverified OTPs.
    await supabaseAdmin
      .from('contratos_otp')
      .delete()
      .eq('contrato_id', contrato.id)
      .eq('verificado', false);

    // 15-minute expiry — balance between giving the customer time to find
    // the email vs limiting the replay window if the email is intercepted.
    // Ley 19.799 doesn't prescribe a specific TTL but shorter is better for
    // the integrity of the evidence package. If the customer needs more time
    // they can request a fresh OTP (which invalidates the previous one above).
    const codigo = generateOtpCode();
    // Hashear el OTP antes de persistirlo. Antes guardabamos el codigo en
    // texto plano: cualquiera con acceso a la DB (developer en Supabase
    // dashboard, backup leak) podia leer codigos vivos y suplantar firmas.
    // Cost 8 mantiene verify rapido (~10ms) sin sacrificar resistencia a
    // ofensiva offline. El codigo plano viaja solo al email del firmante.
    const codigoHash = bcrypt.hashSync(codigo, 8);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { error: insertError } = await supabaseAdmin
      .from('contratos_otp')
      .insert({
        contrato_id: contrato.id,
        codigo: codigoHash,
        // The DB column is named `telefono` (legacy from SMS days) but
        // stores the email channel address now. We could rename it later;
        // keeping the schema stable for now avoids a migration.
        telefono: contrato.arrendatario_email,
        intentos: 0,
        verificado: false,
        expires_at: expiresAt,
      });

    if (insertError) throw insertError;

    const arrendatarioName =
      contrato.arrendatario_nombre || contrato.arrendatario_razon_social || '';

    // Best-effort WhatsApp send FIRST si está configurado OpenWA + hay
    // teléfono del arrendatario. Si éxito, también mandamos email como
    // respaldo (el cliente ve ambos canales). Si OpenWA no está configurado
    // o falla, sólo va por email.
    //
    // Cargamos el provider dinámicamente para no acoplar build-time al
    // paquete shared/otp en este endpoint legacy. El OTP se guarda en
    // contratos_otp como antes — verify/sign no cambian.
    let whatsappEnviado = false;
    let canalUsado: 'whatsapp' | 'email' = 'email';
    if (contrato.arrendatario_telefono) {
      try {
        const { openwaProvider } = await import('@jurmaq/shared/otp');
        const healthy = await openwaProvider.isHealthy().catch(() => false);
        if (healthy) {
          const tel = normalizarTelefonoCL(String(contrato.arrendatario_telefono));
          const rendered = renderTemplate('whatsapp', 'firma_contrato', {
            codigo,
            vars: { nombre: arrendatarioName, numero: contrato.numero ?? '' },
          });
          const waRes = await openwaProvider.send(tel, rendered.body);
          if (waRes.ok) {
            whatsappEnviado = true;
            canalUsado = 'whatsapp';
          }
        }
      } catch (waErr) {
        console.warn(
          '[contrato-otp-whatsapp-skip]',
          hid(contrato.id),
          waErr instanceof Error ? waErr.message : String(waErr),
        );
      }
    }

    // Email — siempre va, sea como primario o respaldo de WhatsApp.
    const result = await sendOtpEmail(contrato.arrendatario_email, codigo, arrendatarioName);
    if (!result.success && !whatsappEnviado) {
      console.error('[contrato-otp-email-fail]', hid(contrato.id), result.error);
      return NextResponse.json(
        { error: 'No se pudo enviar el código. Intenta nuevamente.' },
        { status: 502 }
      );
    }

    // Audit log: capture geolocation + record the OTP-request event for the
    // contract evidence trail (Ley 19.799 evidence package).
    const ip = getClientIp(request);
    const geo = await resolveIpGeolocation(ip);
    await logContratoEvent(
      request,
      contrato.id,
      'otp_requested',
      { channel: canalUsado, also_email: result.success, whatsapp_enviado: whatsappEnviado, expires_at: expiresAt },
      geo
    );

    const msg = whatsappEnviado
      ? `Codigo enviado por WhatsApp${result.success ? ' y email' : ''}. Valido por 15 minutos.`
      : `Codigo enviado por email. Valido por 15 minutos.`;

    return NextResponse.json({
      success: true,
      channel: canalUsado,
      whatsapp_enviado: whatsappEnviado,
      email_enviado: result.success,
      to_masked: maskEmail(contrato.arrendatario_email),
      message: msg,
      expires_at: expiresAt,
    });
  } catch (error) {
    console.error('Error al solicitar OTP:', error);
    return NextResponse.json({ error: 'Error al solicitar OTP' }, { status: 500 });
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(local.length - 2, 1))}@${domain}`;
}
