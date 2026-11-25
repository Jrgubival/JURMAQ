/**
 * Herramientas de lectura: salida corta y paginada (nunca se vuelcan miles de filas).
 * El costo y el margen son datos internos: solo salen de estas herramientas del panel
 * (usuario admin revalidado), nunca de la vista pública de la tienda.
 */
import type { D1Like } from "../gestion/index.ts";
import { ZONAS_DESPACHO } from "../despacho/zonas.ts";
import type { DepsGestion } from "./deps.ts";
import {
  type FichaProducto, agruparPorCodigo, clasificarMargen, margenSobreCostoPct, pesos, precioLocalDe, precioWebDe,
} from "./modelo.ts";
import { descendientes, ErrorGestion, type Salida } from "./precios-masivos.ts";

const POR_PAGINA_MAX = 50;

const chile = (ms: number) => new Date(ms).toLocaleString("es-CL", { timeZone: "America/Santiago", dateStyle: "short", timeStyle: "short" });
export { chile as fechaChile };

function lineaFicha(f: FichaProducto): string {
  const web = precioWebDe(f);
  const local = precioLocalDe(f);
  const stock = f.stock === null ? "sin dato" : String(f.stock);
  return `[${f.id}] ${f.codigo ?? "(sin código)"} ${f.nombre} | web ${pesos(web)}${local > web ? ` (normal ${pesos(local)})` : ""} | stock ${stock} | ${f.activo ? "visible" : "OCULTO"}${f.imagen ? "" : " | sin foto"}${f.categoria_id ? ` | cat ${f.categoria_id}` : ""}`;
}

function datosFicha(f: FichaProducto) {
  return {
    id: f.id, codigo: f.codigo, nombre: f.nombre, precio_web: precioWebDe(f), precio_local: precioLocalDe(f),
    en_oferta: f.en_oferta, stock: f.stock, activo: f.activo, categoria_id: f.categoria_id, tiene_foto: !!f.imagen,
  };
}

// ───────── buscar_productos ─────────
export interface EntradaBuscar {
  texto?: string;
  codigo?: string;
  categoria_id?: number;
  incluir_subcategorias?: boolean;
  estado?: "activo" | "inactivo" | "todos";
  sin_foto?: boolean;
  sin_stock?: boolean;
  solo_oferta?: boolean;
  pagina?: number;
  por_pagina?: number;
}

export async function buscarProductos(deps: DepsGestion, e: EntradaBuscar): Promise<Salida> {
  const porPagina = Math.min(e.por_pagina ?? 20, POR_PAGINA_MAX);
  const pagina = e.pagina ?? 1;
  let categoriaIds: number[] | undefined;
  if (e.categoria_id !== undefined) {
    const todas = await deps.categorias.listar({ incluirInactivas: true });
    if (!todas.some((c) => c.id === e.categoria_id)) throw new ErrorGestion("No encontré esa categoría. Mira las ids con listar_categorias.");
    categoriaIds = e.incluir_subcategorias === false ? [e.categoria_id] : descendientes(e.categoria_id, todas);
  }
  const { filas, total } = await deps.productos.buscar({
    texto: e.texto?.trim() || undefined, codigo: e.codigo?.trim() || undefined, categoriaIds, estado: e.estado ?? "activo",
    sinFoto: e.sin_foto, sinStock: e.sin_stock, soloOferta: e.solo_oferta, pagina, porPagina,
  });
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const cabecera = `${total} fichas encontradas. Página ${pagina} de ${paginas}${pagina < paginas ? " (pide la siguiente con pagina)" : ""}.`;
  return {
    texto: filas.length ? `${cabecera}\n${filas.map(lineaFicha).join("\n")}` : `${cabecera} No hay resultados.`,
    datos: { total, pagina, paginas, productos: filas.map(datosFicha) },
  };
}

