/**
 * Productos relacionados fijados a mano por código (puro: D1 y tienda por parámetro).
 * La ficha muestra esta lista, en ese orden, si existe y alguno se puede comprar; si no, el criterio
 * automático de siempre (misma categoría, con más stock). Quitar la lista vuelve al automático.
 */
import type { D1Like, EntradaAuditoria, UsuarioGestion } from "../gestion/index.ts";
import { ErrorGestion } from "../gestion-precios/precios-masivos.ts";
import { vistaPrecio } from "../precio-web.ts";
import type { DepsSeo } from "./deps.ts";
import { escribirRelacionados, leerRelacionadosGuardados } from "./repositorio.ts";
import { refrescar, type CtxSeo, type ResultadoRevertir, type Salida } from "./servicio.ts";

export const MAX_RELACIONADOS = 8;
/** Cuántos muestra la ficha (la grilla es de 4). */
export const MOSTRADOS_EN_FICHA = 4;
export const HERRAMIENTA_RELACIONADOS = "fijar_relacionados";

const RE_CODIGO = /^[A-Za-z0-9][A-Za-z0-9._\-/ ]{0,39}$/;

type Ficha = Awaited<ReturnType<DepsSeo["productos"]["fichasPorCodigos"]>>[number];

const dispo = (f: Ficha) => vistaPrecio({ precio: f.precio, precio_original: f.precio_original, en_oferta: f.en_oferta, stock: f.stock, solo_cotizar: f.solo_cotizar }).disponible;
const primera = (fs: Ficha[]) => [...fs].sort((a, b) => Number(b.activo) - Number(a.activo) || a.id - b.id)[0];

function agrupar(fichas: Ficha[]): Map<string, Ficha[]> {
  const m = new Map<string, Ficha[]>();
  for (const f of fichas) if (f.codigo) m.set(f.codigo, [...(m.get(f.codigo) ?? []), f]);
  return m;
}

/** Lo que haría el criterio automático: misma categoría, activos, con stock y precio, más stock primero. */
async function automatico(deps: DepsSeo, codigo: string, fichasPropias: Ficha[]): Promise<Ficha[]> {
  const categoria = primera(fichasPropias)?.categoria_id;
  if (categoria == null) return [];
  const { filas } = await deps.productos.buscar({ categoriaIds: [categoria], estado: "activo", pagina: 1, porPagina: 60 });
  const vistos = new Set<string>([codigo]);
  const out: Ficha[] = [];
  for (const f of [...filas].sort((a, b) => (b.stock ?? 0) - (a.stock ?? 0))) {
    if (!f.codigo || vistos.has(f.codigo) || !f.activo || !(f.stock && f.stock > 0) || !(f.precio > 0) || !dispo(f)) continue;
    vistos.add(f.codigo);
    out.push(f);
    if (out.length >= MOSTRADOS_EN_FICHA) break;
  }
  return out;
}

export async function verRelacionados(db: D1Like, deps: DepsSeo, codigoCrudo: string): Promise<Salida> {
  const codigo = codigoCrudo.trim();
  if (!RE_CODIGO.test(codigo)) throw new ErrorGestion("El código no es válido.");
  const propias = await deps.productos.fichasPorCodigos([codigo]);
  if (propias.length === 0) throw new ErrorGestion(`No existe un producto con el código ${codigo}.`);
  const guardado = await leerRelacionadosGuardados(db, codigo);
  const nombre = primera(propias).nombre;
  const lineas = [`Producto ${codigo} · ${nombre}`];
  const datos: Record<string, unknown> = { codigo, manual: !!guardado };
  if (guardado) {
    const fichas = agrupar(await deps.productos.fichasPorCodigos(guardado.lista));
    lineas.push(`Relacionados fijados a mano (${guardado.lista.length}), en este orden:`);
    for (const c of guardado.lista) {
      const f = fichas.get(c);
      const p = f ? primera(f) : null;
      const estado = !p ? "YA NO EXISTE" : !p.activo ? "inactivo (no se muestra)" : dispo(p) ? "se muestra" : "sin stock o sin precio (no se muestra por ahora)";
      lineas.push(`  ${c} · ${p ? p.nombre : "?"} · ${estado}`);
    }
    lineas.push(`La ficha muestra los primeros ${MOSTRADOS_EN_FICHA} que se pueden comprar; si ninguno se puede comprar, vuelve al criterio automático.`);
    datos.lista = guardado.lista;
  } else {
    lineas.push("Sin relacionados fijados: la ficha usa el criterio automático (misma categoría, con más stock).");
  }
  const auto = await automatico(deps, codigo, propias);
  lineas.push(auto.length ? `Hoy el criterio automático mostraría: ${auto.map((f) => f.codigo).join(", ")}.` : "Hoy el criterio automático no tiene productos para mostrar.");
  datos.automatico = auto.map((f) => f.codigo);
  return { texto: lineas.join("\n"), datos };
}

