/**
 * Carritos abandonados, solo agregados: cantidad, montos y productos.
 * NUNCA lleva datos personales: quien lee la tabla debe pedir SOLO las columnas
 * `items`, `total` y `last_activity` (jamás correo, teléfono ni sesión), y aquí
 * ni siquiera existe dónde ponerlos.
 */
export interface CarritoAbandonadoFila {
  items: unknown;
  total: number | null;
  last_activity: string;
}

export interface ResumenCarritos {
  carritos: number;
  montoTotal: number;
  montoPromedio: number;
  productosMasDejados: Array<{ nombre: string; unidades: number; carritos: number }>;
}

export function resumenCarritos(filas: CarritoAbandonadoFila[], topProductos = 10): ResumenCarritos {
  let montoTotal = 0;
  const mapa = new Map<string, { nombre: string; unidades: number; carritos: number }>();
  for (const f of filas) {
    const t = Number(f.total);
    if (Number.isFinite(t) && t > 0) montoTotal += t;
    const items = Array.isArray(f.items) ? (f.items as Array<Record<string, unknown>>) : [];
    const vistos = new Set<string>();
    for (const i of items.slice(0, 50)) {
      const nombre = typeof i?.nombre === "string" ? i.nombre.trim().slice(0, 120) : "";
      if (!nombre) continue;
      const cant = Number(i.cantidad);
      const cur = mapa.get(nombre) ?? { nombre, unidades: 0, carritos: 0 };
      cur.unidades += Number.isFinite(cant) && cant > 0 ? cant : 1;
      if (!vistos.has(nombre)) { cur.carritos++; vistos.add(nombre); }
      mapa.set(nombre, cur);
    }
  }
  return {
    carritos: filas.length,
    montoTotal,
    montoPromedio: filas.length ? Math.round(montoTotal / filas.length) : 0,
    productosMasDejados: [...mapa.values()].sort((a, b) => b.carritos - a.carritos || b.unidades - a.unidades || a.nombre.localeCompare(b.nombre)).slice(0, Math.min(Math.max(1, topProductos), 30)),
  };
}