// ───────── ver_producto ─────────
export async function verProducto(deps: DepsGestion, db: D1Like | null, e: { codigo?: string; id?: number }): Promise<Salida> {
  let fichas: FichaProducto[] = [];
  if (e.codigo?.trim()) fichas = await deps.productos.fichasPorCodigos([e.codigo.trim()]);
  else if (e.id !== undefined) {
    const porId = await deps.productos.fichasPorIds([e.id]);
    fichas = porId[0]?.codigo ? await deps.productos.fichasPorCodigos([porId[0].codigo]) : porId;
  } else throw new ErrorGestion("Indica el código (o el id) del producto.");
  if (fichas.length === 0) throw new ErrorGestion("No encontré ese producto. Búscalo con buscar_productos.");

  const codigo = fichas[0].codigo;
  let ofertas: Array<{ id: string; estado: string; precio_oferta: number; inicio_en: number; fin_en: number }> = [];
  if (db && codigo) {
    try {
      const r = await db
        .prepare("SELECT id, estado, precio_oferta, inicio_en, fin_en FROM ofertas WHERE codigo = ? AND estado IN ('programada','activando','activa','terminando') ORDER BY inicio_en LIMIT 10")
        .bind(codigo)
        .all<{ id: string; estado: string; precio_oferta: number; inicio_en: number; fin_en: number }>();
      ofertas = r.results;
    } catch {
      ofertas = [];
    }
  }
  const lineas = fichas.map((f) => {
    const web = precioWebDe(f);
    const m = margenSobreCostoPct(web, f.costo);
    const combo = f.combo_cantidad && f.combo_precio ? ` | combo ${f.combo_cantidad} por ${pesos(f.combo_precio)}` : "";
    return `Ficha ${f.id}: ${f.nombre}\n  precio web ${pesos(web)} | precio local ${pesos(precioLocalDe(f))} | costo ${f.costo ? pesos(f.costo) : "sin dato"} | utilidad sobre costo ${m === null ? "sin dato" : `${m.toString().replace(".", ",")} %`} (${clasificarMargen(web, f.costo).replace("_", " ")})\n  stock ${f.stock ?? "sin dato"} | ${f.activo ? "visible" : "OCULTO"} | categoría ${f.categoria_id ?? "ninguna"} | imagen ${f.imagen ?? "sin foto"}${combo}${f.oferta_fin ? ` | oferta_fin ${f.oferta_fin}` : ""}`;
  });
  const lineasOf = ofertas.map((o) => `Oferta ${o.id}: ${o.estado}, ${pesos(o.precio_oferta)}, desde ${chile(o.inicio_en)} hasta ${chile(o.fin_en)}`);
  const aviso = fichas.length > 1 ? `Este código tiene ${fichas.length} fichas; los cambios por código las tocan todas.\n` : "";
  return {
    texto: `Producto ${codigo ?? "(sin código)"}\n${aviso}${lineas.join("\n")}${lineasOf.length ? `\n${lineasOf.join("\n")}` : ""}`,
    datos: {
      codigo,
      fichas: fichas.map((f) => ({
        ...datosFicha(f), costo: f.costo, margen_pct: margenSobreCostoPct(precioWebDe(f), f.costo), clase_margen: clasificarMargen(precioWebDe(f), f.costo),
        descripcion: f.descripcion, imagen: f.imagen, oferta_fin: f.oferta_fin, combo_cantidad: f.combo_cantidad, combo_precio: f.combo_precio,
      })),
      ofertas,
    },
  };
}

// ───────── listar_categorias ─────────
export async function listarCategorias(deps: DepsGestion, e: { incluir_inactivas?: boolean }): Promise<Salida> {
  const cats = await deps.categorias.listar({ incluirInactivas: !!e.incluir_inactivas });
  const conteo = await deps.productos.conteoPorCategoria().catch(() => new Map<number, number>());
  const hijosDe = new Map<number | null, typeof cats>();
  for (const c of cats) hijosDe.set(c.padre_id, [...(hijosDe.get(c.padre_id) ?? []), c]);
  const ids = new Set(cats.map((c) => c.id));
  const lineas: string[] = [];
  const datos: Array<Record<string, unknown>> = [];
  const visitar = (c: (typeof cats)[number], nivel: number) => {
    const n = conteo.get(c.id) ?? 0;
    lineas.push(`${"  ".repeat(nivel)}[${c.id}] ${c.nombre} | ${n} productos activos | orden ${c.orden ?? 0}${c.activa ? "" : " | INACTIVA"}`);
    datos.push({ id: c.id, nombre: c.nombre, slug: c.slug, padre_id: c.padre_id, orden: c.orden, activa: c.activa, productos_activos: n });
    for (const h of hijosDe.get(c.id) ?? []) visitar(h, nivel + 1);
  };
  for (const c of cats) if (c.padre_id === null || !ids.has(c.padre_id)) visitar(c, 0);
  return { texto: lineas.length ? lineas.join("\n") : "No hay categorías.", datos: { categorias: datos } };
}

