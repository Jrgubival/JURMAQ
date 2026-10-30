/**
 * Textos de cobertura de despacho, sacados de la lista real del camión
 * (ZONAS_DESPACHO). Sirve para no prometer despacho a lugares que no están
 * en la lista (revisión legal, oct-2026): sin courier, sin el resto de la
 * región. Las landings SEO de ciudades fuera de la lista ofrecen retiro.
 */
import { ZONAS_DESPACHO } from "@/lib/despacho/zonas";

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const NOMBRES = new Set(ZONAS_DESPACHO.map((z) => normalizar(z.nombre)));

/** ¿El camión despacha a este lugar (por nombre)? */
export function despachaA(nombre: string): boolean {
  return NOMBRES.has(normalizar(nombre));
}

/** "Molina, Lontué, …, Pelarco y Talca". */
export const LUGARES_DESPACHO = (() => {
  const n = ZONAS_DESPACHO.map((z) => z.nombre);
  return n.length > 1 ? `${n.slice(0, -1).join(", ")} y ${n[n.length - 1]}` : n.join("");
})();

/** Frase corta para metadatos y textos. */
export const COBERTURA_CORTA =
  "Retiro en Molina y despacho en camión a Molina, Curicó, Talca y alrededores.";
