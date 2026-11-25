import XLSX from 'xlsx';
import { readFile } from 'node:fs/promises';
import { supabaseAdmin } from "@jurmaq/shared/supabase";
import type { Database } from "@jurmaq/shared/db-types";

type BarracaProductoRow = Database['public']['Tables']['barraca_productos']['Row'];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedExcel {
  sheetNames: string[];
  headers: string[];
  rows: any[];
  totalRows: number;
  sampleRows: any[];
}

export type EstadoFila = 'update' | 'create' | 'skip' | 'notfound' | 'invalid';

export interface CambioCampo {
  field: string;
  oldValue: any;
  newValue: any;
}

/** Una ficha de la base afectada por una fila del archivo (un código puede tener varias fichas). */
export interface FichaObjetivo {
  id: number;
  codigo: string | null;
  nombre: string | null;
  changes: CambioCampo[];
}

export interface MatchResult {
  rowIndex: number;
  excelRow: any;
  /** Primera ficha encontrada (compatibilidad). Todas están en `matchedProducts`. */
  matchedProduct: BarracaProductoRow | null;
  matchedProducts: BarracaProductoRow[];
  /** update: hay cambios; skip: encontrada sin cambios; notfound: no existe en la base;
   *  invalid: la fila trae un dato no válido y NO se toca; create: producto nuevo (solo si createNew). */
  status: EstadoFila;
  /** Cómo se encontró. */
  via: 'id' | 'codigo' | 'nombre' | null;
  /** Cambios de la primera ficha con cambios (para mostrar). El detalle por ficha está en `targets`. */
  changes: CambioCampo[];
  targets: FichaObjetivo[];
  motivo?: string;
  alertas: string[];
  /** Datos de la ficha nueva (status create). */
  nuevo?: Record<string, any>;
  /** Para la vista previa: precio con que quedaría y costo con que se compara. */
  precioNuevo?: number | null;
  precioAntes?: number | null;
  costoRef?: number | null;
  bajoCosto?: boolean;
  margenBajo?: boolean;
}

export interface ImportConfig {
  createNew: boolean;
  createPromotionalPrices: boolean;
}

