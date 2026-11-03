#!/usr/bin/env node
/**
 * Envía una campaña de correo de la barraca por tandas, con la clave de Resend
 * de la tienda (sin Broadcasts).
 *
 * Reglas:
 *   · Se envía de a uno, con pausa, y como máximo TOPE_DIARIO por día (hora de
 *     Chile) sumando todas las campañas, para no gastar la cuota diaria que
 *     usan los pedidos y los códigos del panel. El tope se vuelve a contar antes
 *     de cada envío (reservados + enviados), así que dos corridas a la vez
 *     tampoco lo pasan.
 *   · Antes de cada envío salta a quien esté de baja (barraca_correos_baja o la
 *     columna unsubscribed de la lista; fail-closed: si no se puede consultar,
 *     no se envía) y a quien ya tenga fila en barraca_campana_envios.
 *   · La fila se RESERVA antes de enviar (unique campaña + huella) y el envío
 *     lleva idempotencyKey: dos corridas, un reintento o un error a medio camino
 *     nunca mandan dos veces lo mismo. Lo que falla o queda a medias NO se
 *     reenvía solo: se avisa al inicio para revisarlo en Resend.
 *   · El enlace de baja va firmado (huella HMAC del correo con AUTH_SECRET, la
 *     misma de lib/baja-correos.ts). El encabezado List-Unsubscribe (botón de
 *     Gmail, RFC 8058) lleva además una firma propia del POST de un clic.
 *   · Sin copia oculta y sin el correo en claro en la base ni en la consola.
 *
 * Por defecto es SIMULACIÓN: muestra a quién le tocaría y no envía nada.
 *
 * Uso (desde apps/barraca, con .env.local de producción):
 *   node scripts/enviar-campana.mjs --campana catalogo-fierro-nov26 \
 *     --html "<CORREO_FINAL.html>" --lista "<lista.csv>" \
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
// Ley 19.496 art. 28 B: la comunicación promocional se identifica como tal.
if (!/publicidad/i.test(asunto)) salir('El asunto debe decir "Publicidad" (Ley 19.496, art. 28 B).');
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
// Igual que huellaCorreo() y firmaUnClic() de lib/baja-correos.ts.
const hmac = (texto) => crypto.createHmac('sha256', AUTH_SECRET).update(texto).digest('hex');
const huellaCorreo = (e) => hmac(`baja:${normalizar(e)}`);
const firmaUnClic = (huella) => hmac(`1clic:${huella}`);
const enmascarar = (e) => e.replace(/^(.{2}).*(@.*)$/, '$1***$2');
const sinCorreos = (t) => String(t).replace(/[^\s<>"']+@[^\s<>"']+/g, '***').slice(0, 300);
const escaparAtributo = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** CSV con comillas (RFC 4180): campos con comas, comillas dobles y saltos de línea. */
function parsearCsv(texto) {
  const filas = [];
  let fila = [];
  let campo = '';
  let comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (comillas) {
      if (ch === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (ch === '"') comillas = false;
      else campo += ch;
    } else if (ch === '"') comillas = true;
    else if (ch === ',') { fila.push(campo); campo = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo);
      campo = '';
      if (fila.some((c) => c.trim())) filas.push(fila);
      fila = [];
    } else campo += ch;
  }
  fila.push(campo);
  if (fila.some((c) => c.trim())) filas.push(fila);
  return filas;
}

function leerLista(ruta) {
  const filas = parsearCsv(fs.readFileSync(ruta, 'utf8').replace(/^﻿/, ''));
  const cab = (filas.shift() ?? []).map((c) => c.trim().toLowerCase());
  const iCorreo = cab.findIndex((c) => c === 'email' || c === 'correo');
  const iBaja = cab.indexOf('unsubscribed');
  if (iCorreo < 0) salir('La lista no tiene columna email ni correo.');
  // Sin la columna de bajas no se envía: podría escribirle a alguien que ya pidió la baja.
  if (iBaja < 0) salir('La lista no tiene la columna unsubscribed.');
  const vistos = new Set();
  const out = [];
  for (const c of filas) {
    if (c.length !== cab.length) salir(`Una fila de la lista tiene ${c.length} columnas y la cabecera ${cab.length}: revisa el CSV.`);
    const email = normalizar(c[iCorreo]);
    if (!correoValido(email) || vistos.has(email)) continue;
    vistos.add(email);
    out.push({ email, bajaEnLista: String(c[iBaja]).trim().toLowerCase() === 'true' });
  }
  return out;
}

