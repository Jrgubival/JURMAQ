/**
 * Planes de cambio de precios (puros): dado el estado actual de las fichas y lo
 * pedido, calculan qué quedaría escrito en cada ficha, sin tocar nada.
 *
 * Tres formas de pedir un cambio masivo:
 *   · lista      : por código (o id) con precio local y/o precio web exactos.
 *   · descuento  : precio web = precio local menos X % (precio normal = local).
 *   · reajuste   : subir o bajar X % tanto el local como el web.
 * En los tres casos un cambio por código llega a TODAS las fichas de ese código.
 */
import {
  type EstadoPrecio, type FichaProducto, agruparPorCodigo, clasificarMargen, construirEstado, esPesosValido, estadoDe, mismoEstado,
  normalizarCodigo, porcentajeABp, precioBajoLocal, precioLocalDe, precioWebDe, reajustarPrecio, tachadoSeMuestra, variacionFirmadaPct,
} from "./modelo.ts";
import { huellaDeDatos } from "../gestion/util.ts";

export interface ItemLista {
  codigo?: string;
  id?: number;
  precio_local?: number;
  precio_web?: number;
}

export interface CambioFicha {
  id: number;
  codigo: string;
  nombre: string;
  antes: EstadoPrecio;
  despues: EstadoPrecio;
  costo: number | null;
}

export type MetodoPlan = "lista" | "descuento_web" | "reajuste";

export interface PlanPrecios {
  metodo: MetodoPlan;
  /** Fórmula en palabras, para mostrarla en la vista previa. */
  formula: string;
  /** Solo las fichas que cambian. */
  cambios: CambioFicha[];
  /** Fichas revisadas que quedarían igual. */
  sinCambio: number;
  noEncontrados: string[];
  invalidos: Array<{ referencia: string; motivo: string }>;
  fichasRevisadas: number;
  /** Códigos cuyas fichas hoy tienen precios distintos entre sí. */
  codigosDesparejos: number;
}

const refDe = (f: FichaProducto) => f.codigo?.trim() || `id ${f.id}`;

function contarDesparejos(fichas: FichaProducto[]): number {
  let n = 0;
  for (const grupo of agruparPorCodigo(fichas).values()) {
    if (grupo.length < 2) continue;
    const w = new Set(grupo.map((f) => `${precioWebDe(f)}|${precioLocalDe(f)}`));
    if (w.size > 1) n++;
  }
  return n;
}

function planVacio(metodo: MetodoPlan, formula: string): PlanPrecios {
  return { metodo, formula, cambios: [], sinCambio: 0, noEncontrados: [], invalidos: [], fichasRevisadas: 0, codigosDesparejos: 0 };
}

function aplicar(plan: PlanPrecios, f: FichaProducto, despues: EstadoPrecio) {
  plan.fichasRevisadas++;
  const antes = estadoDe(f);
  if (mismoEstado(antes, despues)) {
    plan.sinCambio++;
    return;
  }
  plan.cambios.push({ id: f.id, codigo: f.codigo?.trim() ?? "", nombre: f.nombre, antes, despues, costo: f.costo ?? null });
}

// ───────── cálculo de una ficha con precio local y/o web nuevos ─────────
/**
 * Precios que quedarían en UNA ficha. `web` y `local` son los nuevos (undefined = se mantiene el actual;
 * `local: null` = quitar el precio tachado, o sea local = web). Exige web <= local.
 * Si solo se da el web y la ficha no tenía tachado (o no tenía precio), pasa a ser el precio único.
 */
export function estadoNuevoFicha(
  f: EstadoPrecio, nuevo: { web?: number; local?: number | null },
): { estado: EstadoPrecio } | { error: string } {
  const l0 = precioLocalDe(f);
  const w0 = precioWebDe(f);
  const actualValido = esPesosValido(w0) && esPesosValido(l0);
  const web = nuevo.web ?? w0;
  let local: number;
  if (nuevo.local === null) local = web;
  else if (nuevo.local !== undefined) local = nuevo.local;
  else local = !actualValido || l0 === w0 ? web : l0;
  if (!esPesosValido(web)) return { error: "La ficha no tiene un precio web válido hoy; indica también el precio web." };
  if (!esPesosValido(local)) return { error: "La ficha no tiene un precio local válido hoy; indica también el precio local." };
  if (web > local) {
    return {
      error:
        nuevo.local === undefined
          ? `El precio web nuevo (${web}) supera al precio local actual (${local}). Indica también el nuevo precio local.`
          : nuevo.web === undefined
            ? `El precio local nuevo (${local}) queda bajo el precio web actual (${web}). Indica también el nuevo precio web.`
            : `El precio web (${web}) no puede ser mayor al precio local (${local}).`,
    };
  }
  return { estado: construirEstado(local, web) };
}

