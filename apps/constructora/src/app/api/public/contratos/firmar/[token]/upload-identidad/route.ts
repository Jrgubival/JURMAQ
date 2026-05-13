import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { isValidOrigin, sanitizeString } from '@jurmaq/shared/sanitize';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
import { validateRut, formatRut } from '@/lib/rut';
import { logContratoEvent, resolveIpGeolocation } from '@/lib/contratos-audit';
import crypto from 'crypto';
import { hid } from '@jurmaq/shared/logging';

/**
 * POST /api/public/contratos/firmar/[token]/upload-identidad
 * Body: { rut: string, cedula_base64: string }
 *
 * Pre-condición de la firma electrónica reforzada (Ley 19.799 + buenas
 * prácticas de FEA): antes de poder pedir el OTP, el firmante debe:
 *   1. Confirmar su RUT chileno (validado con dígito verificador).
 *   2. Subir foto de su cédula (anverso, JPG/PNG, ≤4 MB).
 *
 * Lo que hacemos con la cédula:
 *   - SHA-256 del archivo entra al evidence package del contrato firmado.
 *   - El archivo se sube a Supabase Storage en bucket privado (`cedulas-firma`).
 *   - URL firmada de larga duración se guarda en `contratos.cedula_url` para
 *     que el admin pueda verla en disputas.
 *
 * Eleva la firma electrónica simple a "casi-FEA" sin pagar por proveedor
 * acreditado. Para contratos > UF 1000 se recomienda usar FEA aparte
 * (E-Sign Chile, TOC, DigitalSign).
 *
 * Idempotente: si ya se subió una identidad para este contrato, la sobrescribe
 * (el cliente puede haber subido una cédula borrosa y querer reenviar). Cada
 * intento queda en el audit log.
 */
