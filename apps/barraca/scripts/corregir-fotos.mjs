#!/usr/bin/env node
/**
 * Corrige las fotos de productos que no corresponden (scripts/fotos-correcciones.json).
 *
 * Cada entrada trae `antes` (la imagen que tenía la base al revisarla) e
 * `imagen` (la nueva; null deja la placa de medida). Sólo se cambia un
 * producto si su imagen actual sigue siendo `antes`: si alguien la cambió
 * entretanto, se salta y se avisa.
 *
 * TRES MODOS (por defecto, simulación):
 *   (nada)                      Simulación: muestra qué cambiaría. No escribe.
 *   --local                     Escribe .imagenes-locales.json para verlas SOLO en
 *                               `next dev` (con IMAGENES_LOCALES=.imagenes-locales.json
 *                               en .env.local). No toca la base.
 *   --aplicar --confirmo <id>   Escribe en la base cuyo id de proyecto se confirma.
 *                               Antes deja un respaldo con las imágenes actuales.
 *
 * Uso (desde apps/barraca):
 *   node scripts/corregir-fotos.mjs [--local | --aplicar --confirmo <id>]
 *   node scripts/corregir-fotos.mjs --revertir <respaldo.json> --aplicar --confirmo <id>
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true });

const args = process.argv.slice(2);
function opcion(nombre, porDefecto = null) {
  const i = args.indexOf(nombre);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : porDefecto;
}
const local = args.includes('--local');
const aplicar = args.includes('--aplicar');
const confirmo = opcion('--confirmo');
const revertir = opcion('--revertir');
const rutaCorrecciones = path.resolve(process.cwd(), opcion('--archivo', 'scripts/fotos-correcciones.json'));
const rutaLocal = path.resolve(process.cwd(), '.imagenes-locales.json');

if (local && aplicar) {
  console.error('--local y --aplicar son excluyentes.');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (en .env.local).');
  process.exit(1);
}
const proyecto = new URL(url).hostname.split('.')[0];
if (aplicar && confirmo !== proyecto) {
  console.error(`Para escribir hay que confirmar el proyecto: --aplicar --confirmo ${proyecto}`);
  process.exit(1);
}

// Un respaldo se aplica al revés: lo que hoy está (la corrección) vuelve a lo de antes.
const correcciones = (() => {
  if (!revertir) return JSON.parse(fs.readFileSync(rutaCorrecciones, 'utf8')).productos;
  const respaldo = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), revertir), 'utf8')).productos;
  return Object.fromEntries(
    Object.entries(respaldo).map(([id, r]) => [id, { ...r, antes: r.imagen_nueva, imagen: r.imagen_anterior }]),
  );
})();
const ids = Object.keys(correcciones).map(Number);
if (!ids.length || ids.some((id) => !Number.isInteger(id))) {
  console.error('El archivo de correcciones no trae ids válidos.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const { data: filas, error } = await supabase
  .from('barraca_productos')
  .select('id, nombre, imagen')
  .in('id', ids);
if (error) {
  console.error('No se pudo leer barraca_productos.');
  process.exit(1);
}
const actual = new Map(filas.map((f) => [f.id, f]));

const cambios = [];
const saltados = [];
for (const id of ids) {
  const c = correcciones[id];
  const f = actual.get(id);
  if (!f) saltados.push([id, c.nombre, 'no existe en la base']);
  else if (f.imagen === c.imagen) saltados.push([id, f.nombre, 'ya tiene la foto nueva']);
  else if (f.imagen !== c.antes) saltados.push([id, f.nombre, 'su foto cambió desde la revisión']);
  else cambios.push({ id, nombre: f.nombre, slug: c.slug, antes: f.imagen, imagen: c.imagen });
}

console.log(`\nProyecto: ${proyecto}`);
console.log(`Cambios: ${cambios.length} · Saltados: ${saltados.length}\n`);
for (const c of cambios) console.log(`  ${c.id}  ${c.nombre}\n        → ${c.imagen ?? '(sin foto: placa de medida)'}`);
for (const [id, nombre, motivo] of saltados) console.log(`  salta ${id}  ${nombre}: ${motivo}`);

if (local) {
  // Se incluyen también los que ya tienen la foto nueva, para que la vista local quede completa.
  const productos = Object.fromEntries(
    ids.filter((id) => actual.has(id)).map((id) => [id, { slug: correcciones[id].slug, imagen: correcciones[id].imagen }]),
  );
  fs.writeFileSync(rutaLocal, JSON.stringify({ generado: new Date().toISOString(), productos }, null, 2));
  console.log(`\nEscrito ${rutaLocal}`);
  console.log('Solo lo usa `next dev` con IMAGENES_LOCALES=.imagenes-locales.json en .env.local. La base no se tocó.\n');
  process.exit(0);
}

if (!aplicar) {
  console.log('\nSimulación: no se escribió nada. Para aplicar: --aplicar --confirmo ' + proyecto + '\n');
  process.exit(0);
}

if (!cambios.length) {
  console.log('\nNada que aplicar.\n');
  process.exit(0);
}

const marca = new Date().toISOString().replace(/[:.]/g, '-');
const rutaRespaldo = path.resolve(process.cwd(), `respaldo-fotos-${marca}.json`);
fs.writeFileSync(
  rutaRespaldo,
  JSON.stringify(
    {
      proyecto,
      productos: Object.fromEntries(
        cambios.map((c) => [c.id, { nombre: c.nombre, slug: c.slug, imagen_anterior: c.antes, imagen_nueva: c.imagen }]),
      ),
    },
    null,
    2,
  ),
);
console.log(`\nRespaldo: ${rutaRespaldo}`);

let malos = 0;
for (const c of cambios) {
  // El filtro por la imagen de antes evita pisar un cambio hecho entre la lectura y la escritura.
  let q = supabase.from('barraca_productos').update({ imagen: c.imagen }).eq('id', c.id);
  q = c.antes === null ? q.is('imagen', null) : q.eq('imagen', c.antes);
  const { data, error: e } = await q.select('id');
  if (e || !data?.length) {
    malos++;
    console.error(`  ✗ ${c.id} ${c.nombre}: no se actualizó`);
  }
}
console.log(`\nListo: ${cambios.length - malos} actualizados, ${malos} con problemas.\n`);
process.exit(malos ? 1 : 0);
