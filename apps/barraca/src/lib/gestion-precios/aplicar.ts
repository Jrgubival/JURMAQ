/**
 * Escritura de precios en las fichas (siempre después de que las reglas y la
 * aprobación dijeron que sí). Cada ficha se escribe solo si su precio sigue
 * como se vio; si alguien la cambió en el intertanto, no se pisa.
 */
import type { CambioFicha } from "./plan.ts";
import type { FichaProducto } from "./modelo.ts";
import type { CamposFicha, RepoProductos } from "./repo.ts";

export interface FalloAplicar {
  id: number;
  codigo: string;
  motivo: "cambio_ajeno" | "error";
}

export interface ResultadoAplicar {
  aplicados: CambioFicha[];
  fallidos: FalloAplicar[];
  /** oferta_fin viejo que se limpió, por id (para la auditoría). */
  ofertaFinLimpiada: Map<number, string>;
}

/** Una oferta_fin ya vencida con la oferta encendida haría que el "expirar" manual antiguo la revierta mal: se limpia. */
export function ofertaFinVencida(f: Pick<FichaProducto, "oferta_fin">, ahora: number): boolean {
  if (!f.oferta_fin) return false;
  const t = Date.parse(f.oferta_fin);
  return Number.isFinite(t) && t < ahora;
}

async function enParalelo<T>(lista: T[], concurrencia: number, fn: (x: T) => Promise<void>): Promise<void> {
  let i = 0;
  const trabajadores = Array.from({ length: Math.min(concurrencia, lista.length) }, async () => {
    while (i < lista.length) {
      const actual = lista[i++];
      await fn(actual);
    }
  });
  await Promise.all(trabajadores);
}

export async function aplicarCambiosPrecio(
  repo: RepoProductos,
  cambios: CambioFicha[],
  fichasActuales: Map<number, FichaProducto>,
  o: { ahora: number; concurrencia?: number },
): Promise<ResultadoAplicar> {
  const res: ResultadoAplicar = { aplicados: [], fallidos: [], ofertaFinLimpiada: new Map() };
  await enParalelo(cambios, o.concurrencia ?? 8, async (c) => {
    const campos: CamposFicha = { precio: c.despues.precio, precio_original: c.despues.precio_original, en_oferta: c.despues.en_oferta };
    const actual = fichasActuales.get(c.id);
    let limpiada: string | null = null;
    if (c.despues.en_oferta && actual && ofertaFinVencida(actual, o.ahora)) {
      campos.oferta_fin = null;
      limpiada = actual.oferta_fin;
    }
    try {
      const ok = await repo.actualizar(c.id, campos, { precio: c.antes.precio, precio_original: c.antes.precio_original });
      if (ok) {
        res.aplicados.push(c);
        if (limpiada) res.ofertaFinLimpiada.set(c.id, limpiada);
      } else res.fallidos.push({ id: c.id, codigo: c.codigo, motivo: "cambio_ajeno" });
    } catch {
      res.fallidos.push({ id: c.id, codigo: c.codigo, motivo: "error" });
    }
  });
  res.aplicados.sort((a, b) => a.id - b.id);
  return res;
}

/** Entradas de auditoría de un cambio de precios aplicado (mínimo para revertir). */
export function auditoriaDePrecios(aplicados: CambioFicha[], limpiada: Map<number, string>) {
  return aplicados.map((c) => {
    const vieja = limpiada.get(c.id);
    return {
      entidad: "producto",
      entidadId: c.id,
      antes: { codigo: c.codigo, ...c.antes, ...(vieja ? { oferta_fin: vieja } : {}) },
      despues: { codigo: c.codigo, ...c.despues, ...(vieja ? { oferta_fin: null } : {}) },
    };
  });
}
