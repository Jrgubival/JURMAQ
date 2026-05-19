import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { renderContrato } from '@/lib/contrato-render';
import { buildRenderVars, injectFirmasIntoHtml } from '@/app/api/admin/contratos/_helpers';
import { sendSignedContractEmail } from '@jurmaq/shared/mail/email';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
import { logContratoEvent, resolveIpGeolocation } from '@/lib/contratos-audit';
import crypto from 'crypto';
import { hid } from '@jurmaq/shared/logging';

/**
 * Use the Node runtime (not Edge) — puppeteer-core + @sparticuz/chromium-min
 * needs Node APIs and a few hundred MB to launch headless Chrome for the
 * post-signature PDF generation.
 */
export const runtime = 'nodejs';
/** Allow up to 60s — chromium first cold-start can take 10-15s. */
export const maxDuration = 60;

/** Max length of the base64 signature payload (~400KB is plenty for a 1024px canvas). */
const MAX_SIGNATURE_BYTES = 400 * 1024;

/**
 * POST /api/public/contratos/firmar/[token]/sign
 * Body: { firma_base64: string }  (data:image/png;base64,... from HTML canvas)
 *
 * Pre-conditions:
 *  - Token maps to a contract.
 *  - contrato.firma_otp_verified is true.
 *  - estado is not already firmado/anulado.
 *
 * On success:
 *  - Store firma_arrendatario (base64), firma_ip, firma_user_agent,
 *    firma_timestamp=NOW, firma_hash = sha256(rendered html).
 *  - Set estado = 'firmado'.
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

    // Rate-limit by both token and IP. The token-level limit prevents an
    // attacker from spamming sign attempts against a single contract; the IP
    // limit catches scrapers iterating over multiple tokens.
    const ip = getClientIp(request);
    const tokenLimiter = rateLimit(`sign:${token}`, { maxAttempts: 3, windowSeconds: 600 });
    if (!tokenLimiter.success) {
      return NextResponse.json(
        { error: 'Demasiados intentos de firma. Intenta más tarde.' },
        { status: 429 }
      );
    }
    const ipSignLimiter = rateLimit(`sign-ip:${ip}`, { maxAttempts: 10, windowSeconds: 600 });
    if (!ipSignLimiter.success) {
      return NextResponse.json(
        { error: 'Demasiados intentos de firma. Intenta más tarde.' },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const firmaBase64: unknown = body.firma_base64 ?? body.signature;
    if (typeof firmaBase64 !== 'string' || firmaBase64.length < 100) {
      return NextResponse.json({ error: 'Firma invalida' }, { status: 400 });
    }
    if (firmaBase64.length > MAX_SIGNATURE_BYTES) {
      return NextResponse.json(
        { error: 'Firma demasiado grande. Redibuja con menos trazos.' },
        { status: 413 }
      );
    }
    // Accept "data:image/png;base64,...." or raw base64.
    if (!/^(data:image\/(png|jpeg|jpg|webp);base64,)?[A-Za-z0-9+/=\s]+$/.test(firmaBase64)) {
      return NextResponse.json({ error: 'Formato de firma invalido' }, { status: 400 });
    }

    // Fetch contract + maquinaria for hashing.
    const { data: contrato, error } = await supabaseAdmin
      .from('contratos')
      .select('*, maquinarias(*)')
      .eq('firma_token', token)
      .single();

    if (error || !contrato) {
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
    if (!contrato.firma_otp_verified) {
      return NextResponse.json(
        { error: 'Debes verificar el codigo OTP antes de firmar' },
        { status: 400 }
      );
    }
    // Identity must have been uploaded BEFORE signing (Ley 19.799 evidence
    // package). Without RUT + cedula_hash, the signature is just an OTP
    // confirmation, not a tied-to-person signing event.
    if (!contrato.cedula_hash || !contrato.rut_verified) {
      return NextResponse.json(
        {
          error: 'Falta verificar tu identidad. Sube tu cédula y vuelve a intentar.',
          identity_required: true,
        },
        { status: 412 }
      );
    }

    // Fetch template so we can hash the exact rendered HTML.
    let template: { contenido: string } | null = null;
    if (contrato.template_id) {
      const { data } = await supabaseAdmin
        .from('contratos_templates')
        .select('contenido')
        .eq('id', contrato.template_id)
        .maybeSingle();
      template = data ?? null;
    }
    if (!template) {
      const { data } = await supabaseAdmin
        .from('contratos_templates')
        .select('contenido')
        .eq('activo', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      template = data ?? null;
    }
    if (!template) {
      return NextResponse.json({ error: 'Template no disponible' }, { status: 500 });
    }

    // Capture request metadata.
    const xff = request.headers.get('x-forwarded-for') || '';
    const firmaIp = xff.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
    const firmaUserAgent = request.headers.get('user-agent') || '';
    const firmaTimestamp = new Date().toISOString();

    // Pull the verified OTP record so we can include its fingerprint in the
    // evidence-package hash. Ley 19.799 art. 3 demands the firma electronica
    // simple be unequivocally tied to the signing event — including a hash of
    // the OTP code and the channel (email) makes the evidence tamper-evident
    // and prevents the contract being repudiated as "I never received an OTP".
    const { data: otpRecord } = await supabaseAdmin
      .from('contratos_otp')
      .select('codigo, telefono, created_at')
      .eq('contrato_id', contrato.id)
      .eq('verificado', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const otpEvidenceHash = otpRecord
      ? crypto
          .createHash('sha256')
          .update(
            `${otpRecord.codigo}|${otpRecord.telefono}|${otpRecord.created_at}|${firmaIp}|${firmaTimestamp}`,
            'utf8'
          )
          .digest('hex')
      : null;

    // Render the contract with the signature metadata baked in, then hash it.
    const vars = buildRenderVars(contrato, contrato.maquinarias ?? null);
    // Override metadata placeholders so the hash reflects the signed snapshot.
    vars.firma_ip = firmaIp;
    vars.firma_timestamp = firmaTimestamp;
    vars.otp_codigo = 'VERIFICADO';
    vars.firma_email = contrato.arrendatario_email;
    // hash_sha256 is computed AFTER, so leave it empty during the rendering we hash.
    vars.hash_sha256 = '';

    const renderedForHash = renderContrato(template.contenido, vars);
    // The final evidence hash binds together — change any one of these and
    // the hash changes, breaking the contract's integrity proof:
    //   - the rendered contract HTML (contenido del documento)
    //   - the OTP fingerprint (canal + código + timestamp)
    //   - the cédula hash (identity document fingerprint)
    //   - the validated RUT (tax ID with módulo-11 verified digit)
    //   - the signing IP and timestamp
    const firmaHash = crypto
      .createHash('sha256')
      .update(
        [
          renderedForHash,
          `otp:${otpEvidenceHash || 'none'}`,
          `cedula:${contrato.cedula_hash || 'none'}`,
          `rut:${contrato.rut_verified || 'none'}`,
          `ip:${firmaIp}`,
          `ts:${firmaTimestamp}`,
        ].join('|'),
        'utf8'
      )
      .digest('hex');

    // Resolve geolocation from IP — this is decorative metadata for the
    // admin/audit view ("¿el cliente firmó desde Chile o desde el
    // extranjero?"). Best-effort: any failure leaves nulls.
    const geo = await resolveIpGeolocation(firmaIp);

    // Persist everything.
    // Audit M4: UPDATE condicional anti race-condition. Si dos pestanas
    // disparan sign() simultaneamente, antes ambos pasaban: el segundo
    // sobreescribia firma_hash/firma_ip/etc del primero, dejando un contrato
    // "firmado" con metadata mezclada. Ahora `.neq('estado', 'firmado')`
    // hace que el segundo update no afecte filas (count=0) y devolvemos 409.
    const { error: updateError, data: updatedRows } = await supabaseAdmin
      .from('contratos')
      .update({
        firma_arrendatario: firmaBase64,
        firma_ip: firmaIp,
        firma_user_agent: firmaUserAgent,
        firma_timestamp: firmaTimestamp,
        firma_hash: firmaHash,
        firma_pais: geo.pais,
        firma_region: geo.region,
        firma_ciudad: geo.ciudad,
        estado: 'firmado',
        // B-2: snapshot del HTML interpolado en el momento de firmar. Si el
        // admin edita el template después, las regeneraciones del PDF van a
        // usar ESTE snapshot (no el template vivo), preservando integridad
        // visual del contrato firmado para disputas.
        contrato_html_snapshot: renderedForHash,
      })
      .eq('id', contrato.id)
      .neq('estado', 'firmado')
      .neq('estado', 'vigente')
      .neq('estado', 'anulado')
      .select('id');

    if (updateError) throw updateError;
    if (!updatedRows || updatedRows.length === 0) {
      return NextResponse.json(
        { error: 'Este contrato ya fue firmado o anulado por otro proceso. Recarga la pagina.' },
        { status: 409 }
      );
    }

    // Audit log: signing completed. Together with identity_uploaded,
    // otp_requested and otp_verified rows in contratos_audit_log, this gives
    // a complete forensic trail for any dispute.
    await logContratoEvent(
      request,
      contrato.id,
      'sign_completed',
      {
        firma_hash_first12: firmaHash.substring(0, 12),
        cedula_hash_first12: String(contrato.cedula_hash || '').substring(0, 12) || null,
      },
      geo
    );

    // Generate the signed-contract PDF and send it to the cliente as an
    // email attachment. We AWAIT this on purpose — Vercel's serverless
    // runtime may kill background work after the response is sent, so
    // fire-and-forget is unreliable. The cliente sees a small spinner on
    // the firmar page during this ~10-15s window. The contract record is
    // already saved; if email/PDF fails we log it and still return 200.
    let emailSent = false;
    if (contrato.arrendatario_email) {
      try {
        await sendSignedContractEmailAsync({
          contratoId: contrato.id,
          numero: contrato.numero,
          toEmail: contrato.arrendatario_email,
          arrendatarioNombre:
            contrato.arrendatario_nombre || contrato.arrendatario_razon_social || '',
          telefonoCliente: contrato.arrendatario_telefono || undefined,
          firmaTimestamp,
          firmaHash,
          firmaIp,
          firmaUserAgent,
          firmaBase64,
          firmaArrendador: contrato.firma_arrendador || null,
          templateContenido: template.contenido,
          contrato,
        });
        emailSent = true;
      } catch (err) {
        // Audit M3: el envio fallo (Resend caido, chromium OOM, etc.) pero el
        // contrato YA esta firmado en DB. Antes el cliente quedaba sin copia
        // y solo habia un console.error. Ahora encolamos el reintento; el
        // cron `/api/cron/email-queue/retry` lo retoma con backoff.
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('[signed-contract-async-fail-enqueue-retry]', hid(contrato.id), errMsg);
        try {
          const { enqueueEmail } = await import('@/lib/email-queue');
          await enqueueEmail(
            {
              to: contrato.arrendatario_email,
              subject: `Contrato firmado ${contrato.numero} — JURMAQ`,
              templateKind: 'signed_contract',
              payload: {
                numero: contrato.numero,
                nombre: contrato.arrendatario_nombre || contrato.arrendatario_razon_social || '',
                // El cron va a regenerar el PDF cuando reintente; guardar
                // pdfBufferBase64 aqui inflaria la queue innecesariamente.
              },
              context: { contrato_id: contrato.id, numero: contrato.numero },
              maxAttempts: 5,
            },
            errMsg
          );
        } catch (queueErr) {
          console.error('[signed-contract-enqueue-fail]', hid(contrato.id), queueErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      estado: 'firmado',
      firma_hash: firmaHash,
      firma_timestamp: firmaTimestamp,
      email_sent: emailSent,
    });
  } catch (error) {
    console.error('Error al firmar contrato:', error);
    return NextResponse.json({ error: 'Error al firmar contrato' }, { status: 500 });
  }
}

/**
 * Generate the signed-contract PDF and send it as an email attachment to
 * the cliente. Runs after we've already returned 200 to the firmar page —
 * any failure here is logged but doesn't affect the signature record.
 */
