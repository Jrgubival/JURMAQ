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
  'fierro': ['fierro', 'fe', 'fe.', 'hierro'],
  'hierro': ['fierro', 'fe', 'fe.', 'hierro'],
  'fe': ['fierro', 'fe', 'fe.'],
  'tornillo': ['tornillo', 'torn', 'torn.'],
  'tubo': ['tubo', 'tuberia', 'cano'],
  'tuberia': ['tubo', 'tuberia', 'cano'],
  'cano': ['tubo', 'tuberia', 'cano'],
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
};

function expandWord(word: string): string[] {
  const lower = word.toLowerCase();
  const synonyms = SYNONYMS[lower];
  if (synonyms) return synonyms;
  const variants = [lower];
  if (lower.endsWith('.')) variants.push(lower.slice(0, -1));
  else variants.push(lower + '.');
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

  // Only stop at Strategy 1 if there are enough results (>= 5)
  // Otherwise continue to synonym expansion for better coverage
  if (exactResults && exactResults.length >= 5) {
    return applyDailyPromosToProducts(flattenProducts(exactResults));
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
      return applyDailyPromosToProducts(mergeResults(partialResults, data, limit));
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

  return applyDailyPromosToProducts(mergeResults(partialResults, data || [], limit));
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