// ───────── ver_margenes ─────────
export async function verMargenes(deps: DepsGestion, e: { categoria_id?: number; solo_problemas?: boolean; limite?: number }): Promise<Salida> {
  let categoriaIds: number[] | undefined;
  if (e.categoria_id !== undefined) {
    const todas = await deps.categorias.listar({ incluirInactivas: true });
    if (!todas.some((c) => c.id === e.categoria_id)) throw new ErrorGestion("No encontré esa categoría. Mira las ids con listar_categorias.");
    categoriaIds = descendientes(e.categoria_id, todas);
  }
  const fichas = await deps.productos.fichasActivas({ categoriaIds, tope: 5000 });
  const porCodigo = agruparPorCodigo(fichas.filter((f) => f.codigo));
  const cuenta = { sin_costo: 0, bajo_costo: 0, menos_15: 0, ok: 0 };
  const filas: Array<{ codigo: string; nombre: string; web: number; costo: number; margen: number; clase: string }> = [];
  for (const [codigo, grupo] of porCodigo) {
    // Por producto se mira la ficha más delgada (la peor).
    const evaluadas = grupo.map((f) => ({ f, clase: clasificarMargen(precioWebDe(f), f.costo), m: margenSobreCostoPct(precioWebDe(f), f.costo) }));
    const conCosto = evaluadas.filter((x) => x.m !== null);
    if (conCosto.length === 0) { cuenta.sin_costo++; continue; }
    const peor = conCosto.reduce((a, b) => ((b.m as number) < (a.m as number) ? b : a));
    cuenta[peor.clase as keyof typeof cuenta]++;
    if (peor.clase === "bajo_costo" || peor.clase === "menos_15") {
      filas.push({ codigo, nombre: peor.f.nombre, web: precioWebDe(peor.f), costo: peor.f.costo as number, margen: peor.m as number, clase: peor.clase });
    }
  }
  filas.sort((a, b) => a.margen - b.margen);
  const limite = Math.min(e.limite ?? 25, 50);
  const mostrar = filas.slice(0, limite);
  const resumen = `Productos activos revisados: ${porCodigo.size}. Bajo el costo: ${cuenta.bajo_costo}. Con menos de 15 % sobre el costo: ${cuenta.menos_15}. Bien: ${cuenta.ok}. Sin costo cargado (no se puede calcular): ${cuenta.sin_costo}.`;
  const detalle = mostrar.map((f) => `${f.codigo} ${f.nombre.slice(0, 40)}: web ${pesos(f.web)}, costo ${pesos(f.costo)}, utilidad ${f.margen.toString().replace(".", ",")} %${f.clase === "bajo_costo" ? " (BAJO EL COSTO)" : ""}`);
  return {
    texto: `${resumen}${detalle.length ? `\nLos más delgados (${mostrar.length} de ${filas.length}):\n${detalle.join("\n")}` : ""}`,
    datos: { revisados: porCodigo.size, ...cuenta, problemas: filas.length, peores: mostrar },
  };
}

// ───────── ver_zonas_despacho ─────────
export async function verZonasDespacho(deps: DepsGestion): Promise<Salida> {
  try {
    const zonas = await deps.zonas.listar();
    const lineas = zonas.map((z) => `${z.id} (${z.nombre}): despacho ${pesos(z.costo)}, gratis desde ${z.gratis_desde ? pesos(z.gratis_desde) : "nunca (o siempre gratis si el costo es $0)"}${z.activo ? "" : " | DESACTIVADA"}`);
    return {
      texto: `Zonas de despacho (de la base). El monto "gratis desde" es el total de productos desde el que no se cobra despacho.\n${lineas.join("\n")}`,
      datos: { fuente: "base", zonas: zonas.map((z) => ({ id: z.id, nombre: z.nombre, costo: z.costo, gratis_desde: z.gratis_desde, activo: z.activo })) },
    };
  } catch {
    const lineas = ZONAS_DESPACHO.map((z) => `${z.id} (${z.nombre}): despacho ${pesos(z.costo)}, gratis desde ${z.gratisDesde ? pesos(z.gratisDesde) : "nunca (o siempre gratis si el costo es $0)"}`);
    return {
      texto: `La tabla de zonas no está disponible; la tienda cobra estas tarifas fijas del código (no se pueden cambiar desde aquí hasta crear la tabla):\n${lineas.join("\n")}`,
      datos: { fuente: "codigo", zonas: ZONAS_DESPACHO.map((z) => ({ id: z.id, nombre: z.nombre, costo: z.costo, gratis_desde: z.gratisDesde, activo: true })) },
    };
  }
}
