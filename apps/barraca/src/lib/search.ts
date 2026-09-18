import 'server-only';
import { supabasePublic } from "@jurmaq/shared/supabase";
import type { Database } from "@jurmaq/shared/db-types";
// SECURITY (audit jun-2026, L-OR): escapeOrFilter neutraliza `,()` además de
// `%_\` — los valores se splicean dentro de filtros PostgREST `.or(...)`, donde
// una coma o paréntesis del usuario inyectaría cláusulas extra.
import { escapeOrFilter } from "@jurmaq/shared/sanitize";
import { applyDailyPromosToProducts } from './promotions';

type BarracaProductoRow = Database['public']['Tables']['barraca_productos']['Row'];
type ProductoConCategoria = BarracaProductoRow & {
  barraca_categorias?: { nombre: string | null; slug: string | null } | null;
};
type ProductoAplanado = Omit<BarracaProductoRow, 'costo'> & {
  categoria_nombre: string | null;
  categoria_slug: string | null;
};

/**
 * Sinónimos y abreviaciones comunes en ferretería/construcción chilena.
 */
const SYNONYMS: Record<string, string[]> = {
  // --- Abreviaturas del catálogo -------------------------------------------
  // El maestro de productos viene abreviado desde el sistema de la barraca
  // ("Tub Rect Neg 40 x 20"), pero nadie busca así: se escribe "tubo
  // rectangular negro". Sin estos pares, 122 tubos, 50 rectangulares y 40
  // cuadrados son invisibles para quien los busca por su nombre completo.
  'tubo': ['tubo', 'tub', 'tuberia', 'cano'],
  'tuberia': ['tubo', 'tub', 'tuberia', 'cano'],
  'cano': ['tubo', 'tub', 'tuberia', 'cano'],
  'tornillo': ['tornillo', 'torn', 'torn.'],
  'negro': ['negro', 'neg', 'neg.'],
  'cuadrado': ['cuadrado', 'cuad', 'cuad.'],
  'rectangular': ['rectangular', 'rect', 'rect.'],
  'redondo': ['redondo', 'red', 'red.'],
  'unidad': ['unidad', 'und', 'un', 'und.'],
  'mecanico': ['mecanico', 'mec', 'mec.'],
  'tarugo': ['tarugo', 'tar', 'tar.'],
  'perfil': ['perfil', 'perf', 'perf.'],
  'autoperforante': ['autoperforante', 'aut.perfil', 'aut', 'autoperf'],
  'zincado': ['zincado', 'zinc', 'zn'],
  'eslabon': ['eslabon', 'eslb', 'eslb.'],
  'estructural': ['estructural', 'estr', 'estruct'],

  // --- Sinónimos del rubro --------------------------------------------------
  'fierro': ['fierro', 'fe', 'fe.', 'hierro'],
  'hierro': ['fierro', 'fe', 'fe.', 'hierro'],
  'fe': ['fierro', 'fe', 'fe.'],
  'pintura': ['pintura', 'esmalte', 'latex'],
  'llave': ['llave', 'grifo', 'griferia'],
  'ampolleta': ['ampolleta', 'led', 'foco'],
  'plancha': ['plancha', 'pl', 'pl.'],
  'angulo': ['angulo', 'ang', 'ang.'],
  'lamina': ['lamina', 'lam', 'lam.'],
  'laminado': ['laminado', 'lam', 'lam.'],
  'galvanizado': ['galvanizado', 'galv', 'galv.'],
  'inoxidable': ['inoxidable', 'inox', 'inox.'],
  'estriado': ['estriado', 'estr'],
  'trefilado': ['trefilado', 'tref'],
  'cemento': ['cemento', 'cem'],
  'soldadura': ['soldadura', 'sold'],
  'cerradura': ['cerradura', 'cerrad'],
  'sanitario': ['sanitario', 'sanit', 'sanitar'],
  'volcanita': ['volcanita', 'yeso carton', 'yeso-carton'],
  'terciado': ['terciado', 'contrachapado'],
  'teflon': ['teflon', 'cinta teflon'],
  'pulgada': ['pulgada', '"'],
  'pulgadas': ['pulgada', '"'],
};

