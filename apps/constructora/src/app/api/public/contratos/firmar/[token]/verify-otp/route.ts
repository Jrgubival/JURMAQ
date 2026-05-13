import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { isValidOrigin, sanitizeString } from '@jurmaq/shared/sanitize';
import { logContratoEvent } from '@/lib/contratos-audit';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const MAX_ATTEMPTS = 5;

/**
 * POST /api/public/contratos/firmar/[token]/verify-otp
 * Body: { codigo: string }
 *
 * Validates the most recent unverified OTP for the contract.
 *  - Rejects if expired or exceeded MAX_ATTEMPTS.
 *  - Increments `intentos` on mismatch.
 *  - On success, sets verificado=true and marks contrato.firma_otp_verified.
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

    const body = await request.json().catch(() => ({}));
    const codigo = sanitizeString(body.codigo ?? body.code);
    if (!codigo || !/^\d{6}$/.test(codigo)) {
      return NextResponse.json({ error: 'Codigo invalido' }, { status: 400 });
    }

    const { data: contrato, error: cError } = await supabaseAdmin
      .from('contratos')
      .select('id, estado, firma_token_expira_at')
      .eq('firma_token', token)
      .single();
    if (cError || !contrato) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
    }
    if (contrato.estado === 'firmado' || contrato.estado === 'vigente') {
      return NextResponse.json({ error: 'Este contrato ya fue firmado' }, { status: 409 });
    }
    if (contrato.estado === 'anulado') {
      return NextResponse.json({ error: 'Este contrato fue anulado' }, { status: 410 });
    }
    if (contrato.firma_token_expira_at && Number.isFinite(new Date(contrato.firma_token_expira_at).getTime()) && new Date(contrato.firma_token_expira_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Este enlace de firma vencio. Solicita al administrador que reenvie el contrato.' }, { status: 410 });
    }

    // Fetch the most recent unverified OTP for this contract.
    const { data: otp, error: oError } = await supabaseAdmin
      .from('contratos_otp')
      .select('*')
      .eq('contrato_id', contrato.id)
      .eq('verificado', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (oError) throw oError;
    if (!otp) {
      return NextResponse.json(
        { error: 'No hay codigo activo. Solicita uno nuevo.' },
        { status: 400 }
      );
    }

    // Expiry check.
    if (new Date(otp.expires_at).getTime() < Date.now()) {
      return NextResponse.json(
        { error: 'El codigo expiro. Solicita uno nuevo.' },
        { status: 410 }
      );
    }

    // Max-attempts check (before incrementing).
    if ((otp.intentos ?? 0) >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Solicita un codigo nuevo.' },
        { status: 429 }
      );
    }

    // Validate. OTPs nuevos (post audit A9) se guardan como bcrypt hash.
    // OTPs legacy en plaintext (de minutos antes del deploy) se comparan
    // con timingSafeEqual. Detectamos el formato por el prefijo bcrypt.
    const stored = String(otp.codigo || '');
    const submitted = String(codigo || '');
    let mismatch: boolean;
    if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
      mismatch = !bcrypt.compareSync(submitted, stored);
    } else {
      const a = Buffer.from(stored, 'utf8');
      const b = Buffer.from(submitted, 'utf8');
      mismatch = a.length !== b.length || !crypto.timingSafeEqual(a, b);
    }
    if (mismatch) {
      // Atomic compare-and-set: the WHERE clause includes `intentos=currentValue`
      // so two concurrent requests race for the same expected value and only
      // ONE wins. The loser gets `updated=null` and is told to retry. This
      // closes the TOCTOU hole where two parallel guesses could each pass the
      // line-79 MAX_ATTEMPTS check before either incremented the counter.
      const currentIntentos = otp.intentos ?? 0;
      const { data: updated } = await supabaseAdmin
        .from('contratos_otp')
        .update({ intentos: currentIntentos + 1 })
        .eq('id', otp.id)
        .eq('intentos', currentIntentos)
        .select('intentos')
        .maybeSingle();

      if (!updated) {
        // CAS failed — another concurrent attempt incremented first. Treat
        // the race as a duplicate and ask the user to retry, rather than
        // letting both guesses count as one increment.
        return NextResponse.json(
          { error: 'Intento concurrente, vuelve a intentar.' },
          { status: 409 }
        );
      }
      const newIntentos = updated.intentos;
      const remaining = Math.max(0, MAX_ATTEMPTS - newIntentos);
      // Audit-log every failed attempt — pattern of failures is evidence in
      // a dispute and helps detect brute-force attempts.
      await logContratoEvent(request, contrato.id, 'otp_failed', {
        attempts_used: newIntentos,
        attempts_remaining: remaining,
      });
      return NextResponse.json(
        { error: 'Codigo incorrecto', remaining_attempts: remaining },
        { status: 401 }
      );
    }

    // Success: mark OTP verified and flag on contrato.
    const { error: otpUpdateError } = await supabaseAdmin
      .from('contratos_otp')
      .update({ verificado: true })
      .eq('id', otp.id);
    if (otpUpdateError) throw otpUpdateError;

    const { error: contratoUpdateError } = await supabaseAdmin
      .from('contratos')
      .update({ firma_otp_verified: true })
      .eq('id', contrato.id);
    if (contratoUpdateError) throw contratoUpdateError;

    // Audit log: OTP verified successfully. This is one of the strongest
    // single events in the evidence package — proves possession of the
    // arrendatario's email at the moment of signing.
    await logContratoEvent(request, contrato.id, 'otp_verified');

    return NextResponse.json({ success: true, verified: true });
  } catch (error) {
    console.error('Error al verificar OTP:', error);
    return NextResponse.json({ error: 'Error al verificar OTP' }, { status: 500 });
  }
}
