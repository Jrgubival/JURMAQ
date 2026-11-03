import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { forbiddenResponse, requirePermission } from '@jurmaq/shared/auth/guard';
import { logSafeError } from '@jurmaq/shared/logging';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { supabaseAdmin } from '@jurmaq/shared/supabase';

const BUCKET = 'rental-fotos';
const MAXIMO = 3 * 1024 * 1024;

function tipoReal(b: Uint8Array): { ext: string; mime: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: 'png', mime: 'image/png' };
  if (String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}

/** POST /api/admin/fotos — sube una foto ya achicada en el navegador. */
export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  if (!(await requirePermission('maquinarias', 'update'))) return forbiddenResponse();

  const form = await request.formData().catch(() => null);
  const archivo = form?.get('foto');
  if (!(archivo instanceof File) || archivo.size === 0 || archivo.size > MAXIMO) {
    return NextResponse.json({ error: 'La foto no se pudo leer o pesa mucho.' }, { status: 400 });
  }
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const tipo = tipoReal(bytes);
  if (!tipo) return NextResponse.json({ error: 'Usa una foto JPG, PNG o WebP.' }, { status: 400 });

  // El nombre lo pone el servidor, nunca el archivo subido.
  const ruta = `maquinas/${randomUUID()}.${tipo.ext}`;
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(ruta, bytes, {
    contentType: tipo.mime,
    cacheControl: '31536000',
  });
  if (error) {
    logSafeError('[panel] subir foto');
    return NextResponse.json({ error: 'No se pudo subir la foto.' }, { status: 500 });
  }
  return NextResponse.json({ url: supabaseAdmin.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl });
}