export interface ImportResult {
  updated: number;
  /** Fichas de la base tocadas (un cambio por código puede tocar varias). */
  fichasActualizadas: number;
  created: number;
  skipped: number;
  notFound: number;
  invalid: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Column synonym table
// ---------------------------------------------------------------------------

const COLUMN_SYNONYMS: Record<string, string[]> = {
  // id = clave PRIMARIA única. Match preferido (codigo tiene 628 duplicados).
  id: ['id', 'id producto', 'product id', 'product_id'],
  codigo: ['codigo', 'código', 'sku', 'code', 'cod', 'cod.'],
  nombre: ['nombre', 'descripcion', 'descripción', 'producto', 'detalle'],
  precio: [
    'precio',
    'precio vta',
    'precio vta.',
    'precio venta',
    'pvp',
    'precio unitario',
  ],
  costo: ['costo', 'costo bru', 'costo bru.', 'costo bruto', 'cost'],
  stock: ['stock', 'stock b1', 'cantidad', 'qty', 'inventario'],
  peso: ['peso', 'peso kg', 'peso (kg)', 'weight', 'kg'],
  unidad: ['unidad', 'und', 'unit', 'um', 'u.m.'],
  medida: ['medida', 'dimensiones', 'dimension', 'tamaño', 'tamano'],
  categoria: [
    'categoria',
    'categoría',
    'familia',
    'grupo',
    'linea',
    'línea',
  ],
  subcategoria: [
    'subcategoria',
    'subcategoría',
    'sub-familia',
    'subfamilia',
    'sub familia',
  ],
  precio_tachado: [
    'precio tachado',
    'precio original',
    'precio antes',
    'precio anterior',
    'precio de referencia',
    'precio normal',
  ],
  // Round-trip de imágenes (jun-2026): permite editar la URL de la foto en el
  // Excel exportado y re-importarla. La columna del export se llama "Imagen".
  imagen: ['imagen', 'image', 'img', 'foto', 'url imagen', 'imagen url', 'url de imagen'],
  // Estado activo/inactivo, para exportar e importar TODO el inventario.
  activo: ['activo', 'activa', 'active', 'habilitado', 'visible'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalize(str: string): string {
  return str.toLowerCase().trim();
}

function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/ñ/g, 'n')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const rand = Math.random().toString(36).substring(2, 5);
  return `${base}-${rand}`;
}

async function fetchAllProducts(): Promise<BarracaProductoRow[]> {
  const todos: BarracaProductoRow[] = [];
  let offset = 0;
  while (true) {
    // Orden por id (único): con `nombre` las páginas podían repetir o saltarse fichas.
    const { data, error } = await supabaseAdmin
      .from('barraca_productos')
      .select('*')
      .order('id')
      .range(offset, offset + 999);
    // Si la base falla NO seguimos: todo habría quedado como "no encontrado".
    if (error) throw new Error('No se pudo leer el catálogo. Intenta de nuevo.');
    if (!data || data.length === 0) break;
    todos.push(...(data as BarracaProductoRow[]));
    offset += 1000;
    if (data.length < 1000) break;
  }
  return todos;
}

function getValueFromRow(row: any, columnMapping: Record<string, string | null>, field: string): any {
  const excelColumn = columnMapping[field];
  if (!excelColumn) return undefined;
  return row[excelColumn];
}

export type NumeroLeido =
  | { ok: true; valor: number }
  | { ok: false; vacio: boolean; motivo: string };

/**
 * Lee un número de una celda de Excel. Acepta números, "$ 1.800", "1.800,50", "900", "1800 CLP".
 * En pesos chilenos el punto separa miles: "1.800" es 1800 (no 1,8).
 * Una celda vacía devuelve { ok:false, vacio:true } (no es un error: "no cambiar").
 */
export function leerNumero(val: unknown): NumeroLeido {
  if (val === null || val === undefined) return { ok: false, vacio: true, motivo: 'vacío' };
  if (typeof val === 'number') {
    return Number.isFinite(val) ? { ok: true, valor: val } : { ok: false, vacio: false, motivo: 'no es un número' };
  }
  let t = String(val).trim();
  if (t === '') return { ok: false, vacio: true, motivo: 'vacío' };
  t = t.replace(/clp|\$|\s|\u00a0/gi, '');
  if (t === '') return { ok: false, vacio: false, motivo: 'no es un número' };
  let neg = false;
  if (t.startsWith('-')) { neg = true; t = t.slice(1); }
  if (!/^[0-9.,]+$/.test(t)) return { ok: false, vacio: false, motivo: 'no es un número' };
  const tienePunto = t.includes('.');
  const tieneComa = t.includes(',');
  let limpio: string;
  if (tienePunto && tieneComa) {
    // el último separador es el decimal; el otro, de miles
    const decimal = t.lastIndexOf(',') > t.lastIndexOf('.') ? ',' : '.';
    const miles = decimal === ',' ? '.' : ',';
    limpio = t.split(miles).join('').replace(decimal, '.');
  } else if (tienePunto || tieneComa) {
    const sep = tienePunto ? '.' : ',';
    const partes = t.split(sep);
    const ultimo = partes[partes.length - 1];
    const esMiles = partes.length > 2 || (ultimo.length === 3 && partes[0].length >= 1 && partes[0].length <= 3);
    limpio = esMiles ? partes.join('') : partes.join('.');
  } else {
    limpio = t;
  }
  const n = Number(limpio);
  if (!Number.isFinite(n)) return { ok: false, vacio: false, motivo: 'no es un número' };
  return { ok: true, valor: neg ? -n : n };
}

function parseBoolFlexible(v: unknown): boolean | null {
  const sa = normalize(String(v ?? ''));
  if (['si', 'sí', 'true', '1', 'activo', 'x', 'verdadero'].includes(sa)) return true;
  if (['no', 'false', '0', 'inactivo'].includes(sa)) return false;
  return null;
}

// ---------------------------------------------------------------------------
// Function 1: parseExcelFile
// ---------------------------------------------------------------------------

export function parseExcelFile(buffer: Buffer): ParsedExcel {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetNames = workbook.SheetNames;

  // Prefer "Hoja2" if it exists, otherwise use the first sheet
  const targetSheet = sheetNames.includes('Hoja2') ? 'Hoja2' : sheetNames[0];
  const worksheet = workbook.Sheets[targetSheet];

  const rows: any[] = XLSX.utils.sheet_to_json(worksheet);
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const sampleRows = rows.slice(0, 10);

  return {
    sheetNames,
    headers,
    rows,
    totalRows: rows.length,
    sampleRows,
  };
}

// ---------------------------------------------------------------------------
// Function 2: detectColumnMapping
// ---------------------------------------------------------------------------

export function detectColumnMapping(headers: string[]): Record<string, string | null> {
  const mapping: Record<string, string | null> = {};

  for (const dbField of Object.keys(COLUMN_SYNONYMS)) {
    const synonyms = COLUMN_SYNONYMS[dbField];
    let matched: string | null = null;

    for (const header of headers) {
      const normalizedHeader = normalize(header);
      for (const synonym of synonyms) {
        if (normalizedHeader === normalize(synonym)) {
          matched = header;
          break;
        }
      }
      if (matched) break;
    }

    mapping[dbField] = matched;
  }

  return mapping;
}


// ---------------------------------------------------------------------------
// Precio y oferta (misma convención que pricing.ts)
// ---------------------------------------------------------------------------
//
// En la base: `precio` = lo que se cobra (precio web) y `precio_original` = el
// precio local tachado, con `en_oferta` = true. Del archivo: "Precio" va a
// `precio` y "Precio Tachado" a `precio_original`. pricing.ts resuelve por
// valor (se cobra el MENOR de los dos en una oferta), así que los datos viejos
// guardados al revés siguen cobrando bien; aquí se compara por lo que se cobra
// y no por columna, y solo se reescribe lo que de verdad cambia.

export interface EstadoPrecio {
  cobrado: number;
  tachado: number | null;
}

export function estadoPrecio(p: { precio?: unknown; precio_original?: unknown; en_oferta?: unknown }): EstadoPrecio {
  const precio = Number(p.precio) || 0;
  const orig = Number(p.precio_original) || 0;
  if (p.en_oferta && orig > 0) {
    const venta = Math.min(precio, orig);
    const antes = Math.max(precio, orig);
    return { cobrado: venta, tachado: antes > venta ? antes : null };
  }
  return { cobrado: precio, tachado: null };
}

type PlanPrecio =
  | { ok: true; changes: CambioCampo[]; alertas: string[]; cobradoFinal: number }
  | { ok: false; motivo: string };

function distinto(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined) return !(b === null || b === undefined);
  if (b === null || b === undefined) return true;
  const na = Number(a);
  const nb = Number(b);
  if (typeof a !== 'string' && typeof b !== 'string' && Number.isFinite(na) && Number.isFinite(nb)) return na !== nb;
  return String(a) !== String(b);
}