export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_CEDULA_BYTES = 4 * 1024 * 1024; // 4 MB
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const STORAGE_BUCKET = 'cedulas-firma';

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

    // Rate-limit por token e IP. El abuso de este endpoint sería intentar
    // subir muchas cédulas distintas hasta que una pase OCR o similar — lo
    // limitamos.
    const ip = getClientIp(request);
    const tokenLimit = rateLimit(`uid:${token}`, { maxAttempts: 5, windowSeconds: 600 });
    if (!tokenLimit.success) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Espera unos minutos.' },
        { status: 429 }
      );
    }
    const ipLimit = rateLimit(`uid-ip:${ip}`, { maxAttempts: 15, windowSeconds: 600 });
    if (!ipLimit.success) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Espera unos minutos.' },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));

    // Validate RUT with module-11 algorithm.
    const rutInput = sanitizeString(body.rut);
    if (!rutInput || !validateRut(rutInput)) {
      return NextResponse.json(
        { error: 'RUT inválido. Verifica el dígito verificador.' },
        { status: 400 }
      );
    }
    const rutFormatted = formatRut(rutInput);

    // Validate cédula base64 payload.
    const cedulaB64 = typeof body.cedula_base64 === 'string' ? body.cedula_base64 : null;
    if (!cedulaB64) {
      return NextResponse.json(
        { error: 'Foto de cédula requerida.' },
        { status: 400 }
      );
    }

    // Parse data:image/...;base64,XXXX
    const dataUrlMatch = cedulaB64.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/);
    if (!dataUrlMatch) {
      return NextResponse.json(
        { error: 'Formato de imagen inválido. Sube JPG, PNG o WebP.' },
        { status: 400 }
      );
    }
    const mime = dataUrlMatch[1];
    const rawB64 = dataUrlMatch[2];
    if (!ALLOWED_MIMES.has(mime)) {
      return NextResponse.json(
        { error: 'Solo se aceptan imágenes JPG, PNG o WebP.' },
        { status: 400 }
      );
    }

    // Decode and check size + magic bytes.
    let cedulaBuffer: Buffer;
    try {
      cedulaBuffer = Buffer.from(rawB64, 'base64');
    } catch {
      return NextResponse.json(
        { error: 'Imagen corrupta.' },
        { status: 400 }
      );
    }
    if (cedulaBuffer.length > MAX_CEDULA_BYTES) {
      return NextResponse.json(
        { error: 'La imagen supera los 4 MB. Comprímela e inténtalo de nuevo.' },
        { status: 400 }
      );
    }
    if (cedulaBuffer.length < 5000) {
      // Real cédula photos are at least ~50 KB. Anything below 5KB is an
      // attempt to upload a 1×1 pixel sentinel.
      return NextResponse.json(
        { error: 'La imagen es demasiado pequeña para ser una cédula real.' },
        { status: 400 }
      );
    }
    // Magic bytes to confirm the declared MIME isn't lying.
    const magic = cedulaBuffer.subarray(0, 12);
    const isJpeg = magic[0] === 0xff && magic[1] === 0xd8 && magic[2] === 0xff;
    const isPng = magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4e && magic[3] === 0x47;
    const isWebp = magic[0] === 0x52 && magic[1] === 0x49 && magic[2] === 0x46 && magic[3] === 0x46;
    if (!isJpeg && !isPng && !isWebp) {
      return NextResponse.json(
        { error: 'El archivo no parece una imagen válida.' },
        { status: 400 }
      );
    }

    // Look up the contract.
    const { data: contrato, error: cError } = await supabaseAdmin
      .from('contratos')
      .select('id, estado, arrendatario_rut, firma_token_expira_at')
      .eq('firma_token', token)
      .single();
    if (cError || !contrato) {
      return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 });
    }
    if (contrato.estado === 'firmado' || contrato.estado === 'vigente') {
      return NextResponse.json(
        { error: 'Este contrato ya fue firmado.' },
        { status: 409 }
      );
    }
    if (contrato.estado === 'anulado') {
      return NextResponse.json(
        { error: 'Este contrato fue anulado.' },
        { status: 410 }
      );
    }
    if (contrato.firma_token_expira_at && Number.isFinite(new Date(contrato.firma_token_expira_at).getTime()) && new Date(contrato.firma_token_expira_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Este enlace de firma vencio. Solicita al administrador que reenvie el contrato.' }, { status: 410 });
    }

    // If the contract was emitted with a RUT, the uploaded RUT must match.
    if (contrato.arrendatario_rut) {
      const cleanContractRut = String(contrato.arrendatario_rut).replace(/[.\s-]/g, '').toUpperCase();
      const cleanInputRut = rutInput.replace(/[.\s-]/g, '').toUpperCase();
      if (cleanContractRut !== cleanInputRut) {
        return NextResponse.json(
          { error: 'El RUT no coincide con el del arrendatario en el contrato.' },
          { status: 400 }
        );
      }
    }

    // SHA-256 hash of the cédula image — goes into the evidence package.
    const cedulaHash = crypto.createHash('sha256').update(cedulaBuffer).digest('hex');

    // Upload to Supabase Storage (private bucket — admin-only access).
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const storagePath = `contrato-${contrato.id}/${Date.now()}-${cedulaHash.substring(0, 12)}.${ext}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, cedulaBuffer, {
        contentType: mime,
        upsert: true,
        cacheControl: '3600',
      });
    if (uploadError) {
      console.error('[upload-identidad-storage-fail]', hid(contrato.id), uploadError.message);
      return NextResponse.json(
        { error: 'Error al guardar la cédula. Intenta de nuevo.' },
        { status: 500 }
      );
    }

    // Persist on the contract row.
    const { error: updateError } = await supabaseAdmin
      .from('contratos')
      .update({
        cedula_url: storagePath,
        cedula_hash: cedulaHash,
        rut_verified: rutFormatted,
        identidad_subida_at: new Date().toISOString(),
      })
      .eq('id', contrato.id);
    if (updateError) {
      console.error('[upload-identidad-update-fail]', hid(contrato.id), updateError.message);
      return NextResponse.json(
        { error: 'Error al guardar la identidad. Intenta de nuevo.' },
        { status: 500 }
      );
    }

    // Geolocation + audit log (best-effort).
    const geo = await resolveIpGeolocation(ip);
    await logContratoEvent(
      request,
      contrato.id,
      'identity_uploaded',
      {
        rut: rutFormatted,
        cedula_size: cedulaBuffer.length,
        cedula_mime: mime,
        cedula_hash_first12: cedulaHash.substring(0, 12),
      },
      geo
    );

    return NextResponse.json({
      success: true,
      identidad_subida: true,
      next_step: 'request_otp',
    });
  } catch (error) {
    console.error('Error al subir identidad:', error);
    return NextResponse.json(
      { error: 'Error al procesar identidad' },
      { status: 500 }
    );
  }
}
