import 'server-only';
import { supabaseAdmin } from '@jurmaq/shared/supabase';

/** Storage bucket privado para documentación de maquinaria. */
export const MAQ_DOCS_BUCKET = 'maquinaria-documentos';

/** TTL del signed URL para preview en grid (corto: solo para mostrar inline). */
export const PREVIEW_TTL_SECONDS = 60;

/** TTL del signed URL para download explícito (más largo para que el browser tenga tiempo). */
export const DOWNLOAD_TTL_SECONDS = 5 * 60;

/** Tipos válidos para documentos de maquinaria (alineado con DB check constraint). */
export const ALLOWED_TIPOS = new Set([
  'rt',
  'permiso_circulacion',
  'soap',
  'seguro_rc',
  'ficha_tecnica',
  'manual_operacion',
  'mantencion',
  'capacitacion_operador',
  'foto',
] as const);

export type TipoDocumento =
  | 'rt'
  | 'permiso_circulacion'
  | 'soap'
  | 'seguro_rc'
  | 'ficha_tecnica'
  | 'manual_operacion'
  | 'mantencion'
  | 'capacitacion_operador'
  | 'foto';

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (alineado con bucket file_size_limit)

/**
 * Sniff del primer byte del buffer para verificar que el archivo SI es PDF/JPG/PNG/WEBP.
 * Mucho más confiable que confiar en `file.type` (que el cliente puede mentir).
 */
export function detectFileFormat(buffer: Buffer): 'pdf' | 'jpg' | 'png' | 'webp' | null {
  if (buffer.length < 12) return null;
  // %PDF
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return 'pdf';
  // JPEG (FF D8 FF)
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  // PNG (89 50 4E 47 0D 0A 1A 0A)
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) return 'png';
  // WEBP (RIFF....WEBP)
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) return 'webp';
  return null;
}

/** Map de formato detectado a Content-Type real para guardar en Storage. */
export function formatToContentType(fmt: 'pdf' | 'jpg' | 'png' | 'webp'): string {
  if (fmt === 'pdf') return 'application/pdf';
  if (fmt === 'jpg') return 'image/jpeg';
  if (fmt === 'png') return 'image/png';
  return 'image/webp';
}

/**
 * Genera signed URL para un archivo del bucket. TTL configurable según uso
 * (preview corto = PREVIEW_TTL_SECONDS, download = DOWNLOAD_TTL_SECONDS).
 * Retorna null si falla.
 */
export async function getSignedUrl(path: string | null | undefined, ttlSeconds: number): Promise<string | null> {
  if (!path || typeof path !== 'string') return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;

  try {
    const { data, error } = await supabaseAdmin.storage
      .from(MAQ_DOCS_BUCKET)
      .createSignedUrl(path, ttlSeconds);
    if (error || !data?.signedUrl) {
      console.error('Error generando signed URL maq-docs:', error);
      return null;
    }
    return data.signedUrl;
  } catch (err) {
    console.error('Excepción generando signed URL maq-docs:', err);
    return null;
  }
}

/**
 * Construye el path donde se guarda el archivo en Storage.
 * Formato: `{maquinariaId}/{tipo}/{timestamp}-{rand}.{ext}`
 *
 * - Particionado por maquinariaId facilita borrar todos los docs si se elimina
 *   la máquina (Storage no tiene FK, pero al menos el path es discoverable).
 * - Particionado por tipo permite listar "todos los RT" en futuro.
 * - Timestamp + random previene colisiones cuando se sube el mismo nombre 2 veces.
 */
export function buildStoragePath(maquinariaId: number, tipo: TipoDocumento, fmt: 'pdf' | 'jpg' | 'png' | 'webp'): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 10);
  return `${maquinariaId}/${tipo}/${ts}-${rand}.${fmt}`;
}

/** Parsea :id param a integer positivo o null. */
export function parseNumericId(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Valida y normaliza una fecha ISO (YYYY-MM-DD). Retorna null si inválida. */
export function validateDate(d: string | null | undefined): string | null {
  if (!d || typeof d !== 'string') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const parsed = new Date(d);
  if (isNaN(parsed.getTime())) return null;
  return d;
}
