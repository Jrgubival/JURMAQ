#!/usr/bin/env node
/**
 * Carga los precios de la tienda web desde PRECIOS_WEB_FINAL (hoja "Precios web").
 *
 * Columnas que usa: Código | Disponible en web | PRECIO WEB |
 * Precio normal (tachado) | % ahorro web | Stock. Las filas sin código
 * (títulos de grupo como "FIERRO · FIERROS CONSTRUCCION") se ignoran.
 *
 * Cómo queda cada producto en barraca_productos:
 *   · Disponible "Sí" con tachado (ahorro ≥ 5%):
 *       precio = PRECIO WEB, precio_original = Precio normal, en_oferta = true.
 *   · Disponible "Sí" sin tachado:
 *       precio = PRECIO WEB, precio_original = null, en_oferta = false.
 *   · Disponible "No": stock = 0 y sin oferta → la tienda lo muestra
 *       "No disponible", sin precio ni botón de compra. La ficha no se borra.
 *   · Activos de la web que la planilla no trae: también quedan "No
 *       disponible" (sus precios viejos no valen). --dejar-resto para no tocarlos.
 *
 * TRES MODOS (por defecto, simulación):
 *   (nada)                         Simulación: muestra los cambios y deja un CSV. No escribe.
 *   --local                        Escribe .precios-locales.json para verlos SOLO en
 *                                  `next dev` (con PRECIOS_LOCALES=.precios-locales.json
 *                                  en .env.local). No toca la base.
 *   --aplicar --confirmo <id>      Escribe en la base cuyo id de proyecto se confirma.
 *
 * La lectura de la base es siempre de solo lectura salvo con --aplicar.
 *
 * Uso (desde apps/barraca):
 *   node scripts/cargar-precios-web.mjs <PRECIOS_WEB_FINAL.xlsx> [--local] [--reporte x.csv]
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true });

// ---------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
function opcion(nombre, porDefecto = null) {
  const i = args.indexOf(nombre);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : porDefecto;
}
const archivo = args.find((a) => !a.startsWith('--') && /\.xlsx?$/i.test(a));
const hoja = opcion('--hoja', 'Precios web');
const rutaReporte = opcion('--reporte', './reporte-carga-precios.csv');
const rutaLocal = path.resolve(process.cwd(), '.precios-locales.json');
const local = args.includes('--local');
const aplicar = args.includes('--aplicar');
const confirmo = opcion('--confirmo');
const dejarResto = args.includes('--dejar-resto');
const AHORRO_MINIMO = 0.05; // el tachado solo se muestra con 5% o más

if (!archivo) {
  console.error('Falta la planilla. Uso: node scripts/cargar-precios-web.mjs <planilla.xlsx> [--local | --aplicar --confirmo <id>]');
  process.exit(1);
}
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

// ---------------------------------------------------------------------------
// Planilla
// ---------------------------------------------------------------------------
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const num = (v) => (v === '' || v == null ? null : Number(v));

function leerPlanilla() {
  const wb = XLSX.readFile(archivo);
  const ws = wb.Sheets[hoja];
  if (!ws) {
    console.error(`No existe la hoja "${hoja}". Hojas: ${wb.SheetNames.join(', ')}`);
    process.exit(1);
  }
  const filas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const iTitulos = filas.findIndex((f) => f.some((c) => norm(c) === 'codigo') && f.some((c) => norm(c) === 'precio web'));
  if (iTitulos < 0) {
    console.error('No encontré la fila de títulos con "Código" y "PRECIO WEB".');
    process.exit(1);
  }
  const t = filas[iTitulos].map(norm);
  const col = {
    codigo: t.indexOf('codigo'),
    descripcion: t.indexOf('descripcion'),
    disponible: t.indexOf('disponible en web'),
    precioWeb: t.indexOf('precio web'),
    precioNormal: t.indexOf('precio normal (tachado)'),
    ahorro: t.indexOf('% ahorro web'),
    stock: t.indexOf('stock'),
  };
  const faltan = Object.entries(col).filter(([, i]) => i < 0).map(([k]) => k);
  if (faltan.length) {
    console.error(`Faltan columnas: ${faltan.join(', ')}`);
    process.exit(1);
  }

  const items = [];
  const invalidas = [];
  for (const f of filas.slice(iTitulos + 1)) {
    const codigo = String(f[col.codigo] ?? '').trim();
    if (!codigo) continue; // título de grupo
    const descripcion = String(f[col.descripcion] ?? '').trim();
    const disponible = norm(f[col.disponible]) === 'si';
    const precioWeb = num(f[col.precioWeb]);
    const precioNormal = num(f[col.precioNormal]);
    const stockRaw = num(f[col.stock]);
    // La web vende unidades enteras: decimales hacia abajo, negativos a 0.
    const stock = Number.isFinite(stockRaw) ? Math.max(0, Math.floor(stockRaw)) : 0;

    if (!disponible) {
      items.push({ codigo, descripcion, disponible: false, precio: null, tachado: null, stock: 0 });
      continue;
    }
    if (!Number.isFinite(precioWeb) || precioWeb <= 0) {
      invalidas.push({ codigo, descripcion, motivo: `disponible sin PRECIO WEB (${f[col.precioWeb]})` });
      continue;
    }
    if (stock < 1) {
      invalidas.push({ codigo, descripcion, motivo: `disponible con stock ${f[col.stock]}` });
      continue;
    }
    const precio = Math.round(precioWeb);
    let tachado = Number.isFinite(precioNormal) && precioNormal > 0 ? Math.round(precioNormal) : null;
    if (tachado != null && (tachado <= precio || 1 - precio / tachado < AHORRO_MINIMO)) tachado = null;
    items.push({ codigo, descripcion, disponible: true, precio, tachado, stock });
  }
  return { items, invalidas };
}

// ---------------------------------------------------------------------------
// Base (solo lectura salvo --aplicar)
// ---------------------------------------------------------------------------
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function leerProductos() {
  const todos = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .from('barraca_productos')
      .select('id, codigo, slug, nombre, precio, stock, en_oferta, precio_original, oferta_fin, activo')
      .order('id')
      .range(desde, desde + 999);
    if (error) throw error;
    todos.push(...data);
    if (data.length < 1000) break;
  }
  return todos;
}

/** Campos finales de un producto según la fila de la planilla (o null = no disponible). */
function camposNuevos(p, it) {
  if (!it || !it.disponible) {
    // Sin stock y sin oferta. El precio se deja: con stock 0 la tienda no lo muestra.
    return { precio: p.precio, precio_original: null, en_oferta: false, oferta_fin: null, stock: 0 };
  }
  return {
    precio: it.precio,
    precio_original: it.tachado,
    en_oferta: it.tachado != null,
    oferta_fin: null,
    stock: it.stock,
  };
}