function expandWord(word: string): string[] {
  const lower = word.toLowerCase();
  const synonyms = SYNONYMS[lower];
  if (synonyms) return synonyms;
  const variants = [lower];
  if (lower.endsWith('.')) variants.push(lower.slice(0, -1));
  else variants.push(lower + '.');

  // Medidas: el catálogo escribe "8 MM" y la gente teclea "8mm" (y viceversa).
  // Sin esta variante, buscar "fierro 8mm" no encuentra "Fierro Estriado A63
  // 8 MM x 6.0 M", porque el ilike `%8mm%` no cruza el espacio.
  const medida = lower.match(/^(\d+[.,]?\d*)\s*(mm|cm|mts?|kg|lts?|gr?)$/);
  if (medida) {
    variants.push(`${medida[1]} ${medida[2]}`);
    variants.push(`${medida[1]}${medida[2]}`);
  }
  return variants;
}

function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/s$/, '');
}

/**
 * Busca productos con sinónimos, expansión de palabras y matching parcial.
 * Usado tanto por la API /api/barraca/buscar como por la página de búsqueda.
 */
export async function searchProducts(q: string, limit: number = 48) {
  if (!q || q.trim().length < 2) return [];

  const words = q.trim().split(/\s+/).map(normalizeWord).filter(w => w.length >= 2);
  if (words.length === 0) return [];

  const fullPattern = `%${escapeOrFilter(q.trim())}%`;

  // Strategy 1: exact substring match
  const { data: exactResults } = await supabasePublic
    .from('barraca_productos')
    .select('*, barraca_categorias!left(nombre, slug)')
    .eq('activo', true)
    .gte('stock', 0)
    .or(`nombre.ilike.${fullPattern},codigo.ilike.${fullPattern}`)
    .order('destacado', { ascending: false })
    .order('nombre', { ascending: true })
    .limit(limit);

  // Cortar acá sólo si ninguna palabra tiene expansión pendiente.
  //
  // Antes bastaba con 5 coincidencias literales para devolver y salir, y eso
  // enterraba los productos que el catálogo abrevia: buscar "tubo" encontraba
  // 5 "Abrazadera de Fijacion Tubo" y retornaba, sin llegar nunca a expandir
  // tubo -> "tub" y por lo tanto sin mostrar ninguno de los 122 tubos.
  const tieneExpansion = words.some((w) => SYNONYMS[w] !== undefined);
  if (exactResults && exactResults.length >= 5 && !tieneExpansion) {
    return applyDailyPromosToProducts(rankResults(flattenProducts(exactResults), q, words));
  }
  const partialResults = exactResults || [];

  // Strategy 2: word-by-word with synonym expansion
  const wordFilters = words.map(word => {
    const variants = expandWord(word);
    return variants.map(v => `nombre.ilike.%${escapeOrFilter(v)}%`);
  });

  // Try AND logic (all words must match via any synonym)
  if (words.length > 1) {
    let query = supabasePublic
      .from('barraca_productos')
      .select('*, barraca_categorias!left(nombre, slug)')
      .eq('activo', true)
      .gte('stock', 0);

    for (const variants of wordFilters) {
      query = query.or(variants.join(','));
    }

    const { data } = await query
      .order('destacado', { ascending: false })
      .order('nombre', { ascending: true })
      .limit(limit);

    if (data && data.length > 0) {
      return applyDailyPromosToProducts(rankResults(mergeResults(partialResults, data, limit), q, words));
    }
  }

  // Strategy 3: OR logic (any word matches — broadest)
  const allConditions = wordFilters.flat().concat([`codigo.ilike.${fullPattern}`]);
  const { data } = await supabasePublic
    .from('barraca_productos')
    .select('*, barraca_categorias!left(nombre, slug)')
    .eq('activo', true)
    .gte('stock', 0)
    .or(allConditions.join(','))
    .order('destacado', { ascending: false })
    .order('nombre', { ascending: true })
    .limit(limit);

  return applyDailyPromosToProducts(rankResults(mergeResults(partialResults, data || [], limit), q, words));
}

/** Reordena por relevancia; empates conservan el orden que traía la consulta. */
function rankResults(items: ProductoAplanado[], rawQuery: string, words: string[]): ProductoAplanado[] {
  const variantes = words.map((w) => expandWord(w));
  return items
    .map((p, i) => ({ p, i, s: scoreProduct(p, rawQuery, words, variantes) }))
    .sort((a, b) => (b.s - a.s) || (a.i - b.i))
    .map((x) => x.p);
}


