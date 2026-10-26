#!/usr/bin/env node
/**
 * Carga precio web y stock desde la planilla Excel a barraca_productos.
 *
 * Lee una hoja con las columnas  Código | Descripción | Precio web | Stock
 * (también sirve la hoja "Fierro": "Precio web (costo +20%)" y "Stock B1")
 * (la fila de títulos puede estar más abajo; se busca sola) y cruza por
 * Código con `barraca_productos.codigo`.
 *
 * POR DEFECTO NO ESCRIBE NADA: muestra qué cambiaría y deja un CSV con el
 * detalle. Para escribir hay que pasar --aplicar y además --confirmo con el
 * id del proyecto de Supabase (el que aparece en el resumen), para que nunca
 * se aplique contra una base por accidente.
 *
 * Uso (desde apps/barraca):
 *   node scripts/cargar-precios-excel.mjs <planilla.xlsx> [opciones]
 *
 * Opciones:
 *   --hoja "<nombre>"     Hoja a leer (por defecto "Listado sin bodega 2").
 *   --reporte <ruta.csv>  Dónde dejar el detalle (por defecto ./reporte-carga-precios.csv).
 *   --quitar-ofertas      A los productos cargados les apaga la oferta (en_oferta=false),
 *                         para que nada se venda bajo el precio web.
 *   --aplicar --confirmo <id-proyecto>   Escribe en la base.
 *
 * Variables: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (lee .env.local).
 * Después de aplicar, las fichas se refrescan solas en 24 h; para verlo al
 * instante, revalidar desde el admin (o /api/revalidar).
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// ---------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
function opcion(nombre, porDefecto = null) {
  const i = args.indexOf(nombre);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : porDefecto;
}
const archivo = args.find((a) => !a.startsWith('--') && /\.xlsx?$/i.test(a));
const hoja = opcion('--hoja', 'Listado sin bodega 2');
const rutaReporte = opcion('--reporte', './reporte-carga-precios.csv');
const aplicar = args.includes('--aplicar');
const confirmo = opcion('--confirmo');
const quitarOfertas = args.includes('--quitar-ofertas');

if (!archivo) {
  console.error('Falta la planilla. Uso: node scripts/cargar-precios-excel.mjs <planilla.xlsx> [--hoja "..."] [--aplicar --confirmo <id>]');
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

function leerPlanilla() {
  const wb = XLSX.readFile(archivo);
  const ws = wb.Sheets[hoja];
  if (!ws) {
    console.error(`No existe la hoja "${hoja}". Hojas: ${wb.SheetNames.join(', ')}`);
    process.exit(1);
  }
  const filas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  // "Precio web" o "Precio web (costo +20%)"; "Stock" o "Stock B1".
  const esPrecio = (c) => norm(c).startsWith('precio web');
  const esStock = (c) => norm(c) === 'stock' || norm(c).startsWith('stock ');
  const iTitulos = filas.findIndex((f) => f.some((c) => norm(c) === 'codigo') && f.some(esPrecio));
  if (iTitulos < 0) {
    console.error('No encontré la fila de títulos con "Código" y "Precio web".');
    process.exit(1);
  }
  const t = filas[iTitulos].map(norm);
  const col = {
    codigo: t.indexOf('codigo'),
    descripcion: t.indexOf('descripcion'),
    precio: filas[iTitulos].findIndex(esPrecio),
    stock: filas[iTitulos].findIndex(esStock),
  };
  if (col.stock < 0) {
    console.error('Falta la columna "Stock".');
    process.exit(1);
  }

  const items = [];
  const invalidas = [];
  for (const f of filas.slice(iTitulos + 1)) {
    const codigo = String(f[col.codigo] ?? '').trim();
    if (!codigo) continue;
    const precio = Number(f[col.precio]);
    const stockRaw = Number(f[col.stock]);
    const descripcion = col.descripcion >= 0 ? String(f[col.descripcion] ?? '').trim() : '';
    if (!Number.isFinite(precio) || precio <= 0) {
      invalidas.push({ codigo, descripcion, motivo: `precio web inválido (${f[col.precio]})` });
      continue;
    }
    // La web vende unidades enteras: decimales hacia abajo, negativos a 0.
    const stock = Number.isFinite(stockRaw) ? Math.max(0, Math.floor(stockRaw)) : 0;
    items.push({ codigo, descripcion, precio: Math.round(precio), stock, stockRaw: f[col.stock] });
  }
  return { items, invalidas };
}

// ---------------------------------------------------------------------------
// Base
// ---------------------------------------------------------------------------
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function leerProductos() {
  const todos = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .from('barraca_productos')
      .select('id, codigo, nombre, precio, stock, en_oferta, precio_original, activo')
      .order('id')
      .range(desde, desde + 999);
    if (error) throw error;
    todos.push(...data);
    if (data.length < 1000) break;
  }
  return todos;
}

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

  const cambios = [];
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
      const cambiaPrecio = Math.round(Number(p.precio)) !== it.precio;
      const cambiaStock = Number(p.stock ?? -1) !== it.stock;
      const apagaOferta = quitarOfertas && !!p.en_oferta;
      cambios.push({ p, it, cambiaPrecio, cambiaStock, apagaOferta });
    }
  }
  const webSinPlanilla = productos.filter((p) => p.activo && !vistos.has(p.id));
  const aEscribir = cambios.filter((c) => c.cambiaPrecio || c.cambiaStock || c.apagaOferta);
  const enOferta = cambios.filter((c) => c.p.en_oferta).length;

  // Reporte CSV
  const lineas = [
    ['tipo', 'codigo', 'id_web', 'nombre_web', 'descripcion_planilla', 'precio_actual', 'precio_nuevo', 'stock_actual', 'stock_nuevo', 'en_oferta', 'nota'].map(csv).join(','),
    ...cambios.map(({ p, it, cambiaPrecio, cambiaStock }) =>
      [cambiaPrecio || cambiaStock ? 'cambia' : 'igual', it.codigo, p.id, p.nombre, it.descripcion, p.precio, it.precio, p.stock, it.stock, p.en_oferta ? 'si' : '', String(it.stockRaw) !== String(it.stock) ? `stock planilla ${it.stockRaw}` : ''].map(csv).join(','),
    ),
    ...sinCruce.map((it) => ['no_esta_en_web', it.codigo, '', '', it.descripcion, '', it.precio, '', it.stock, '', ''].map(csv).join(',')),
    ...invalidas.map((x) => ['fila_invalida', x.codigo, '', '', x.descripcion, '', '', '', '', '', x.motivo].map(csv).join(',')),
    ...webSinPlanilla.map((p) => ['web_sin_planilla', p.codigo, p.id, p.nombre, '', p.precio, '', p.stock, '', p.en_oferta ? 'si' : '', 'no se toca'].map(csv).join(',')),
  ];
  fs.writeFileSync(rutaReporte, lineas.join('\n'));

  console.log(`\nProyecto Supabase: ${proyecto}`);
  console.log(`Planilla: ${path.basename(archivo)} · hoja "${hoja}"`);
  console.log(`  Filas con precio válido:          ${items.length}`);
  console.log(`  Filas inválidas (se saltan):      ${invalidas.length}`);
  console.log(`  Códigos que no están en la web:   ${sinCruce.length}`);
  console.log(`Web: ${productos.length} productos`);
  console.log(`  Cruzan con la planilla:           ${cambios.length}`);
  console.log(`    cambia precio:                  ${cambios.filter((c) => c.cambiaPrecio).length}`);
  console.log(`    cambia stock:                   ${cambios.filter((c) => c.cambiaStock).length}`);
  console.log(`    quedan con stock 0:             ${cambios.filter((c) => c.it.stock === 0).length}`);
  console.log(`    en oferta hoy:                  ${enOferta}${quitarOfertas ? ' (se apagan)' : ' (usar --quitar-ofertas para apagarlas)'}`);
  console.log(`  Activos que la planilla no trae:  ${webSinPlanilla.length} (no se tocan)`);
  console.log(`Detalle: ${path.resolve(rutaReporte)}\n`);

  if (!aplicar) {
    console.log('Simulación: no se escribió nada. Para aplicar: --aplicar --confirmo ' + proyecto + '\n');
    return;
  }

  let ok = 0;
  const fallas = [];
  for (let i = 0; i < aEscribir.length; i += 10) {
    await Promise.all(
      aEscribir.slice(i, i + 10).map(async ({ p, it, apagaOferta }) => {
        const campos = { precio: it.precio, stock: it.stock };
        if (apagaOferta) Object.assign(campos, { en_oferta: false, precio_original: null, oferta_fin: null });
        const { error } = await supabase.from('barraca_productos').update(campos).eq('id', p.id);
        if (error) fallas.push({ id: p.id, codigo: it.codigo, error: error.message });
        else ok++;
      }),
    );
  }
  console.log(`Escritos: ${ok} · con error: ${fallas.length}`);
  for (const f of fallas.slice(0, 20)) console.log(`  ${f.codigo} (id ${f.id}): ${f.error}`);
}

main().catch((e) => {
  console.error('Error:', e.message || e);
  process.exit(1);
});
