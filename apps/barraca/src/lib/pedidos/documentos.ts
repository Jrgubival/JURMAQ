import 'server-only';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { env } from '@jurmaq/shared/env';
import { esProduccion, PATRON_NUMERO } from './index';

/**
 * Boletas y facturas (PDF) que la barraca sube desde el panel para mandarlas
 * al cliente. Tienen datos tributarios del comprador: se guardan PRIVADAS y
 * sólo las ve el panel.
 *
 *   - Producción / previews de Vercel: bucket privado `barraca-documentos`
 *     (migración 2026_11_01_barraca_ventas.sql), sólo con service_role.
 *     Nunca URL pública.
 *   - Local con PEDIDOS_STORE=archivo: carpeta apps/barraca/.documentos-dev/
 *     (gitignore). Fail-closed: un `next dev` sin el store de archivo apunta a
 *     producción, y ahí NO se sube nada.
 *
 * Nombre del archivo: lo genera el servidor (hex al azar). El del cliente no se usa.
 */

export const MAX_DOCUMENTO = 5 * 1024 * 1024;
export const BUCKET_DOCUMENTOS = 'barraca-documentos';
const CARPETA_DEV = path.join(process.cwd(), '.documentos-dev');

/** "<numero>/<hex32>.pdf": lo único que se acepta como ruta guardada. */
const PATRON_RUTA = /^(BJ-\d{6}-[2-9A-HJKMNP-Z]{4})\/([a-f0-9]{32})\.pdf$/;

/** ¿Es un PDF de verdad? (magic bytes "%PDF-"; el MIME que manda el navegador no vale). */
export function esPdf(b: Buffer): boolean {
  return b.length >= 8 && b.toString('latin1', 0, 5) === '%PDF-';
}

type Destino = 'local' | 'storage';

function destino(): Destino {
  if (env.PEDIDOS_STORE === 'archivo') {
    if (esProduccion()) throw new Error('documentos locales no permitidos en producción');
    return 'local';
  }
  if (!process.env.VERCEL) throw new Error('documentos en Storage sólo desde Vercel');
  return 'storage';
}

export function rutaDocumentoValida(ruta: string | null | undefined, numero: string): ruta is string {
  return typeof ruta === 'string' && PATRON_RUTA.test(ruta) && ruta.startsWith(`${numero}/`);
}

export async function guardarDocumento(numero: string, contenido: Buffer): Promise<string> {
  if (!PATRON_NUMERO.test(numero)) throw new Error('numero invalido');
  if (!esPdf(contenido) || contenido.length > MAX_DOCUMENTO) throw new Error('archivo invalido');
  const ruta = `${numero}/${crypto.randomBytes(16).toString('hex')}.pdf`;
  if (destino() === 'local') {
    const archivo = path.join(CARPETA_DEV, ruta);
    fs.mkdirSync(path.dirname(archivo), { recursive: true });
    fs.writeFileSync(archivo, contenido, { flag: 'wx' });
    return ruta;
  }
  const { error } = await supabaseAdmin.storage
    .from(BUCKET_DOCUMENTOS)
    .upload(ruta, contenido, { contentType: 'application/pdf', upsert: false });
  if (error) throw error;
  return ruta;
}

export async function leerDocumento(ruta: string): Promise<Buffer | null> {
  if (!PATRON_RUTA.test(ruta)) return null;
  if (destino() === 'local') {
    try {
      return fs.readFileSync(path.join(CARPETA_DEV, ruta));
    } catch {
      return null;
    }
  }
  const { data, error } = await supabaseAdmin.storage.from(BUCKET_DOCUMENTOS).download(ruta);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

/** Borra el PDF anterior al reemplazarlo, o el nuevo si no se pudo guardar en el pedido. Best effort. */
export async function borrarDocumento(ruta: string | null | undefined): Promise<void> {
  if (typeof ruta !== 'string' || !PATRON_RUTA.test(ruta)) return;
  try {
    if (destino() === 'local') fs.rmSync(path.join(CARPETA_DEV, ruta), { force: true });
    else await supabaseAdmin.storage.from(BUCKET_DOCUMENTOS).remove([ruta]);
  } catch {
    /* queda huérfano, sin enlace desde ningún pedido */
  }
}
