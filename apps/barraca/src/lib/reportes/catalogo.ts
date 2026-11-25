/**
 * Reportes de catálogo de solo lectura. Puros: reciben las filas de
 * `barraca_productos` ya leídas (solo productos ACTIVOS) y agrupan por CÓDIGO
 * (hay 274 códigos con fichas duplicadas: un código es un producto).
 *
 * Criterios (los mismos del panel y de la tienda):
 * - sin foto: sin imagen, o con la imagen de relleno `/images/barraca/…`
 *   (igual que /admin/imagenes).
 * - sin stock: menos de 1 unidad disponible; stock vacío cuenta como sin stock
 *   (src/lib/stock.ts). Los «solo cotizar» no se venden en línea y no cuentan.
 * - bajo el costo: precio < costo. Margen menor a 15 %: precio < costo × 1,15
 *   (mismo umbral que exige aprobación de Jorge, mcp/aprobaciones.ts).
 *   Costo vacío o 0 = no se puede evaluar y no entra.
 */
import { unidadesDisponibles } from "../stock.ts";

export interface FilaProducto {
  id: number;
  codigo: string | null;
  nombre: string;
  precio: number | null;
  costo: number | null;
  stock: number | null;
  imagen: string | null;
  solo_cotizar?: boolean | null;
}

export const TIPOS_REPORTE_CATALOGO = ["sin_foto", "sin_stock", "bajo_costo", "margen_menor_15"] as const;
export type TipoReporteCatalogo = (typeof TIPOS_REPORTE_CATALOGO)[number];

export const MARGEN_MINIMO_REPORTE = 0.15;

export interface ItemCatalogo {
  codigo: string | null;
  nombre: string;
  fichas: number;
  precio: number | null;
  costo: number | null;
  /** Utilidad sobre el costo en %, o null si no hay costo. */
  margenPct: number | null;
  stock: number | null;
}

export function sinFoto(p: Pick<FilaProducto, "imagen">): boolean {
  return !p.imagen || p.imagen.trim() === "" || p.imagen.startsWith("/images/barraca/");
}

export function sinStock(p: Pick<FilaProducto, "stock" | "solo_cotizar">): boolean {
  return !p.solo_cotizar && unidadesDisponibles(p.stock) < 1;
}

const conCosto = (p: Pick<FilaProducto, "costo" | "precio">) =>
  p.costo != null && Number.isFinite(p.costo) && p.costo > 0 && p.precio != null && Number.isFinite(p.precio) && p.precio > 0;

export function bajoCosto(p: Pick<FilaProducto, "costo" | "precio">): boolean {
  return conCosto(p) && (p.precio as number) < (p.costo as number);
}

export function margenMenor15(p: Pick<FilaProducto, "costo" | "precio">): boolean {
  return conCosto(p) && (p.precio as number) < (p.costo as number) * (1 + MARGEN_MINIMO_REPORTE);
}

const FILTROS: Record<TipoReporteCatalogo, (p: FilaProducto) => boolean> = {
  sin_foto: sinFoto,
  sin_stock: sinStock,
  bajo_costo: bajoCosto,
  margen_menor_15: margenMenor15,
};

export interface ResultadoCatalogo {
  tipo: TipoReporteCatalogo;
  /** Productos (códigos) que cumplen, en total. */
  total: number;
  pagina: number;
  paginas: number;
  items: ItemCatalogo[];
}

export function reporteCatalogo(filas: FilaProducto[], tipo: TipoReporteCatalogo, pagina = 1, porPagina = 25): ResultadoCatalogo {
  const pp = Math.min(Math.max(1, Math.trunc(porPagina)), 50);
  const grupos = new Map<string, { filas: FilaProducto[] }>();
  for (const f of filas) {
    if (!FILTROS[tipo](f)) continue;
    const clave = f.codigo ? `c:${f.codigo}` : `id:${f.id}`;
    const g = grupos.get(clave) ?? { filas: [] };
    g.filas.push(f);
    grupos.set(clave, g);
  }
  const items: ItemCatalogo[] = [...grupos.values()].map(({ filas: fs }) => {
    const f = fs[0];
    const margen = conCosto(f) ? Math.round((((f.precio as number) - (f.costo as number)) / (f.costo as number)) * 1000) / 10 : null;
    return { codigo: f.codigo ?? null, nombre: String(f.nombre ?? "").slice(0, 120), fichas: fs.length, precio: f.precio, costo: f.costo, margenPct: margen, stock: f.stock };
  });
  // Lo más grave primero: peor margen; el resto, por nombre.
  items.sort((a, b) => (tipo === "bajo_costo" || tipo === "margen_menor_15" ? (a.margenPct ?? 0) - (b.margenPct ?? 0) : 0) || a.nombre.localeCompare(b.nombre));
  const total = items.length;
  const paginas = Math.max(1, Math.ceil(total / pp));
  const p = Math.min(Math.max(1, Math.trunc(pagina)), paginas);
  return { tipo, total, pagina: p, paginas, items: items.slice((p - 1) * pp, p * pp) };
}
