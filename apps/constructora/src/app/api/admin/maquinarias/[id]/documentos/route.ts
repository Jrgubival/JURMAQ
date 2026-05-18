/**
 * GET    /api/admin/maquinarias/[id]/documentos
 *   Lista todos los documentos de una máquina con signed URLs para preview
 *   (TTL corto). El frontend usa estos URLs para mostrar inline; para
 *   descarga explícita pega a /api/admin/maquinarias/[id]/documentos/[docId]/download.
 *
 * POST   /api/admin/maquinarias/[id]/documentos
 *   Sube un documento. Multipart form con: file (required), tipo (required,
 *   uno de los 9 allowed), nombre (required), descripcion (opt),
 *   fecha_emision (opt YYYY-MM-DD), fecha_vencimiento (opt YYYY-MM-DD).
 *
 *   Valida:
 *   - MIME via magic bytes (no `file.type` que el cliente puede mentir).
 *   - size ≤ 10MB (alineado con bucket file_size_limit).
 *   - tipo ∈ ALLOWED_TIPOS.
 *   - fecha_vencimiento >= fecha_emision (si ambas presentes).
 *
 *   Sube a `storage.from('maquinaria-documentos')` con path particionado por
 *   maquinariaId + tipo, e inserta row en `maquinaria_documentos`.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin, sanitizeString } from '@jurmaq/shared/sanitize';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
import {
  MAQ_DOCS_BUCKET,
  ALLOWED_TIPOS,
  MAX_FILE_SIZE,
  PREVIEW_TTL_SECONDS,
  detectFileFormat,
  formatToContentType,
  buildStoragePath,
  getSignedUrl,
  parseNumericId,
  validateDate,
  type TipoDocumento,
} from './_helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePermission('maquinarias', 'read');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { id } = await params;
    const maquinariaId = parseNumericId(id);
    if (!maquinariaId) {
      return NextResponse.json({ error: 'ID de maquinaria invalido' }, { status: 400 });
    }

    const ip = getClientIp(request);
    const { success } = rateLimit(`maq-docs-list:${ip}`, { maxAttempts: 30, windowSeconds: 60 });
    if (!success) return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });

    const { data: docs, error } = await supabaseAdmin
      .from('maquinaria_documentos')
      .select('id, maquinaria_id, tipo, nombre, descripcion, archivo_path, archivo_mime, archivo_size_bytes, fecha_emision, fecha_vencimiento, created_by, created_at, updated_at')
      .eq('maquinaria_id', maquinariaId)
      .order('tipo', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      // Si la migración no se aplicó aún, la tabla no existe — devolver 503 con mensaje claro.
      if (error.code === 'PGRST205' || /maquinaria_documentos/.test(error.message || '')) {
        return NextResponse.json(
          {
            error: 'Falta migracion. Ejecuta apps/constructora/scripts/migrate-maquinaria-documentos.sql en Supabase Dashboard.',
            documentos: [],
          },
          { status: 503 }
        );
      }
      throw error;
    }

    // Adjuntar signed URL preview (TTL 60s) a cada doc.
    const docsConUrl = await Promise.all(
      (docs || []).map(async (d) => ({
        ...d,
        preview_url: await getSignedUrl(d.archivo_path, PREVIEW_TTL_SECONDS),
      }))
    );

    return NextResponse.json({ documentos: docsConUrl });
  } catch (error) {
    console.error('Error listando documentos de maquinaria:', error);
    return NextResponse.json({ error: 'Error al listar documentos' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isValidOrigin(request)) {
      return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
    }

    const session = await requirePermission('maquinarias', 'update');
    if (!session) return forbiddenResponse('No tienes permiso');

    const { id } = await params;
    const maquinariaId = parseNumericId(id);
    if (!maquinariaId) {
      return NextResponse.json({ error: 'ID de maquinaria invalido' }, { status: 400 });
    }

    const ip = getClientIp(request);
    const { success } = rateLimit(`maq-docs-upload:${ip}`, { maxAttempts: 20, windowSeconds: 60 });
    if (!success) return NextResponse.json({ error: 'Demasiadas subidas. Espera un minuto.' }, { status: 429 });

    // Verificar que la máquina existe (FK constraint también atrapa esto, pero
    // queremos 404 explícito antes de gastar el upload).
    const { data: maquinaria } = await supabaseAdmin
      .from('maquinarias')
      .select('id')
      .eq('id', maquinariaId)
      .maybeSingle();
    if (!maquinaria) {
      return NextResponse.json({ error: 'Maquinaria no encontrada' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Archivo excede 10MB' }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: 'Archivo vacío' }, { status: 400 });
    }

    const tipo = sanitizeString(formData.get('tipo') as string | null) as TipoDocumento | null;
    if (!tipo || !ALLOWED_TIPOS.has(tipo)) {
      return NextResponse.json(
        { error: `Tipo invalido. Permitidos: ${Array.from(ALLOWED_TIPOS).join(', ')}` },
        { status: 400 }
      );
    }

    const nombre = sanitizeString(formData.get('nombre') as string | null);
    if (!nombre || nombre.length < 1 || nombre.length > 200) {
      return NextResponse.json({ error: 'Nombre requerido (1-200 caracteres)' }, { status: 400 });
    }

    const descripcion = sanitizeString(formData.get('descripcion') as string | null);
    const fechaEmision = validateDate(formData.get('fecha_emision') as string | null);
    const fechaVencimiento = validateDate(formData.get('fecha_vencimiento') as string | null);

    if (fechaEmision && fechaVencimiento && fechaVencimiento < fechaEmision) {
      return NextResponse.json({ error: 'Vencimiento no puede ser anterior a emisión' }, { status: 400 });
    }

    // Magic-bytes check — NO confiar en file.type del cliente.
    const buffer = Buffer.from(await file.arrayBuffer());
    const fmt = detectFileFormat(buffer);
    if (!fmt) {
      return NextResponse.json(
        { error: 'Formato no soportado. Solo PDF, JPG, PNG o WEBP reales.' },
        { status: 400 }
      );
    }

    const path = buildStoragePath(maquinariaId, tipo, fmt);
    const contentType = formatToContentType(fmt);

    const { data: uploaded, error: uploadError } = await supabaseAdmin.storage
      .from(MAQ_DOCS_BUCKET)
      .upload(path, buffer, { contentType, upsert: false });

    if (uploadError || !uploaded) {
      console.error('Error subiendo doc maquinaria a Storage:', uploadError);
      return NextResponse.json(
        { error: uploadError?.message || 'Error subiendo archivo' },
        { status: 500 }
      );
    }

    const session_user_id = (session.user as { id?: string | number })?.id;
    const createdBy = typeof session_user_id === 'string' ? parseInt(session_user_id, 10) : (session_user_id ?? null);

    const { data: row, error: insertError } = await supabaseAdmin
      .from('maquinaria_documentos')
      .insert({
        maquinaria_id: maquinariaId,
        tipo,
        nombre,
        descripcion: descripcion || null,
        archivo_path: uploaded.path,
        archivo_mime: contentType,
        archivo_size_bytes: file.size,
        fecha_emision: fechaEmision,
        fecha_vencimiento: fechaVencimiento,
        created_by: Number.isFinite(createdBy) ? createdBy : null,
      })
      .select()
      .single();

    if (insertError) {
      // Si el insert falla, intentamos borrar el archivo huérfano para no
      // dejar storage inflado por errores.
      await supabaseAdmin.storage.from(MAQ_DOCS_BUCKET).remove([uploaded.path]).catch(() => null);
      // Caso especial: tabla no existe
      if (insertError.code === 'PGRST205' || /maquinaria_documentos/.test(insertError.message || '')) {
        return NextResponse.json(
          { error: 'Falta migracion. Ejecuta apps/constructora/scripts/migrate-maquinaria-documentos.sql en Supabase Dashboard.' },
          { status: 503 }
        );
      }
      console.error('Error insertando row maq-doc:', insertError);
      return NextResponse.json(
        { error: insertError.message || 'Error registrando documento' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      documento: {
        ...row,
        preview_url: await getSignedUrl(row.archivo_path, PREVIEW_TTL_SECONDS),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error subiendo documento de maquinaria:', error);
    return NextResponse.json({ error: 'Error al subir documento' }, { status: 500 });
  }
}
