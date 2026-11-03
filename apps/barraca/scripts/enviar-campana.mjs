#!/usr/bin/env node
/**
 * Envía una campaña de correo de la barraca por tandas, con la clave de Resend
 * de la tienda (sin Broadcasts).
 *
 * Reglas:
 *   · Se envía de a uno, con pausa, y como máximo TOPE_DIARIO por día (hora de
 *     Chile) sumando todas las campañas, para no gastar la cuota diaria que
 *     usan los pedidos y los códigos del panel.
 *   · Antes de cada envío salta a quien esté de baja (barraca_correos_baja,
 *     fail-closed: si no se puede consultar, no se envía) y a quien ya tenga
 *     fila en barraca_campana_envios para esa campaña.
 *   · La fila se RESERVA antes de enviar (unique campaña + huella): dos
 *     corridas a la vez, o un reintento, nunca mandan dos veces lo mismo. Si el
 *     envío falla queda en 'error' y no se reintenta solo.
 *   · El enlace de baja va firmado (huella HMAC del correo con AUTH_SECRET,
 *     la misma de lib/baja-correos.ts) y además va en los encabezados
 *     List-Unsubscribe + List-Unsubscribe-Post (botón de Gmail, RFC 8058).
 *   · Sin copia oculta y sin el correo en claro en la base ni en la consola.
 *
 * Por defecto es SIMULACIÓN: muestra a quién le tocaría y no envía nada.
 *
 * Uso (desde apps/barraca, con .env.local de producción):
 *   node scripts/enviar-campana.mjs --campana catalogo-fierro-nov26 \
 *     --html "<CORREO_FINAL.html>" --lista "<IMPORTAR_RESEND.csv>" \
 *     --asunto "Publicidad: catálogo de fierro JURMAQ" [--aplicar]
 *   Prueba a una sola dirección (no toca la lista; campaña "<campana>-prueba"):
 *     ... --prueba jrgubival@gmail.com --aplicar
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true });

const TOPE_DIARIO = 50;
const PAUSA_MS = 1500;
const TIENDA = 'https://barraca.jurmaq.cl';
const REMITENTE = 'Jorge Ubilla · Barraca JURMAQ <novedades@jurmaq.cl>';
const RESPONDER_A = 'contacto@jurmaq.cl';
const MARCADOR_BAJA = '{{{RESEND_UNSUBSCRIBE_URL}}}';

// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const opcion = (n) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
};
const campanaBase = opcion('--campana');
const rutaHtml = opcion('--html');
const rutaLista = opcion('--lista');
const asunto = opcion('--asunto');
const prueba = opcion('--prueba');
const aplicar = args.includes('--aplicar');

function salir(msg) {
  console.error(msg);
  process.exit(1);
}
if (!campanaBase || !/^[a-z0-9_-]{3,50}$/.test(campanaBase)) salir('Falta --campana (minúsculas, números, - o _).');
if (!rutaHtml || !fs.existsSync(rutaHtml)) salir('Falta --html con el archivo del correo.');
if (!asunto || asunto.length > 150) salir('Falta --asunto (máx. 150 caracteres).');
if (!prueba && (!rutaLista || !fs.existsSync(rutaLista))) salir('Falta --lista con el CSV de destinatarios.');

const campana = prueba ? `${campanaBase}-prueba` : campanaBase;
const { AUTH_SECRET, RESEND_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!AUTH_SECRET || !RESEND_API_KEY || !NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  salir('Faltan variables en .env.local (AUTH_SECRET, RESEND_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).');
}

const html = fs.readFileSync(rutaHtml, 'utf8');
if (!html.includes(MARCADOR_BAJA)) salir(`El HTML no tiene el marcador de baja ${MARCADOR_BAJA}: sin enlace de baja no se envía.`);

// ---------------------------------------------------------------------------
const normalizar = (e) => String(e ?? '').trim().toLowerCase();
const correoValido = (e) => e.length <= 254 && /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e);
// Igual que huellaCorreo() de lib/baja-correos.ts.
const huellaCorreo = (e) => crypto.createHmac('sha256', AUTH_SECRET).update(`baja:${normalizar(e)}`).digest('hex');
const enmascarar = (e) => e.replace(/^(.{2}).*(@.*)$/, '$1***$2');
const escaparAtributo = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function leerLista(ruta) {
  const filas = fs.readFileSync(ruta, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const cab = filas.shift().split(',').map((c) => c.trim().toLowerCase());
  const iCorreo = cab.findIndex((c) => c === 'email' || c === 'correo');
  const iBaja = cab.indexOf('unsubscribed');
  if (iCorreo < 0) salir('La lista no tiene columna email ni correo.');
  const vistos = new Set();
  const out = [];
  for (const f of filas) {
    const c = f.split(',');
    const email = normalizar(c[iCorreo]);
    if (!correoValido(email) || vistos.has(email)) continue;
    vistos.add(email);
    out.push({ email, bajaEnLista: iBaja >= 0 && String(c[iBaja]).trim().toLowerCase() === 'true' });
  }
  return out;
}

function inicioDiaChile() {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
  // Medianoche de Chile en UTC (tolerancia de horario de verano: se calcula con el offset actual).
  const offset = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Santiago', timeZoneName: 'shortOffset' })
    .formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value.replace('GMT', '') || '-3';
  const h = Number(offset);
  return new Date(`${hoy}T00:00:00${h <= 0 ? '-' : '+'}${String(Math.abs(h)).padStart(2, '0')}:00`).toISOString();
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
const db = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const resend = new Resend(RESEND_API_KEY);

async function estaDeBaja(huella) {
  const { data, error } = await db.from('barraca_correos_baja').select('huella').eq('huella', huella).maybeSingle();
  if (error) return true; // fail-closed
  return !!data;
}

async function enviadosHoy() {
  const { count, error } = await db
    .from('barraca_campana_envios')
    .select('id', { count: 'exact', head: true })
    .gte('enviado_at', inicioDiaChile())
    .eq('estado', 'enviado');
  if (error) throw error;
  return count ?? 0;
}

async function main() {
  const destinatarios = prueba ? [{ email: normalizar(prueba), bajaEnLista: false }] : leerLista(rutaLista);
  if (prueba && !correoValido(destinatarios[0].email)) salir('Correo de prueba inválido.');

  const yaHoy = await enviadosHoy();
  let cupo = Math.max(0, TOPE_DIARIO - yaHoy);
  console.log(`Campaña "${campana}" · ${destinatarios.length} en la lista · enviados hoy (todas las campañas): ${yaHoy} · cupo: ${cupo}`);
  console.log(aplicar ? 'MODO ENVÍO' : 'SIMULACIÓN (no se envía nada; agrega --aplicar)');

  const r = { enviados: 0, deBaja: 0, yaEnviados: 0, errores: 0, sinCupo: 0 };
  for (const d of destinatarios) {
    const huella = huellaCorreo(d.email);
    if (d.bajaEnLista || (await estaDeBaja(huella))) { r.deBaja++; continue; }

    const { data: previo, error: ePrev } = await db
      .from('barraca_campana_envios').select('estado').eq('campana', campana).eq('huella', huella).maybeSingle();
    if (ePrev) { r.errores++; continue; }
    if (previo) { r.yaEnviados++; continue; }
    if (cupo <= 0) { r.sinCupo++; continue; }

    if (!aplicar) { console.log(`  enviaría a ${enmascarar(d.email)}`); cupo--; continue; }

    // Reserva ANTES de enviar: si otra corrida ya la tomó, el insert choca y no se envía.
    const { error: eRes } = await db.from('barraca_campana_envios').insert({ campana, huella, estado: 'reservado' });
    if (eRes) { r.yaEnviados++; continue; }

    const urlBaja = `${TIENDA}/baja/${huella}?o=${encodeURIComponent(`campana:${campanaBase}`.slice(0, 60))}`;
    const urlUnClic = `${TIENDA}/api/baja/${huella}?o=${encodeURIComponent('gmail-un-clic')}`;
    const cuerpo = html.split(MARCADOR_BAJA).join(escaparAtributo(urlBaja));
    try {
      const res = await resend.emails.send({
        from: REMITENTE,
        to: [d.email],
        replyTo: RESPONDER_A,
        subject: asunto,
        html: cuerpo,
        headers: {
          'List-Unsubscribe': `<${urlUnClic}>, <mailto:${RESPONDER_A}?subject=Baja%20de%20correos>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });
      if (res.error) throw new Error(res.error.message || 'Resend rechazó el envío');
      await db.from('barraca_campana_envios')
        .update({ estado: 'enviado', resend_id: res.data?.id ?? null, enviado_at: new Date().toISOString() })
        .eq('campana', campana).eq('huella', huella);
      r.enviados++;
      cupo--;
      console.log(`  enviado a ${enmascarar(d.email)}`);
    } catch (e) {
      await db.from('barraca_campana_envios')
        .update({ estado: 'error', error: String(e instanceof Error ? e.message : e).slice(0, 300) })
        .eq('campana', campana).eq('huella', huella);
      r.errores++;
      console.log(`  ERROR con ${enmascarar(d.email)}`);
    }
    await dormir(PAUSA_MS);
  }
  console.log(`Listo: ${JSON.stringify(r)}${r.sinCupo ? ' · los que quedaron sin cupo salen en la próxima tanda (otro día)' : ''}`);
}

main().catch((e) => {
  console.error('Falló la campaña:', e instanceof Error ? e.message : e);
  process.exit(1);
});
