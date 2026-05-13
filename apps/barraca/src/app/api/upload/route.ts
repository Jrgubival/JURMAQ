import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Verify the file's magic bytes match one of the allowed formats.
 * Client-provided file.type is trusted only after this check.
 */
function detectFileFormat(buffer: Buffer): 'pdf' | 'jpg' | 'png' | null {
  if (buffer.length < 8) return null;
  // PDF: %PDF- (25 50 44 46 2D)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46 && buffer[4] === 0x2d) return 'pdf';
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) return 'png';
  return null;
}

export async function POST(request: NextRequest) {
  try {
    // CSRF
    if (!isValidOrigin(request)) {
      return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
    }

    // Rate limit: 5 uploads per hour per IP. Upload is expensive and anonymous.
    const ip = getClientIp(request);
    const { success } = rateLimit(`upload:${ip}`, { maxAttempts: 5, windowSeconds: 3600 });
    if (!success) {
      return NextResponse.json({ error: 'Demasiadas subidas, intenta en una hora' }, { status: 429 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se proporciono archivo' }, { status: 400 });
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo no puede superar 10MB' }, { status: 400 });
    }

    // Validate file type (client-declared — will be confirmed via magic bytes below)
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Solo se permiten archivos PDF, JPG o PNG' },
        { status: 400 }
      );
    }

    // Read buffer and verify magic bytes
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const detected = detectFileFormat(buffer);
    if (!detected) {
      return NextResponse.json(
        { error: 'Contenido del archivo invalido. Solo se aceptan PDF, JPG o PNG reales.' },
        { status: 400 }
      );
    }

    // Cross-check: declared type must match detected format
    const expected = detected === 'pdf' ? 'application/pdf' : detected === 'jpg' ? 'image/jpeg' : 'image/png';
    if (file.type !== expected) {
      return NextResponse.json(
        { error: 'El tipo declarado del archivo no coincide con su contenido' },
        { status: 400 }
      );
    }

    // Generate unique filename using the DETECTED extension (ignore client-supplied name)
    const ext = detected === 'jpg' ? 'jpg' : detected;
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 10);
    const fileName = `competencia/${timestamp}-${randomStr}.${ext}`;

    // Upload to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from('cotizaciones')
      .upload(fileName, buffer, {
        contentType: expected,
        upsert: false,
      });

    if (error) {
      console.error('Error al subir archivo:', error);
      return NextResponse.json({ error: 'Error al subir el archivo' }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('cotizaciones')
      .getPublicUrl(data.path);

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (error) {
    console.error('Error en upload:', error);
    return NextResponse.json({ error: 'Error al procesar el archivo' }, { status: 500 });
  }
}
