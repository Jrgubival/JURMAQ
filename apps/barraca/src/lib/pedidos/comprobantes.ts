import 'server-only';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { env } from '@jurmaq/shared/env';
import { esProduccion, esServidorDesplegado, PATRON_NUMERO } from './index';

/**
 * Comprobantes de transferencia ("Ya transferí"). Son datos bancarios del
 * comprador: se guardan PRIVADOS y sólo los ve el panel.
 *
 *   - Producción / previews de Vercel: bucket privado `barraca-comprobantes`
 *     (migración 2026_10_31_barraca_transferencia_informada.sql), sólo con
 *     service_role. Nunca URL pública.
 *   - Local con PEDIDOS_STORE=archivo: carpeta apps/barraca/.comprobantes-dev/
 *     (gitignore). Fail-closed: en local sin el store de archivo NO se sube
 *     nada a Storage de producción; el aviso se rechaza.
 *
 * El nombre del archivo lo genera el servidor (hex al azar + extensión del
 * tipo detectado por magic bytes). El nombre que manda el cliente no se usa.
 */

export const MAX_COMPROBANTE = 5 * 1024 * 1024;
export const BUCKET_COMPROBANTES = 'barraca-comprobantes';
const CARPETA_DEV = path.join(process.cwd(), '.comprobantes-dev');

export type TipoComprobante = 'jpg' | 'png' | 'webp' | 'heic' | 'pdf';

export const MIME_COMPROBANTE: Record<TipoComprobante, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  pdf: 'application/pdf',
};

/** "<numero>/<hex32>.<ext>": lo único que se acepta como ruta guardada. */
const PATRON_RUTA = /^(BJ-\d{6}-[2-9A-HJKMNP-Z]{4})\/([a-f0-9]{32})\.(jpg|png|webp|heic|pdf)$/;

const MARCAS_HEIF = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'mif1', 'msf1']);

/** Tipo real del archivo por sus primeros bytes (magic bytes). null = no permitido. */
export function detectarTipo(b: Buffer): TipoComprobante | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'png';
  if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  if (b.toString('latin1', 0, 5) === '%PDF-') return 'pdf';
  // HEIC/HEIF (fotos de iPhone): caja "ftyp" en el byte 4 y una marca HEIF.
  if (b.toString('latin1', 4, 8) === 'ftyp' && MARCAS_HEIF.has(b.toString('latin1', 8, 12))) return 'heic';
  return null;
}

type Destino = 'local' | 'storage';

/** Dónde se guarda. Lanza (fail-closed) si no hay un destino seguro. */
function destino(): Destino {
  if (env.PEDIDOS_STORE === 'archivo') {
    if (esProduccion()) throw new Error('comprobantes locales no permitidos en producción');
    return 'local';
  }
  // Sólo un servidor desplegado en Vercel escribe en Storage. Un `next dev`
  // local apunta a la base de producción: ahí no se sube nada.
  if (!esServidorDesplegado()) throw new Error('comprobantes en Storage sólo desde el servidor desplegado');
  return 'storage';
}

export function rutaValida(ruta: string | null | undefined): ruta is string {
  return typeof ruta === 'string' && PATRON_RUTA.test(ruta);
}

export async function guardarComprobante(numero: string, contenido: Buffer, tipo: TipoComprobante): Promise<string> {
  if (!PATRON_NUMERO.test(numero)) throw new Error('numero invalido');
  const ruta = `${numero}/${crypto.randomBytes(16).toString('hex')}.${tipo}`;
  if (destino() === 'local') {
    const archivo = path.join(CARPETA_DEV, ruta);
    fs.mkdirSync(path.dirname(archivo), { recursive: true });
    fs.writeFileSync(archivo, contenido, { flag: 'wx' });
    return ruta;
  }
  const { error } = await supabaseAdmin.storage
    .from(BUCKET_COMPROBANTES)
    .upload(ruta, contenido, { contentType: MIME_COMPROBANTE[tipo], upsert: false });
  if (error) throw error;
  return ruta;
}

export async function leerComprobante(ruta: string): Promise<{ contenido: Buffer; tipo: TipoComprobante } | null> {
  const m = PATRON_RUTA.exec(ruta);
  if (!m) return null;
  const tipo = m[3] as TipoComprobante;
  if (destino() === 'local') {
    try {
      return { contenido: fs.readFileSync(path.join(CARPETA_DEV, ruta)), tipo };
    } catch {
      return null;
    }
  }
  const { data, error } = await supabaseAdmin.storage.from(BUCKET_COMPROBANTES).download(ruta);
  if (error || !data) return null;
  return { contenido: Buffer.from(await data.arrayBuffer()), tipo };
}

/** Limpieza si el aviso no se pudo guardar (por ejemplo, doble clic). Best effort. */
export async function borrarComprobante(ruta: string): Promise<void> {
  if (!rutaValida(ruta)) return;
  try {
    if (destino() === 'local') fs.rmSync(path.join(CARPETA_DEV, ruta), { force: true });
    else await supabaseAdmin.storage.from(BUCKET_COMPROBANTES).remove([ruta]);
  } catch {
    /* queda huérfano, sin enlace desde ningún pedido */
  }
}