export function planificarPrecio(
  p: any,
  precioNuevo: number | null,
  tachadoNuevo: number | null,
  hoy: string,
): PlanPrecio {
  const act = estadoPrecio(p);
  const alertas: string[] = [];
  const cobrado = precioNuevo ?? act.cobrado;
  let tachado = tachadoNuevo;
  if (tachado !== null) {
    if (tachado === cobrado) tachado = null; // igual al precio: no es una oferta
    else if (tachado < cobrado) {
      return { ok: false, motivo: `El precio tachado (${tachado}) es menor que el precio (${cobrado}): se ignora la fila.` };
    }
  }

  const deseado: Record<string, unknown> = {};
  let sinCambioDeValor = false;
  if (tachado !== null) {
    // Oferta: precio = lo que se cobra, precio_original = tachado.
    sinCambioDeValor = cobrado === act.cobrado && tachado === act.tachado;
    deseado.precio = cobrado;
    deseado.precio_original = tachado;
    deseado.en_oferta = true;
    if (!sinCambioDeValor && p.oferta_fin && String(p.oferta_fin).slice(0, 10) < hoy) deseado.oferta_fin = null;
  } else if (precioNuevo !== null) {
    if (act.tachado !== null && precioNuevo < act.tachado) {
      // Sigue en oferta con el precio nuevo.
      sinCambioDeValor = precioNuevo === act.cobrado;
      deseado.precio = precioNuevo;
      deseado.precio_original = act.tachado;
      deseado.en_oferta = true;
    } else if (act.tachado !== null) {
      // El precio nuevo alcanza o pasa al tachado: la oferta ya no tiene sentido.
      alertas.push('El precio nuevo no es menor que el tachado anterior: se quita la oferta.');
      deseado.precio = precioNuevo;
      deseado.precio_original = null;
      deseado.en_oferta = false;
      deseado.oferta_fin = null;
    } else {
      deseado.precio = precioNuevo;
    }
  }

  const changes: CambioCampo[] = [];
  if (!sinCambioDeValor) {
    for (const [campo, valor] of Object.entries(deseado)) {
      const antes = p[campo];
      if (campo === 'oferta_fin' && (antes === null || antes === undefined)) continue;
      if (campo === 'precio_original' && valor === null && !antes) continue;
      if (distinto(antes, valor)) changes.push({ field: campo, oldValue: antes ?? null, newValue: valor });
    }
  }
  // Lo que se cobraría después de aplicar.
  const despues = estadoPrecio({
    precio: deseado.precio ?? p.precio,
    precio_original: 'precio_original' in deseado ? deseado.precio_original : p.precio_original,
    en_oferta: 'en_oferta' in deseado ? deseado.en_oferta : p.en_oferta,
  });
  return { ok: true, changes: sinCambioDeValor ? [] : changes, alertas, cobradoFinal: sinCambioDeValor ? act.cobrado : despues.cobrado };
}

