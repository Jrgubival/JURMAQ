import 'server-only';
import { supabaseAdmin } from '@jurmaq/shared/supabase';

/** Storage bucket privado para documentación de personal/operarios. */
export const USERS_DOCS_BUCKET = 'users-documentos';

export const PREVIEW_TTL_SECONDS = 60;
export const DOWNLOAD_TTL_SECONDS = 5 * 60;

/** Tipos válidos (alineado con DB check constraint en users_documentos). */
export const ALLOWED_TIPOS = new Set([
  'licencia_municipal',
  'cedula',
  'contrato_laboral',
  'capacitacion',
  'examen_psicosensometrico',
  'foto',
  'otro',
] as const);

export type TipoDocumento =
  | 'licencia_municipal'
  | 'cedula'
  | 'contrato_laboral'
  | 'capacitacion'
  | 'examen_psicosensometrico'
  | 'foto'
  | 'otro';

export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Sniff del primer byte del buffer para verificar que el archivo SI es
 * PDF/JPG/PNG/WEBP. No se confía en `file.type` del cliente.
 */
export function detectFileFormat(buffer: Buffer): 'pdf' | 'jpg' | 'png' | 'webp' | null {
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

export function formatToContentType(fmt: 'pdf' | 'jpg' | 'png' | 'webp'): string {
  if (fmt === 'pdf') return 'application/pdf';
  if (fmt === 'jpg') return 'image/jpeg';
  if (fmt === 'png') return 'image/png';
  return 'image/webp';
}

/** Genera signed URL para descarga / preview. TTL en segundos. */
export async function getSignedUrl(
  path: string | null | undefined,
  ttlSeconds: number
): Promise<string | null> {
  if (!path || typeof path !== 'string') return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;

  try {
    const { data, error } = await supabaseAdmin.storage
      .from(USERS_DOCS_BUCKET)
      .createSignedUrl(path, ttlSeconds);
    if (error || !data?.signedUrl) {
      console.error('Error generando signed URL users-docs:', error);
      return null;
    }
    return data.signedUrl;
  } catch (err) {
    console.error('Excepción generando signed URL users-docs:', err);
    return null;
  }
}

/**
 * Path en Storage: `{userId}/{tipo}/{timestamp}-{rand}.{ext}`.
 * Particionado por userId facilita listar/borrar docs por usuario.
 */
export function buildStoragePath(
  userId: number,
  tipo: TipoDocumento,
  fmt: 'pdf' | 'jpg' | 'png' | 'webp'
): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 10);
  return `${userId}/${tipo}/${ts}-${rand}.${fmt}`;
}

export function parseNumericId(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function validateDate(d: string | null | undefined): string | null {
  if (!d || typeof d !== 'string') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const parsed = new Date(d);
  if (isNaN(parsed.getTime())) return null;
  return d;
}