// ───────── por lista ─────────
export const FORMULA_LISTA =
  "Precios exactos de la lista: precio local = precio normal (tachado) y precio web = lo que se cobra. Si falta uno, se mantiene el actual.";

/**
 * `fichas` debe traer todas las fichas de los códigos pedidos y las de los ids pedidos
 * (el llamador las busca en la base). Una fila inválida se informa y no cambia nada.
 */
export function planificarLista(items: ItemLista[], fichas: FichaProducto[]): PlanPrecios {
  const plan = planVacio("lista", FORMULA_LISTA);
  const porCodigo = agruparPorCodigo(fichas);
  const porId = new Map(fichas.map((f) => [f.id, f]));
  const vistos = new Set<string>();
  const tocadas: FichaProducto[] = [];

  for (const item of items) {
    const codigoPedido = item.codigo?.trim();
    const referencia = codigoPedido || (item.id !== undefined ? `id ${item.id}` : "(fila sin código)");
    if (!codigoPedido && item.id === undefined) {
      plan.invalidos.push({ referencia, motivo: "Falta el código o el id del producto." });
      continue;
    }
    if (item.precio_local === undefined && item.precio_web === undefined) {
      plan.invalidos.push({ referencia, motivo: "No trae precio local ni precio web." });
      continue;
    }
    const malo = (["precio_local", "precio_web"] as const).find((k) => item[k] !== undefined && !esPesosValido(item[k]));
    if (malo) {
      plan.invalidos.push({ referencia, motivo: `${malo === "precio_local" ? "El precio local" : "El precio web"} no es válido: debe ser un número entero de pesos mayor a 0.` });
      continue;
    }

    // Fichas del producto: por código (todas) o, si solo hay id, las de su código.
    let objetivo: FichaProducto[] = [];
    if (codigoPedido) objetivo = porCodigo.get(normalizarCodigo(codigoPedido)) ?? [];
    else {
      const f = porId.get(item.id as number);
      if (f) objetivo = f.codigo ? porCodigo.get(normalizarCodigo(f.codigo)) ?? [f] : [f];
    }
    if (objetivo.length === 0) {
      plan.noEncontrados.push(referencia);
      continue;
    }
    const clave = objetivo[0].codigo ? normalizarCodigo(objetivo[0].codigo) : `id:${objetivo[0].id}`;
    if (vistos.has(clave)) {
      plan.invalidos.push({ referencia, motivo: "El producto aparece repetido en la lista (se usa la primera fila)." });
      continue;
    }
    vistos.add(clave);

    const resultados: Array<{ f: FichaProducto; despues: EstadoPrecio }> = [];
    let error: string | null = null;
    for (const f of objetivo) {
      const r = estadoNuevoFicha(f, { web: item.precio_web, local: item.precio_local });
      if ("error" in r) {
        error = r.error;
        break;
      }
      resultados.push({ f, despues: r.estado });
    }
    if (error) {
      plan.invalidos.push({ referencia, motivo: error });
      continue;
    }
    for (const r of resultados) aplicar(plan, r.f, r.despues);
    tocadas.push(...objetivo);
  }
  plan.codigosDesparejos = contarDesparejos(tocadas);
  return plan;
}

// ───────── precio web = local menos X % ─────────
export function formulaDescuento(bp: number): string {
  const pct = (bp / 100).toString().replace(".", ",");
  return `Precio normal (tachado) = precio local actual (el tachado de hoy, o el precio si no hay tachado). Precio web = precio local − ${pct} %, redondeado al peso más cercano (la mitad sube).`;
}