// ---------------------------------------------------------------------------
// Function 3: matchProducts
// ---------------------------------------------------------------------------

export type MatchBy = 'auto' | 'codigo' | 'nombre' | 'id';

export interface MatchOpciones {
  /** Las filas que no existen en la base pasan a status 'create' (si traen precio válido). */
  createNew?: boolean;
  /** Catálogo ya leído (para pruebas); si falta se lee de la base. */
  productos?: BarracaProductoRow[];
  /** Fecha de hoy YYYY-MM-DD (para pruebas). */
  hoy?: string;
}

const NUMERICOS = ['costo', 'stock', 'peso'] as const;

function claveTexto(v: unknown): string {
  if (v === null || v === undefined) return '';
  return normalize(String(v));
}

export async function matchProducts(
  rows: any[],
  columnMapping: Record<string, string | null>,
  matchBy: MatchBy,
  fieldsToUpdate: string[],
  createPromotionalPrices: boolean,
  opciones: MatchOpciones = {},
): Promise<MatchResult[]> {
  void createPromotionalPrices; // la oferta se aplica cuando la fila trae "Precio Tachado" con valor
  const productos = opciones.productos ?? (await fetchAllProducts());
  const hoy = opciones.hoy ?? new Date().toISOString().slice(0, 10);

  const porId = new Map<string, BarracaProductoRow>();
  const porCodigo = new Map<string, BarracaProductoRow[]>();
  const porNombre = new Map<string, BarracaProductoRow[]>();
  for (const p of productos) {
    porId.set(String(p.id), p);
    const c = claveTexto(p.codigo);
    if (c) porCodigo.set(c, [...(porCodigo.get(c) ?? []), p]);
    const n = claveTexto(p.nombre);
    if (n) porNombre.set(n, [...(porNombre.get(n) ?? []), p]);
  }

  const reclamada = new Map<number, number>(); // id de ficha -> fila que la tocó primero
  const results: MatchResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const base: MatchResult = {
      rowIndex: i, excelRow: row, matchedProduct: null, matchedProducts: [], status: 'notfound',
      via: null, changes: [], targets: [], alertas: [],
    };
    const idKey = claveTexto(getValueFromRow(row, columnMapping, 'id'));
    const codKey = claveTexto(getValueFromRow(row, columnMapping, 'codigo'));
    const nomKey = claveTexto(getValueFromRow(row, columnMapping, 'nombre'));

    // 1) Encontrar las fichas
    let fichas: BarracaProductoRow[] = [];
    let via: MatchResult['via'] = null;
    let motivoNoEncontrada = '';

    if (matchBy === 'id' || matchBy === 'auto') {
      const porIdFicha = idKey ? porId.get(idKey) : undefined;
      if (matchBy === 'id') {
        if (!columnMapping.id) motivoNoEncontrada = 'El archivo no tiene columna Id.';
        else if (!porIdFicha) motivoNoEncontrada = `El Id ${idKey || '(vacío)'} no existe en la tienda.`;
        else { fichas = [porIdFicha]; via = 'id'; }
      } else {
        // Detección inteligente: el Id solo vale si el código del archivo coincide con el de la ficha.
        // Así un Id de otro sistema (Softmad) que casualmente existe no pisa un producto distinto.
        const idCuadra = porIdFicha && (!codKey || claveTexto(porIdFicha.codigo) === codKey);
        if (idCuadra) { fichas = [porIdFicha!]; via = 'id'; }
        else if (codKey && porCodigo.get(codKey)) {
          fichas = porCodigo.get(codKey)!; via = 'codigo';
          if (porIdFicha) base.alertas.push(`El Id ${idKey} apunta a otro producto; se cruzó por código.`);
        } else if (porIdFicha) {
          motivoNoEncontrada = `El Id ${idKey} existe pero con otro código; no se tocó.`;
        } else if (!idKey && !codKey) {
          motivoNoEncontrada = 'La fila no trae Id ni código.';
        } else {
          motivoNoEncontrada = codKey ? `Código ${getValueFromRow(row, columnMapping, 'codigo')} no existe en la tienda.` : `El Id ${idKey} no existe en la tienda.`;
        }
      }
    } else if (matchBy === 'codigo') {
      if (!columnMapping.codigo) motivoNoEncontrada = 'El archivo no tiene columna Código.';
      else if (!codKey) motivoNoEncontrada = 'La fila no trae código.';
      else if (!porCodigo.get(codKey)) motivoNoEncontrada = `Código ${getValueFromRow(row, columnMapping, 'codigo')} no existe en la tienda.`;
      else { fichas = porCodigo.get(codKey)!; via = 'codigo'; }
    } else {
      if (!columnMapping.nombre) motivoNoEncontrada = 'El archivo no tiene columna Nombre.';
      else if (!nomKey) motivoNoEncontrada = 'La fila no trae nombre.';
      else if (!porNombre.get(nomKey)) motivoNoEncontrada = 'El nombre no existe en la tienda.';
      else { fichas = porNombre.get(nomKey)!; via = 'nombre'; }
    }

    // 2) Leer y validar los valores del archivo
    const errores: string[] = [];
    const leer = (campo: string) => {
      const cruda = getValueFromRow(row, columnMapping, campo);
      return { cruda, num: leerNumero(cruda) };
    };
    const incluirPrecio = fieldsToUpdate.includes('precio');
    const rp = leer('precio');
    let precioNuevo: number | null = null;
    if (incluirPrecio && columnMapping.precio && !(!rp.num.ok && rp.num.vacio)) {
      if (!rp.num.ok) errores.push(`Precio no válido: "${String(rp.cruda)}".`);
      else if (rp.num.valor <= 0) errores.push(`Precio no válido (${rp.num.valor}): no puede ser 0 ni negativo.`);
      else precioNuevo = rp.num.valor;
    }
    const rt = leer('precio_tachado');
    let tachadoNuevo: number | null = null;
    if (columnMapping.precio_tachado && !(!rt.num.ok && rt.num.vacio)) {
      if (!rt.num.ok) errores.push(`Precio tachado no válido: "${String(rt.cruda)}".`);
      else if (rt.num.valor <= 0) errores.push(`Precio tachado no válido (${rt.num.valor}): no puede ser 0 ni negativo.`);
      else tachadoNuevo = rt.num.valor;
    }
    const numericos: Record<string, number> = {};
    for (const campo of NUMERICOS) {
      if (!fieldsToUpdate.includes(campo) || !columnMapping[campo]) continue;
      const r = leer(campo);
      if (!r.num.ok) {
        if (!r.num.vacio) errores.push(`${campo} no válido: "${String(r.cruda)}".`);
        continue;
      }
      if (r.num.valor < 0) { errores.push(`${campo} no puede ser negativo (${r.num.valor}).`); continue; }
      if (campo === 'costo' && r.num.valor === 0) continue; // 0 = "sin dato", no se escribe
      numericos[campo] = r.num.valor;
    }

    // 3) Fila sin ficha: no encontrada o crear
    if (fichas.length === 0) {
      if (errores.length > 0) {
        results.push({ ...base, status: 'invalid', motivo: errores.join(' ') });
        continue;
      }
      if (opciones.createNew && (idKey || codKey || nomKey)) {
        const nombre = String(getValueFromRow(row, columnMapping, 'nombre') ?? '').trim();
        if (!nombre) { results.push({ ...base, status: 'invalid', motivo: 'Producto nuevo sin nombre.' }); continue; }
        if (precioNuevo === null) { results.push({ ...base, status: 'invalid', motivo: 'Producto nuevo sin precio válido.' }); continue; }
        if (tachadoNuevo !== null && tachadoNuevo < precioNuevo) {
          results.push({ ...base, status: 'invalid', motivo: `El precio tachado (${tachadoNuevo}) es menor que el precio (${precioNuevo}).` });
          continue;
        }
        const nuevo: Record<string, any> = { nombre, slug: slugify(nombre), activo: true, precio: precioNuevo };
        const cod = getValueFromRow(row, columnMapping, 'codigo');
        if (cod !== undefined && cod !== null && String(cod).trim() !== '') nuevo.codigo = String(cod).trim();
        for (const [k, v] of Object.entries(numericos)) nuevo[k] = v;
        for (const campo of ['unidad', 'medida'] as const) {
          const v = getValueFromRow(row, columnMapping, campo);
          if (v !== undefined && v !== null && String(v).trim() !== '') nuevo[campo] = String(v).trim();
        }
        const img = getValueFromRow(row, columnMapping, 'imagen');
        if (img) nuevo.imagen = String(img).trim();
        const act = getValueFromRow(row, columnMapping, 'activo');
        if (act !== undefined && act !== null && act !== '') { const b = parseBoolFlexible(act); if (b !== null) nuevo.activo = b; }
        if (tachadoNuevo !== null && tachadoNuevo > precioNuevo) {
          nuevo.precio_original = tachadoNuevo;
          nuevo.en_oferta = true;
        }
        const costoRef = typeof nuevo.costo === 'number' ? nuevo.costo : null;
        results.push({
          ...base, status: 'create', nuevo, precioNuevo, precioAntes: null, costoRef,
          bajoCosto: costoRef ? precioNuevo < costoRef : false,
          margenBajo: costoRef ? precioNuevo >= costoRef && precioNuevo < costoRef * 1.15 : false,
          motivo: undefined,
        });
        continue;
      }
      results.push({ ...base, status: 'notfound', motivo: motivoNoEncontrada || 'No existe en la tienda.' });
      continue;
    }

    // 4) Fila con errores de datos: no se toca nada
    if (errores.length > 0) {
      results.push({ ...base, status: 'invalid', via, matchedProduct: fichas[0], matchedProducts: fichas, motivo: errores.join(' ') });
      continue;
    }

    // 5) Una ficha no puede ser modificada por dos filas del archivo
    const choque = fichas.find((f) => reclamada.has(f.id));
    if (choque) {
      results.push({
        ...base, status: 'invalid', via, matchedProduct: fichas[0], matchedProducts: fichas,
        motivo: `Repetida en el archivo: la ficha ${choque.id} ya viene en la fila ${reclamada.get(choque.id)! + 2}.`,
      });
      continue;
    }
    for (const f of fichas) reclamada.set(f.id, i);

    // 6) Cambios por ficha
    const targets: FichaObjetivo[] = [];
    const alertas = [...base.alertas];
    let invalido: string | null = null;
    let precioAntes: number | null = null;
    let precioNuevoFinal: number | null = null;
    let costoRef: number | null = null;
    let bajoCosto = false;
    let margenBajo = false;

    for (const ficha of fichas) {
      const p: any = ficha;
      const changes: CambioCampo[] = [];

      if (precioNuevo !== null || tachadoNuevo !== null) {
        const plan = planificarPrecio(p, precioNuevo, tachadoNuevo, hoy);
        if (!plan.ok) { invalido = plan.motivo; break; }
        changes.push(...plan.changes);
        for (const a of plan.alertas) if (!alertas.includes(a)) alertas.push(a);
        if (plan.changes.length > 0 && precioNuevoFinal === null) {
          precioNuevoFinal = plan.cobradoFinal;
          precioAntes = estadoPrecio(p).cobrado;
        }
      }
      for (const [campo, valor] of Object.entries(numericos)) {
        if (distinto(p[campo], valor)) changes.push({ field: campo, oldValue: p[campo] ?? null, newValue: valor });
      }
      // Textos y estado
      for (const field of fieldsToUpdate) {
        if (field === 'precio' || (NUMERICOS as readonly string[]).includes(field) || field === 'precio_tachado') continue;
        if (field === 'codigo' || field === 'categoria' || field === 'subcategoria' || field === 'id') continue;
        const v = getValueFromRow(row, columnMapping, field);
        if (v === undefined || v === null || v === '') continue;
        if (field === 'activo') {
          const b = parseBoolFlexible(v);
          if (b === null) continue; // valor no reconocido: no cambia el estado (evita apagar por typo)
          if (p.activo !== b) changes.push({ field: 'activo', oldValue: p.activo, newValue: b });
          continue;
        }
        const nuevoTexto = String(v).trim();
        if (nuevoTexto && String(p[field] ?? '') !== nuevoTexto) changes.push({ field, oldValue: p[field] ?? null, newValue: nuevoTexto });
      }

      // Control de margen con el precio y el costo que quedarían
      const cobradoFinal = estadoPrecio({
        precio: changes.find((c) => c.field === 'precio')?.newValue ?? p.precio,
        precio_original: changes.some((c) => c.field === 'precio_original') ? changes.find((c) => c.field === 'precio_original')!.newValue : p.precio_original,
        en_oferta: changes.some((c) => c.field === 'en_oferta') ? changes.find((c) => c.field === 'en_oferta')!.newValue : p.en_oferta,
      }).cobrado;
      const costo = Number(numericos.costo ?? p.costo) || 0;
      if (changes.some((c) => ['precio', 'precio_original', 'en_oferta', 'costo'].includes(c.field)) && costo > 0) {
        if (cobradoFinal < costo) { bajoCosto = true; costoRef = costo; }
        else if (cobradoFinal < costo * 1.15) { margenBajo = true; costoRef = costo; }
      }
      targets.push({ id: p.id, codigo: p.codigo ?? null, nombre: p.nombre ?? null, changes });
    }

    if (invalido) {
      for (const f of fichas) reclamada.delete(f.id);
      results.push({ ...base, status: 'invalid', via, matchedProduct: fichas[0], matchedProducts: fichas, motivo: invalido });
      continue;
    }
    const conCambios = targets.filter((t) => t.changes.length > 0);
    if (bajoCosto) alertas.push('Quedaría bajo el costo.');
    else if (margenBajo) alertas.push('Quedaría con menos de 15% sobre el costo.');
    results.push({
      ...base, via, matchedProduct: fichas[0], matchedProducts: fichas, targets,
      status: conCambios.length > 0 ? 'update' : 'skip',
      changes: conCambios[0]?.changes ?? [],
      alertas, precioAntes, precioNuevo: precioNuevoFinal, costoRef, bajoCosto, margenBajo,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Resumen para la vista previa
// ---------------------------------------------------------------------------

export interface MovimientoPrecio {
  codigo: string | null;
  nombre: string | null;
  antes: number;
  despues: number;
  porcentaje: number;
}

export interface ResumenImportacion {
  totalFilas: number;
  aActualizar: number;
  fichasAfectadas: number;
  noEncontradas: number;
  sinCambios: number;
  invalidas: number;
  aCrear: number;
  totalCambios: number;
  porId: number;
  porCodigo: number;
  porNombre: number;
  bajoCosto: Array<{ fila: number; codigo: string | null; nombre: string | null; precio: number | null; costo: number | null }>;
  margenBajo: Array<{ fila: number; codigo: string | null; nombre: string | null; precio: number | null; costo: number | null }>;
  mayoresSubidas: MovimientoPrecio[];
  mayoresBajadas: MovimientoPrecio[];
}

export function resumirImportacion(matches: MatchResult[]): ResumenImportacion {
  const r: ResumenImportacion = {
    totalFilas: matches.length, aActualizar: 0, fichasAfectadas: 0, noEncontradas: 0, sinCambios: 0, invalidas: 0, aCrear: 0,
    totalCambios: 0, porId: 0, porCodigo: 0, porNombre: 0, bajoCosto: [], margenBajo: [], mayoresSubidas: [], mayoresBajadas: [],
  };
  const mov: MovimientoPrecio[] = [];
  for (const m of matches) {
    if (m.status === 'update') {
      r.aActualizar++;
      r.fichasAfectadas += m.targets.filter((t) => t.changes.length > 0).length;
      r.totalCambios += m.targets.reduce((s, t) => s + t.changes.length, 0);
    } else if (m.status === 'notfound') r.noEncontradas++;
    else if (m.status === 'skip') r.sinCambios++;
    else if (m.status === 'invalid') r.invalidas++;
    else if (m.status === 'create') r.aCrear++;
    if (m.via === 'id') r.porId++;
    else if (m.via === 'codigo') r.porCodigo++;
    else if (m.via === 'nombre') r.porNombre++;
    const pieza = { fila: m.rowIndex + 2, codigo: m.matchedProduct?.codigo ?? (m.nuevo?.codigo as string | undefined) ?? null, nombre: m.matchedProduct?.nombre ?? (m.nuevo?.nombre as string | undefined) ?? null, precio: m.precioNuevo ?? null, costo: m.costoRef ?? null };
    if (m.bajoCosto) r.bajoCosto.push(pieza);
    else if (m.margenBajo) r.margenBajo.push(pieza);
    if (m.status === 'update' && m.precioNuevo != null && m.precioAntes != null && m.precioAntes > 0 && m.precioNuevo !== m.precioAntes) {
      mov.push({ codigo: pieza.codigo, nombre: pieza.nombre, antes: m.precioAntes, despues: m.precioNuevo, porcentaje: Math.round(((m.precioNuevo - m.precioAntes) / m.precioAntes) * 1000) / 10 });
    }
  }
  r.mayoresSubidas = mov.filter((x) => x.porcentaje > 0).sort((a, b) => b.porcentaje - a.porcentaje).slice(0, 10);
  r.mayoresBajadas = mov.filter((x) => x.porcentaje < 0).sort((a, b) => a.porcentaje - b.porcentaje).slice(0, 10);
  return r;
}

// ---------------------------------------------------------------------------
// Function 4: executeImport
// ---------------------------------------------------------------------------

export async function executeImport(matches: MatchResult[], config: ImportConfig): Promise<ImportResult> {
  const res: ImportResult = { updated: 0, fichasActualizadas: 0, created: 0, skipped: 0, notFound: 0, invalid: 0, errors: [] };

  for (const match of matches) {
    try {
      if (match.status === 'update') {
        let fallo = false;
        let toco = 0;
        for (const t of match.targets) {
          if (t.changes.length === 0) continue;
          const upd: Record<string, any> = {};
          for (const c of t.changes) upd[c.field] = c.newValue;
          const { error } = await supabaseAdmin.from('barraca_productos').update(upd).eq('id', t.id);
          if (error) { fallo = true; res.errors.push(`Fila ${match.rowIndex + 2}: no se pudo actualizar la ficha ${t.id}.`); }
          else toco++;
        }
        res.fichasActualizadas += toco;
        if (toco > 0 && !fallo) res.updated++;
      } else if (match.status === 'create') {
        if (!config.createNew || !match.nuevo) { res.skipped++; continue; }
        const { error } = await supabaseAdmin.from('barraca_productos').insert(match.nuevo);
        if (error) res.errors.push(`Fila ${match.rowIndex + 2}: no se pudo crear el producto.`);
        else res.created++;
      } else if (match.status === 'notfound') res.notFound++;
      else if (match.status === 'invalid') res.invalid++;
      else res.skipped++;
    } catch {
      res.errors.push(`Fila ${match.rowIndex + 2}: error inesperado.`);
    }
  }
  return res;
}

export async function importBarracaFromXLSX(filePath: string): Promise<{
  categories: number;
  products: number;
  updated: number;
  created: number;
  skipped: number;
  errors: string[];
}> {
  const buffer = await readFile(filePath);
  const parsed = parseExcelFile(buffer);
  const mapping = detectColumnMapping(parsed.headers);
  const fieldsToUpdate = Object.keys(mapping).filter(
    (field) => Boolean(mapping[field]) && field !== 'categoria' && field !== 'subcategoria' && field !== 'id',
  );
  const matches = await matchProducts(parsed.rows, mapping, 'auto', fieldsToUpdate, true, { createNew: true });
  const result = await executeImport(matches, { createNew: true, createPromotionalPrices: true });
  return { categories: 0, products: result.updated + result.created, updated: result.updated, created: result.created, skipped: result.skipped, errors: result.errors };
}
