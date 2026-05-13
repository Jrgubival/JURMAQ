import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
import { COMBUSTIBLE_BUCKET, getSignedUrl } from '../_helpers';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

function detectFileFormat(buffer: Buffer): 'pdf' | 'jpg' | 'png' | 'webp' | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return 'pdf';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) return 'png';
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) return 'webp';
  return null;
}

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  const session = await requirePermission('combustible', 'create');
  if (!session) return forbiddenResponse('No tienes permiso');

  const ip = getClientIp(request);
  const { success } = rateLimit(`combustible-upload:${ip}`, { maxAttempts: 30, windowSeconds: 3600 });
  if (!success) return NextResponse.json({ error: 'Demasiadas subidas' }, { status: 429 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Maximo 10MB' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const fmt = detectFileFormat(buffer);
  if (!fmt) return NextResponse.json({ error: 'Solo PDF, JPG, PNG o WEBP reales' }, { status: 400 });

  const contentType = fmt === 'pdf' ? 'application/pdf' : fmt === 'webp' ? 'image/webp' : `image/${fmt === 'jpg' ? 'jpeg' : fmt}`;
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 10);
  const path = `${year}/${month}/factura-${now.getTime()}-${rand}.${fmt}`;

  const { data, error } = await supabaseAdmin.storage
    .from(COMBUSTIBLE_BUCKET)
    .upload(path, buffer, { contentType, upsert: false });

  if (error || !data) {
    console.error('Error uploading factura:', error);
    return NextResponse.json({ error: error?.message || 'Error al subir archivo' }, { status: 500 });
  }

  const signedUrl = await getSignedUrl(data.path);
  return NextResponse.json({
    path: data.path,
    url: signedUrl,
    nombre: file.name,
    tamano: file.size,
  });
}