export function planificarDescuentoWeb(fichas: FichaProducto[], bp: number, codigosPedidos: string[] = []): PlanPrecios {
  if (!Number.isInteger(bp) || bp < 1 || bp > 5000) throw new RangeError("Descuento fuera de rango");
  const plan = planVacio("descuento_web", formulaDescuento(bp));
  const encontrados = new Set(fichas.map((f) => (f.codigo ? normalizarCodigo(f.codigo) : "")));
  for (const c of codigosPedidos) if (!encontrados.has(normalizarCodigo(c))) plan.noEncontrados.push(c.trim());
  for (const f of fichas) {
    const local = precioLocalDe(f);
    if (!esPesosValido(local)) {
      plan.fichasRevisadas++;
      plan.invalidos.push({ referencia: refDe(f), motivo: "Sin precio local válido." });
      continue;
    }
    const web = precioBajoLocal(local, bp);
    if (!esPesosValido(web)) {
      plan.fichasRevisadas++;
      plan.invalidos.push({ referencia: refDe(f), motivo: "El precio web quedaría en 0." });
      continue;
    }
    aplicar(plan, f, construirEstado(local, web));
  }
  plan.codigosDesparejos = contarDesparejos(fichas);
  return plan;
}

// ───────── reajuste en % de local y web ─────────
export function formulaReajuste(bp: number): string {
  const pct = (Math.abs(bp) / 100).toString().replace(".", ",");
  return `${bp >= 0 ? "Sube" : "Baja"} ${pct} % tanto el precio local como el precio web, cada uno redondeado al peso más cercano (la mitad sube).`;
}

export function planificarReajuste(fichas: FichaProducto[], bp: number): PlanPrecios {
  if (!Number.isInteger(bp) || bp === 0 || bp < -9000 || bp > 20000) throw new RangeError("Reajuste fuera de rango");
  const plan = planVacio("reajuste", formulaReajuste(bp));
  for (const f of fichas) {
    const local = precioLocalDe(f);
    const web = precioWebDe(f);
    if (!esPesosValido(local) || !esPesosValido(web)) {
      plan.fichasRevisadas++;
      plan.invalidos.push({ referencia: refDe(f), motivo: "Sin precio válido." });
      continue;
    }
    const nl = reajustarPrecio(local, bp);
    const nw = reajustarPrecio(web, bp);
    if (!esPesosValido(nl) || !esPesosValido(nw)) {
      plan.fichasRevisadas++;
      plan.invalidos.push({ referencia: refDe(f), motivo: "El precio nuevo quedaría fuera de rango." });
      continue;
    }
    aplicar(plan, f, construirEstado(nl, nw));
  }
  plan.codigosDesparejos = contarDesparejos(fichas);
  return plan;
}

export { porcentajeABp };

// ───────── resumen para la vista previa ─────────
export interface LineaPrecio {
  codigo: string;
  nombre: string;
  antes: number;
  despues: number;
  pct: number;
}
export interface LineaMargen {
  codigo: string;
  nombre: string;
  costo: number;
  precioWeb: number;
}
export interface ResumenPlan {
  fichasQueCambian: number;
  productosQueCambian: number;
  sinCambio: number;
  mayoresSubidas: LineaPrecio[];
  mayoresBajadas: LineaPrecio[];
  bajoCosto: { total: number; ejemplos: LineaMargen[] };
  menos15: { total: number; ejemplos: LineaMargen[] };
  /** Productos que quedan con ahorro menor a 5 %: la tienda no muestra el tachado. */
  sinTachadoVisible: number;
  codigosDesparejos: number;
  noEncontrados: { total: number; ejemplos: string[] };
  invalidos: { total: number; ejemplos: Array<{ referencia: string; motivo: string }> };
}

const EJEMPLOS = 10;

/** Un renglón por código (las fichas repetidas cuentan como un producto). */
function porProducto(cambios: CambioFicha[]): Map<string, CambioFicha[]> {
  const m = new Map<string, CambioFicha[]>();
  for (const c of cambios) {
    const k = c.codigo || `id:${c.id}`;
    m.set(k, [...(m.get(k) ?? []), c]);
  }
  return m;
}