const igual = (a, b) => (a == null && b == null) || (a != null && b != null && Number(a) === Number(b));
const difiere = (p, c) =>
  !igual(p.precio, c.precio) || !igual(p.precio_original, c.precio_original) ||
  !!p.en_oferta !== c.en_oferta || p.oferta_fin != null || !igual(p.stock, c.stock);

const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

async function main() {
  const { items, invalidas } = leerPlanilla();
  const productos = await leerProductos();

  const porCodigo = new Map();
  for (const p of productos) {
    if (!p.codigo) continue;
    const k = String(p.codigo).trim().toUpperCase();
    if (!porCodigo.has(k)) porCodigo.set(k, []);
    porCodigo.get(k).push(p);
  }

  const filas = []; // { p, it, campos, origen }
  const sinCruce = [];
  const vistos = new Set();
  for (const it of items) {
    const lista = porCodigo.get(it.codigo.toUpperCase());
    if (!lista) {
      sinCruce.push(it);
      continue;
    }
    for (const p of lista) {
      vistos.add(p.id);
      filas.push({ p, it, campos: camposNuevos(p, it), origen: 'planilla' });
    }
  }
  const resto = productos.filter((p) => p.activo && !vistos.has(p.id));
  if (!dejarResto) {
    for (const p of resto) filas.push({ p, it: null, campos: camposNuevos(p, null), origen: 'fuera_de_planilla' });
  }
  const aEscribir = filas.filter((f) => difiere(f.p, f.campos));
  const disponibles = filas.filter((f) => f.campos.stock > 0);

  // Reporte CSV (sin costos: el repo es público, pero igual no los llevamos)
  const lineas = [
    ['tipo', 'codigo', 'id_web', 'nombre_web', 'descripcion_planilla', 'precio_actual', 'tachado_actual', 'stock_actual', 'precio_web', 'precio_normal', 'stock_nuevo', 'estado'].map(csv).join(','),
    ...filas.map(({ p, it, campos, origen }) =>
      [difiere(p, campos) ? 'cambia' : 'igual', p.codigo, p.id, p.nombre, it?.descripcion ?? '',
        p.precio, p.en_oferta ? p.precio_original : '', p.stock,
        campos.stock > 0 ? campos.precio : '', campos.precio_original ?? '', campos.stock,
        campos.stock > 0 ? 'disponible' : origen === 'planilla' ? 'no disponible (planilla)' : 'no disponible (no está en la planilla)',
      ].map(csv).join(','),
    ),
    ...sinCruce.map((it) => ['no_esta_en_web', it.codigo, '', '', it.descripcion, '', '', '', it.precio ?? '', it.tachado ?? '', it.stock, it.disponible ? 'disponible' : 'no disponible'].map(csv).join(',')),
    ...invalidas.map((x) => ['fila_invalida', x.codigo, '', '', x.descripcion, '', '', '', '', '', '', x.motivo].map(csv).join(',')),
  ];
  fs.writeFileSync(rutaReporte, lineas.join('\n'));

  const n = (fn) => filas.filter(fn).length;
  console.log(`\nProyecto Supabase: ${proyecto}`);
  console.log(`Planilla: ${path.basename(archivo)} · hoja "${hoja}"`);
  console.log(`  Productos en la planilla:              ${items.length} (${items.filter((i) => i.disponible).length} disponibles)`);
  console.log(`  Filas inválidas (se saltan):           ${invalidas.length}`);
  console.log(`  Códigos que no están en la web:        ${sinCruce.length}`);
  console.log(`Web: ${productos.length} productos (${productos.filter((p) => p.activo).length} activos)`);
  console.log(`  Cruzan con la planilla:                ${n((f) => f.origen === 'planilla')}`);
  console.log(`  Activos fuera de la planilla:          ${resto.length}${dejarResto ? ' (no se tocan)' : ' (quedan No disponible)'}`);
  console.log(`  Quedan disponibles:                    ${disponibles.length}`);
  console.log(`    con precio normal tachado:           ${n((f) => f.campos.stock > 0 && f.campos.en_oferta)}`);
  console.log(`    con un solo precio:                  ${n((f) => f.campos.stock > 0 && !f.campos.en_oferta)}`);
  console.log(`  Quedan No disponible:                  ${filas.length - disponibles.length}`);
  console.log(`  Productos que cambian:                 ${aEscribir.length}`);
  console.log(`Detalle: ${path.resolve(rutaReporte)}\n`);

  if (local) {
    const mapa = Object.fromEntries(
      filas.map(({ p, campos }) => [p.id, { codigo: p.codigo, slug: p.slug, ...campos }]),
    );
    fs.writeFileSync(rutaLocal, JSON.stringify({ generado: new Date().toISOString(), planilla: path.basename(archivo), productos: mapa }, null, 1));
    console.log(`Precios locales: ${rutaLocal}`);
    console.log('Solo los usa `next dev` con PRECIOS_LOCALES=.precios-locales.json en .env.local. La base no se tocó.\n');
    return;
  }
  if (!aplicar) {
    console.log(`Simulación: no se escribió nada. Para aplicar: --aplicar --confirmo ${proyecto}\n`);
    return;
  }

  let ok = 0;
  const fallas = [];
  for (let i = 0; i < aEscribir.length; i += 10) {
    await Promise.all(
      aEscribir.slice(i, i + 10).map(async ({ p, campos }) => {
        const { error } = await supabase.from('barraca_productos').update(campos).eq('id', p.id);
        if (error) fallas.push({ id: p.id, codigo: p.codigo, error: error.message });
        else ok++;
      }),
    );
  }
  console.log(`Escritos: ${ok} · con error: ${fallas.length}`);
  for (const f of fallas.slice(0, 20)) console.log(`  ${f.codigo} (id ${f.id}): ${f.error}`);
  console.log('Para verlo al instante, revalidar desde el admin (o /api/revalidar).');
}

main().catch((e) => {
  console.error('Error:', e.message || e);
  process.exit(1);
});