async function sendSignedContractEmailAsync(args: {
  contratoId: number;
  numero: string;
  toEmail: string;
  arrendatarioNombre: string;
  telefonoCliente?: string;
  firmaTimestamp: string;
  firmaHash: string;
  firmaIp: string;
  firmaUserAgent: string;
  firmaBase64: string;
  firmaArrendador?: string | null;
  templateContenido: string;
  contrato: Record<string, unknown>;
}) {
  // Build the signed-version vars (with all firma_* metadata visible).
  const vars = buildRenderVars(
    args.contrato as Parameters<typeof buildRenderVars>[0],
    (args.contrato.maquinarias ?? null) as Parameters<typeof buildRenderVars>[1]
  );
  vars.firma_ip = args.firmaIp;
  vars.firma_timestamp = args.firmaTimestamp;
  vars.otp_codigo = 'VERIFICADO';
  vars.firma_email = (args.contrato.arrendatario_email as string) || '';
  vars.hash_sha256 = args.firmaHash;

  const renderedHtml = renderContrato(args.templateContenido, vars);

  // Inject AMBAS firmas — la del arrendador (JURMAQ) si el admin ya firmó
  // y la del arrendatario que se acaba de capturar. Helper compartido en
  // _helpers.ts para que sign, render, pdf y send-signature usen la misma
  // lógica.
  const htmlWithFirma = injectFirmasIntoHtml(renderedHtml, {
    firmaArrendador: args.firmaArrendador ?? null,
    firmaArrendatario: args.firmaBase64,
  });

  // Try to generate a real PDF. If chromium fails (memory, timeout,
  // missing binary), fall back to sending the email with a download link
  // — better than not sending anything.
  let pdfBuffer: Buffer | undefined;
  try {
    const { htmlToPdfBuffer } = await import('@/lib/pdf-generator');
    pdfBuffer = await htmlToPdfBuffer(htmlWithFirma);
    console.log('[signed-contract-pdf-ok]', args.contratoId, 'bytes=', pdfBuffer.length);
  } catch (err) {
    console.error('[signed-contract-pdf-fail]', hid(args.contratoId), err instanceof Error ? err.message : err);
    pdfBuffer = undefined;
  }

  const baseUrl = process.env.NEXTAUTH_URL || 'https://jurmaq.cl';
  const pdfUrl = `${baseUrl}/api/admin/contratos/${args.contratoId}/pdf`;

  await sendSignedContractEmail(args.toEmail, {
    numero: args.numero,
    arrendatarioNombre: args.arrendatarioNombre,
    pdfUrl,
    telefonoCliente: args.telefonoCliente,
    pdfBuffer,
  });
}