/** Valida y devuelve los códigos limpios y la lista de avisos. Lanza ErrorGestion si algo no sirve. */
export async function validarRelacionados(deps: DepsSeo, codigo: string, crudos: string[]): Promise<{ lista: string[]; avisos: string[] }> {
  if (!RE_CODIGO.test(codigo)) throw new ErrorGestion("El código del producto no es válido.");
  if (crudos.length === 0) throw new ErrorGestion("La lista está vacía. Para volver al criterio automático usa quitar_relacionados.");
  if (crudos.length > MAX_RELACIONADOS) throw new ErrorGestion(`Máximo ${MAX_RELACIONADOS} relacionados.`);
  const lista = crudos.map((c) => c.trim());
  const errores: string[] = [];
  const vistos = new Set<string>();
  for (const c of lista) {
    if (!RE_CODIGO.test(c)) errores.push(`«${c}» no es un código válido.`);
    else if (c === codigo) errores.push(`${c} es el mismo producto: no puede ser su propio relacionado.`);
    else if (vistos.has(c)) errores.push(`${c} está repetido.`);
    vistos.add(c);
  }
  if (errores.length) throw new ErrorGestion(`No se guardó nada:\n${errores.map((e) => `- ${e}`).join("\n")}`);
  const propias = await deps.productos.fichasPorCodigos([codigo]);
  if (propias.length === 0) throw new ErrorGestion(`No existe un producto con el código ${codigo}.`);
  const fichas = agrupar(await deps.productos.fichasPorCodigos(lista));
  const avisos: string[] = [];
  for (const c of lista) {
    const f = fichas.get(c);
    if (!f) errores.push(`No existe un producto con el código ${c}.`);
    else if (!f.some((x) => x.activo)) errores.push(`El producto ${c} está inactivo: no se puede mostrar como relacionado.`);
    else if (!f.some((x) => x.activo && dispo(x))) avisos.push(`${c} hoy no se puede comprar (sin stock o sin precio): no se mostrará hasta que vuelva.`);
  }
  if (errores.length) throw new ErrorGestion(`No se guardó nada:\n${errores.map((e) => `- ${e}`).join("\n")}`);
  return { lista, avisos };
}

/** Fija (lista) o quita (null) los relacionados de un código. Libre: no necesita aprobación. */
export async function fijarRelacionados(deps: DepsSeo, ctx: CtxSeo, codigoCrudo: string, crudos: string[] | null): Promise<Salida> {
  const codigo = codigoCrudo.trim();
  let lista: string[] | null = null;
  let avisos: string[] = [];
  if (crudos !== null) {
    const v = await validarRelacionados(deps, codigo, crudos);
    lista = v.lista;
    avisos = v.avisos;
  } else {
    if (!RE_CODIGO.test(codigo)) throw new ErrorGestion("El código del producto no es válido.");
    if ((await deps.productos.fichasPorCodigos([codigo])).length === 0) throw new ErrorGestion(`No existe un producto con el código ${codigo}.`);
  }
  const antes = (await leerRelacionadosGuardados(ctx.db, codigo))?.lista ?? null;
  if (JSON.stringify(antes) === JSON.stringify(lista)) {
    return { texto: lista ? `Sin cambios: ${codigo} ya tenía esos relacionados, en ese orden.` : `Sin cambios: ${codigo} ya usaba el criterio automático.`, datos: { aplicado: false } };
  }
  await escribirRelacionados(ctx.db, ctx.usuario, codigo, lista, ctx.ahora);
  await ctx.auditar([{ entidad: "relacionados", entidadId: codigo, herramienta: HERRAMIENTA_RELACIONADOS, antes: { lista: antes }, despues: { lista } }]);
  await refrescar(deps, [{ tipo: "producto", clave: codigo }]);
  const texto = lista
    ? [`Listo: ${codigo} ahora muestra estos relacionados, en orden: ${lista.join(", ")}.`, ...avisos, "Se puede deshacer desde el historial."].join("\n")
    : `Listo: ${codigo} vuelve al criterio automático de relacionados. Se puede deshacer desde el historial.`;
  return { texto, datos: { aplicado: true, lista } };
}

/** Deshacer: restaura la lista anterior solo si sigue como la dejó la herramienta. */
export async function revertirRelacionados(deps: DepsSeo, p: { db: D1Like; usuario: UsuarioGestion; ahora: number; entradas: EntradaAuditoria[] }): Promise<ResultadoRevertir> {
  let hechas = 0;
  let yaEstaba = 0;
  const saltadas: string[] = [];
  const tocadas: Array<{ tipo: "producto"; clave: string }> = [];
  const lista = (x: unknown): string[] | null => {
    const l = (x as { lista?: unknown } | null)?.lista;
    return Array.isArray(l) && l.every((v) => typeof v === "string") ? (l as string[]) : null;
  };
  for (const e of p.entradas) {
    const antes = lista(e.antes);
    const despues = lista(e.despues);
    const actual = (await leerRelacionadosGuardados(p.db, e.entidadId))?.lista ?? null;
    if (JSON.stringify(actual) === JSON.stringify(antes)) { yaEstaba++; continue; }
    if (JSON.stringify(actual) !== JSON.stringify(despues)) { saltadas.push(e.entidadId); continue; }
    await escribirRelacionados(p.db, p.usuario, e.entidadId, antes, p.ahora);
    tocadas.push({ tipo: "producto", clave: e.entidadId });
    hechas++;
  }
  if (tocadas.length) await refrescar(deps, tocadas);
  const partes = [`${hechas} restaurado${hechas === 1 ? "" : "s"}`];
  if (yaEstaba) partes.push(`${yaEstaba} ya estaba${yaEstaba === 1 ? "" : "n"} como antes`);
  if (saltadas.length) partes.push(`no toqué ${saltadas.join(", ")} porque alguien lo cambió después`);
  if (hechas === 0 && yaEstaba === 0) return { ok: false, mensaje: `No se pudo deshacer: ${partes.join("; ")}.` };
  return { ok: true, mensaje: `${partes.join("; ")}.` };
}