/** Medianoche de hoy en Chile, en UTC. Prueba los offsets posibles y usa el que da 00:00 en Santiago (sirve en los cambios de hora). */
function inicioDiaChile() {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
  const hora = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  for (const off of ['-03:00', '-04:00', '-02:00', '-05:00']) {
    const d = new Date(`${hoy}T00:00:00${off}`);
    if (hora.format(d) === '00:00') return d.toISOString();
  }
  return new Date(`${hoy}T00:00:00-02:00`).toISOString(); // lo más estricto: cuenta desde más temprano
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

/** Envíos de hoy de todas las campañas, contando también los reservados (en curso o colgados). */
async function enviadosHoy() {
  const { count, error } = await db
    .from('barraca_campana_envios')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', inicioDiaChile())
    .in('estado', ['reservado', 'enviado']);
  if (error) throw error;
  return count ?? 0;
}

/** Filas que quedaron a medias en corridas anteriores: se revisan a mano en Resend, nunca se reenvían solas. */
async function avisarColgados() {
  const { data, error } = await db
    .from('barraca_campana_envios')
    .select('estado')
    .eq('campana', campana)
    .in('estado', ['reservado', 'error']);
  if (error) throw error;
  const n = (e) => (data ?? []).filter((x) => x.estado === e).length;
  if (n('reservado') || n('error')) {
    console.log(`AVISO: en "${campana}" hay ${n('reservado')} reservados sin confirmar y ${n('error')} con error de corridas anteriores. No se reenvían; revísalos en Resend.`);
  }
}

async function main() {
  const destinatarios = prueba ? [{ email: normalizar(prueba), bajaEnLista: false }] : leerLista(rutaLista);
  if (prueba && !correoValido(destinatarios[0].email)) salir('Correo de prueba inválido.');

  await avisarColgados();
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

    // Se vuelve a contar antes de cada envío: si corre otra tanda a la vez, el tope igual se respeta.
    if ((await enviadosHoy()) >= TOPE_DIARIO) { r.sinCupo++; cupo = 0; continue; }

    // Reserva ANTES de enviar: si otra corrida ya la tomó, el insert choca y no se envía.
    const { error: eRes } = await db.from('barraca_campana_envios').insert({ campana, huella, estado: 'reservado' });
    if (eRes) { r.yaEnviados++; continue; }

    const urlBaja = `${TIENDA}/baja/${huella}?o=${encodeURIComponent(`campana:${campanaBase}`.slice(0, 60))}`;
    const urlUnClic = `${TIENDA}/api/baja/${huella}?o=gmail-un-clic&s=${firmaUnClic(huella)}`;
    const cuerpo = html.split(MARCADOR_BAJA).join(escaparAtributo(urlBaja));
    try {
      const res = await resend.emails.send({
        from: REMITENTE,
        to: [d.email],
        replyTo: RESPONDER_A,
        subject: asunto,
        html: cuerpo,
        headers: {
          // Sólo https: un mailto dependería de que alguien lo procese a mano.
          'List-Unsubscribe': `<${urlUnClic}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }, { idempotencyKey: `${campana}/${huella}` });
      if (res.error) throw new Error(res.error.message || 'Resend rechazó el envío');
      const { error: eUpd } = await db.from('barraca_campana_envios')
        .update({ estado: 'enviado', resend_id: res.data?.id ?? null, enviado_at: new Date().toISOString() })
        .eq('campana', campana).eq('huella', huella);
      // Salió, pero no quedó marcado: se detiene para no descuadrar el tope ni el registro.
      if (eUpd) salir(`Se envió a ${enmascarar(d.email)} pero no se pudo marcar como enviado. Detenido: revisa la tabla antes de seguir.`);
      r.enviados++;
      cupo--;
      // El id de Resend no es secreto: sirve para buscar el envío en el panel de Resend.
      console.log(`  enviado a ${enmascarar(d.email)} · id Resend ${res.data?.id ?? '?'}`);
    } catch (e) {
      const { error: eErr } = await db.from('barraca_campana_envios')
        .update({ estado: 'error', error: sinCorreos(e instanceof Error ? e.message : e) })
        .eq('campana', campana).eq('huella', huella);
      r.errores++;
      console.log(`  ERROR con ${enmascarar(d.email)}${eErr ? ' (y no se pudo anotar el error)' : ''}`);
    }
    await dormir(PAUSA_MS);
  }
  console.log(`Listo: ${JSON.stringify(r)}${r.sinCupo ? ' · los que quedaron sin cupo salen en la próxima tanda (otro día)' : ''}`);
}

main().catch((e) => {
  console.error('Falló la campaña:', sinCorreos(e instanceof Error ? e.message : e));
  process.exit(1);
});
