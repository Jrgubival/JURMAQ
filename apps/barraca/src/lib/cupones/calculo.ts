import type { ReglasCupon } from "./reglas.ts";

/**
 * Cálculo del descuento de un cupón. Función PURA: el servidor la llama con las
 * líneas ya revisadas desde la base (nunca con montos del navegador).
 *
 * Cómo interactúa con los precios (decisión documentada en docs/MCP-NOTAS.md):
 *  · El descuento se calcula sobre los productos de las líneas que SÍ califican
 *    (categorías y regla de acumulación), ya con combo aplicado: subtotal de la línea.
 *  · "No acumulable" deja fuera las líneas que ya tienen una rebaja propia:
 *    oferta real (precio web con precio normal tachado), promoción de categoría
 *    o combo aplicado. El resto de la compra sí recibe el cupón.
 *  · La compra mínima se compara con lo que califica, no con el carrito completo.
 *  · El 2% de transferencia NO es una oferta de producto: se mantiene y se calcula
 *    después, sobre los productos menos el cupón.
 */

export interface LineaCupon {
  productoId: number;
  categoriaId: number | null;
  /** Lo que se cobra por la línea (con combo aplicado). */
  subtotal: number;
  /** La línea ya tiene oferta real, promoción de categoría o combo. */
  conDescuento: boolean;
}

export interface CuponParaCalculo {
  tipo: "porcentaje" | "monto_fijo";
  valor: number;
  montoMinimoCompra: number;
}

export type MotivoExcluida = "categoria" | "con_descuento";

export type ResultadoCalculo =
  | {
      ok: true;
      descuento: number;
      /** Suma de las líneas que califican (base del descuento). */
      base: number;
      elegibles: number[];
      excluidas: Array<{ productoId: number; motivo: MotivoExcluida }>;
    }
  | { ok: false; codigo: "no_aplica" | "minimo" | "invalido"; error: string; minimo?: number };

/** Ids de la categoría y de todos sus ancestros (las subcategorías heredan la regla). */
export function ascendencia(categoriaId: number | null, padreDe: ReadonlyMap<number, number | null>): Set<number> {
  const s = new Set<number>();
  let actual: number | null = categoriaId;
  while (actual != null && !s.has(actual) && s.size < 20) {
    s.add(actual);
    actual = padreDe.get(actual) ?? null;
  }
  return s;
}

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;

export function calcularCupon(
  cupon: CuponParaCalculo,
  reglas: ReglasCupon,
  lineas: LineaCupon[],
  padreDe: ReadonlyMap<number, number | null> = new Map(),
): ResultadoCalculo {
  if (!Number.isFinite(cupon.valor) || cupon.valor <= 0 || (cupon.tipo === "porcentaje" && cupon.valor > 100)) {
    return { ok: false, codigo: "invalido", error: "Este cupón no está bien configurado." };
  }
  const elegibles: number[] = [];
  const excluidas: Array<{ productoId: number; motivo: MotivoExcluida }> = [];
  let base = 0;
  const lista = new Set(reglas.categoriasIds);

  for (const l of lineas) {
    if (!Number.isInteger(l.subtotal) || l.subtotal <= 0) continue;
    if (reglas.categoriasModo !== "todas") {
      const asc = ascendencia(l.categoriaId, padreDe);
      const enLista = [...asc].some((c) => lista.has(c));
      const califica = reglas.categoriasModo === "incluir" ? enLista : !enLista;
      if (!califica) {
        excluidas.push({ productoId: l.productoId, motivo: "categoria" });
        continue;
      }
    }
    if (reglas.noAcumulable && l.conDescuento) {
      excluidas.push({ productoId: l.productoId, motivo: "con_descuento" });
      continue;
    }
    elegibles.push(l.productoId);
    base += l.subtotal;
  }

  if (base <= 0) {
    const porOferta = excluidas.some((e) => e.motivo === "con_descuento");
    return {
      ok: false,
      codigo: "no_aplica",
      error: porOferta
        ? "Este cupón no se suma a productos en oferta. Ninguno de tu carrito califica."
        : "Este cupón no aplica a los productos de tu carrito.",
    };
  }
  if (base < cupon.montoMinimoCompra) {
    return {
      ok: false,
      codigo: "minimo",
      minimo: cupon.montoMinimoCompra,
      error: `Este cupón pide una compra mínima de ${pesos(cupon.montoMinimoCompra)} en productos que califiquen.`,
    };
  }
  const bruto = cupon.tipo === "porcentaje" ? Math.round((base * cupon.valor) / 100) : Math.round(cupon.valor);
  const descuento = Math.max(0, Math.min(bruto, base));
  if (descuento <= 0) return { ok: false, codigo: "no_aplica", error: "Este cupón no da descuento en tu carrito." };
  return { ok: true, descuento, base, elegibles, excluidas };
}