export function resumirPlan(plan: PlanPrecios): ResumenPlan {
  const productos = porProducto(plan.cambios);
  const lineas: LineaPrecio[] = [];
  const bajo: LineaMargen[] = [];
  const m15: LineaMargen[] = [];
  let sinTachado = 0;
  for (const [k, fichas] of productos) {
    // Representante: la ficha con mayor movimiento del precio web.
    const rep = fichas.reduce((a, b) => (Math.abs(variacionFirmadaPct(b.antes.precio, precioWebDe(b.despues))) > Math.abs(variacionFirmadaPct(a.antes.precio, precioWebDe(a.despues))) ? b : a));
    const antes = precioWebDe(rep.antes);
    const despues = precioWebDe(rep.despues);
    lineas.push({ codigo: rep.codigo || k, nombre: rep.nombre, antes, despues, pct: variacionFirmadaPct(antes, despues) });
    let peor: ReturnType<typeof clasificarMargen> = "ok";
    for (const f of fichas) {
      const c = clasificarMargen(precioWebDe(f.despues), f.costo);
      if (c === "bajo_costo") peor = "bajo_costo";
      else if (c === "menos_15" && peor !== "bajo_costo") peor = "menos_15";
    }
    const conCosto = fichas.find((f) => f.costo && clasificarMargen(precioWebDe(f.despues), f.costo) === peor) ?? rep;
    const linea: LineaMargen = { codigo: rep.codigo || k, nombre: rep.nombre, costo: conCosto.costo ?? 0, precioWeb: precioWebDe(conCosto.despues) };
    if (peor === "bajo_costo") bajo.push(linea);
    else if (peor === "menos_15") m15.push(linea);
    if (fichas.some((f) => f.despues.en_oferta && !tachadoSeMuestra(f.despues))) sinTachado++;
  }
  const subidas = lineas.filter((l) => l.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, EJEMPLOS);
  const bajadas = lineas.filter((l) => l.pct < 0).sort((a, b) => a.pct - b.pct).slice(0, EJEMPLOS);
  return {
    fichasQueCambian: plan.cambios.length,
    productosQueCambian: productos.size,
    sinCambio: plan.sinCambio,
    mayoresSubidas: subidas,
    mayoresBajadas: bajadas,
    bajoCosto: { total: bajo.length, ejemplos: bajo.slice(0, EJEMPLOS) },
    menos15: { total: m15.length, ejemplos: m15.slice(0, EJEMPLOS) },
    sinTachadoVisible: sinTachado,
    codigosDesparejos: plan.codigosDesparejos,
    noEncontrados: { total: plan.noEncontrados.length, ejemplos: plan.noEncontrados.slice(0, 20) },
    invalidos: { total: plan.invalidos.length, ejemplos: plan.invalidos.slice(0, 15) },
  };
}

// ───────── forma compacta (cabe en la vista previa de D1) y huella ─────────
/** [id, precioAntes, originalAntes, enOfertaAntes, precioDespues, originalDespues, enOfertaDespues] */
export type CambioCompacto = [number, number, number | null, 0 | 1, number, number | null, 0 | 1];

export function compactar(cambios: CambioFicha[]): CambioCompacto[] {
  return cambios.map((c) => [c.id, c.antes.precio, c.antes.precio_original, c.antes.en_oferta ? 1 : 0, c.despues.precio, c.despues.precio_original, c.despues.en_oferta ? 1 : 0]);
}

export function descompactar(x: unknown): Array<{ id: number; antes: EstadoPrecio; despues: EstadoPrecio }> | null {
  if (!Array.isArray(x)) return null;
  const out: Array<{ id: number; antes: EstadoPrecio; despues: EstadoPrecio }> = [];
  for (const t of x) {
    if (!Array.isArray(t) || t.length !== 7) return null;
    const [id, ap, ao, ae, dp, dorig, de] = t as CambioCompacto;
    if (!Number.isInteger(id) || !esPesosValido(ap) || !esPesosValido(dp)) return null;
    out.push({
      id,
      antes: { precio: ap, precio_original: ao ?? null, en_oferta: ae === 1 },
      despues: { precio: dp, precio_original: dorig ?? null, en_oferta: de === 1 },
    });
  }
  return out;
}

/** Huella de lo que se va a escribir y del estado en que se vio cada ficha. Si algo cambió en la base, la huella cambia. */
export function huellaDeCambios(cambios: Array<{ id: number; antes: EstadoPrecio; despues: EstadoPrecio }>): Promise<string> {
  const ordenados = [...cambios].sort((a, b) => a.id - b.id);
  return huellaDeDatos({ v: 1, c: ordenados.map((c) => [c.id, c.antes.precio, c.antes.precio_original, c.antes.en_oferta ? 1 : 0, c.despues.precio, c.despues.precio_original, c.despues.en_oferta ? 1 : 0]) });
}