/**
 * Puntúa qué tan bien un producto responde a lo buscado.
 *
 * Antes los resultados salían ordenados por `destacado` y luego alfabéticamente,
 * así que buscar "cemento" devolvía primero "Broca Cemento 12 MM" y recién
 * después "Cemento Polpaico 25kg": la B va antes que la C. El orden alfabético
 * no es un orden de relevancia, es el azar del abecedario.
 */
function esc(t: string): string {
  return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** "8mm" y "8 MM" son la misma medida; el catálogo usa las dos formas. */
function patronMedida(m: string): string {
  return esc(m.trim()).replace(/\\ /g, '\\s*').replace(/\s+/g, '\\s*');
}

/**
 * Puntúa qué tan bien un producto responde a lo buscado.
 *
 * Dos cosas que el orden anterior no podía expresar:
 *  - Relevancia: ordenaba por `destacado` y luego alfabéticamente, así que
 *    "cemento" devolvía "Broca Cemento" antes que "Cemento Polpaico" — la B
 *    va antes que la C. El abecedario no es un criterio de relevancia.
 *  - Abreviaturas: el maestro dice "Tub Cuad Neg" y la gente escribe "tubo
 *    cuadrado". Sin puntuar las variantes expandidas, los 122 tubos quedaban
 *    siempre debajo de cualquier "Abrazadera de Fijacion Tubo" que sí trae la
 *    palabra completa.
 */
function scoreProduct(
  p: ProductoAplanado,
  rawQuery: string,
  words: string[],
  variantesPorPalabra: string[][],
): number {
  const nombre = p.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const q = rawQuery.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  let score = 0;

  if (nombre === q) score += 1000;
  if (nombre.startsWith(q)) score += 400;
  else if (nombre.includes(q)) score += 120;

  // Cada palabra buscada: vale por sí misma o por cualquiera de sus variantes
  // (sinónimo o abreviatura del catálogo). La palabra literal vale más que la
  // abreviatura, pero la abreviatura vale mucho más que nada.
  words.forEach((w, i) => {
    if (!w) return;
    const variantes = variantesPorPalabra[i] || [w];
    let mejor = 0;
    for (const v of variantes) {
      if (!v) continue;
      const literal = v === w;
      if (new RegExp(`^${esc(v)}`, 'i').test(nombre)) mejor = Math.max(mejor, literal ? 70 : 55);
      else if (new RegExp(`\\b${esc(v)}`, 'i').test(nombre)) mejor = Math.max(mejor, literal ? 40 : 32);
      else if (nombre.includes(v)) mejor = Math.max(mejor, 5);
    }
    score += mejor;
  });

  // Medidas: "8mm" debe premiar a "8 MM" y NO a "18mm".
  const medidas = q.match(/\d+[.,]?\d*\s*(mm|cm|mts?|kg|lts?|gr?|")/gi) || [];
  for (const m of medidas) {
    if (new RegExp(`(^|[^\\d.,])${patronMedida(m)}\\b`, 'i').test(nombre)) score += 200;
  }

  if (p.destacado) score += 25;
  if ((p.stock ?? 0) > 0) score += 40;
  if (p.en_oferta) score += 15;

  return score;
}

/** Merge results from multiple strategies, removing duplicates by ID */
function mergeResults(primary: ProductoConCategoria[], secondary: ProductoConCategoria[], limit: number): ProductoAplanado[] {
  const flat1 = flattenProducts(primary);
  const flat2 = flattenProducts(secondary);
  const seen = new Set(flat1.map((p) => p.id));
  const merged = [...flat1];
  for (const p of flat2) {
    if (!seen.has(p.id)) {
      merged.push(p);
      seen.add(p.id);
    }
    if (merged.length >= limit) break;
  }
  return merged;
}

function flattenProducts(rawProductos: ProductoConCategoria[]): ProductoAplanado[] {
  return rawProductos.map((p) => {
    const { barraca_categorias, costo, ...rest } = p;
    return {
      ...rest,
      categoria_nombre: barraca_categorias?.nombre || null,
      categoria_slug: barraca_categorias?.slug || null,
    };
  });
}
