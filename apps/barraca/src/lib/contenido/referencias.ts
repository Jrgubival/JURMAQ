/**
 * Validación de que los productos y categorías destacados de la portada
 * existan. Puro: el buscador se inyecta (referencias-supabase.ts es el real).
 */
import type { PortadaConfig } from "./tipos.ts";

export interface BuscadorReferencias {
  /** Devuelve cuáles de estos códigos existen y están activos. */
  codigosExistentes(codigos: string[]): Promise<Set<string>>;
  /** Devuelve cuáles de estos slugs existen y están activos. */
  slugsExistentes(slugs: string[]): Promise<Set<string>>;
}

export interface ResultadoReferencias {
  ok: boolean;
  productosFaltantes: string[];
  categoriasFaltantes: string[];
}

export async function verificarReferenciasPortada(p: PortadaConfig, buscador: BuscadorReferencias): Promise<ResultadoReferencias> {
  const [cods, slugs] = await Promise.all([
    p.productosDestacados.length ? buscador.codigosExistentes(p.productosDestacados) : Promise.resolve(new Set<string>()),
    p.categoriasDestacadas.length ? buscador.slugsExistentes(p.categoriasDestacadas) : Promise.resolve(new Set<string>()),
  ]);
  const productosFaltantes = p.productosDestacados.filter((c) => !cods.has(c));
  const categoriasFaltantes = p.categoriasDestacadas.filter((s) => !slugs.has(s));
  return { ok: productosFaltantes.length === 0 && categoriasFaltantes.length === 0, productosFaltantes, categoriasFaltantes };
}
