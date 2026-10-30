import 'server-only';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { env } from '@jurmaq/shared/env';
import { esProduccion } from '@/lib/pedidos';

/**
 * Baja de los correos automáticos (carrito abandonado, pedir opinión,
 * reposición): art. 28 B de la Ley 19.496 y Política de Privacidad 8.
 *
 * El enlace NO lleva el correo de la persona: lleva una huella HMAC del correo
 * (`/baja/<huella>`), así no queda un dato personal en la URL ni en los logs.
 * Se guarda la huella en `barraca_correos_baja` (scripts/migrate-correos-baja.sql)
 * y cada envío la consulta antes de mandar.
 *
 * En desarrollo con PEDIDOS_STORE=archivo se guarda en `.bajas-dev.json`, para
 * no escribir en la base de producción.
 */

const URL_TIENDA = env.NEXT_PUBLIC_BARRACA_URL || 'https://barraca.jurmaq.cl';
const ARCHIVO = path.join(process.cwd(), '.bajas-dev.json');

export function huellaCorreo(email: string): string {
  return crypto.createHmac('sha256', env.AUTH_SECRET).update(`baja:${email.trim().toLowerCase()}`).digest('hex');
}

export function urlBaja(email: string): string {
  return `${URL_TIENDA}/baja/${huellaCorreo(email)}`;
}

export function huellaValida(h: string): boolean {
  return /^[a-f0-9]{64}$/.test(h);
}

function usarArchivo(): boolean {
  if (env.PEDIDOS_STORE !== 'archivo') return false;
  if (esProduccion()) throw new Error('Bajas en archivo no permitidas en producción');
  return true;
}

function leerArchivo(): string[] {
  try {
    return JSON.parse(fs.readFileSync(ARCHIVO, 'utf8')) as string[];
  } catch {
    return [];
  }
}

export async function registrarBaja(huella: string): Promise<void> {
  if (!huellaValida(huella)) throw new Error('huella inválida');
  if (usarArchivo()) {
    const lista = new Set(leerArchivo());
    lista.add(huella);
    fs.writeFileSync(ARCHIVO, JSON.stringify([...lista]));
    return;
  }
  const { error } = await supabaseAdmin
    .from('barraca_correos_baja' as never)
    .upsert({ huella } as never, { onConflict: 'huella' });
  if (error) throw error;
}

/** ¿Pidió la baja? Fail-closed: si no se puede consultar, se trata como baja (no se envía). */
export async function estaDeBaja(email: string): Promise<boolean> {
  const huella = huellaCorreo(email);
  try {
    if (usarArchivo()) return leerArchivo().includes(huella);
    const { data, error } = await supabaseAdmin
      .from('barraca_correos_baja' as never)
      .select('huella')
      .eq('huella', huella)
      .maybeSingle();
    if (error) return true;
    return !!data;
  } catch {
    return true;
  }
}
