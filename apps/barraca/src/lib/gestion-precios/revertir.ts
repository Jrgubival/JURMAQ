/**
 * Deshacer cambios de productos, categorías y zonas de despacho registrados en
 * la auditoría. Regla de Jorge: el deshacer valida que el dato siga como lo
 * dejó la herramienta; si alguien lo cambió después, NO lo pisa y lo avisa.
 *
 * Por cada entrada:
 *   - el dato actual coincide con `despues`  → se restaura `antes`;
 *   - ya coincide con `antes`                → ya estaba deshecho (repetible, sin daño);
 *   - cualquier otra cosa                    → conflicto: no se toca y se informa.
 * Una entrada de creación (antes = null) se deshace DESACTIVANDO (nunca se borra).
 * Si no se pudo restaurar nada por conflictos, devuelve ok:false (el lote queda vigente).
 *
 * Deshacer NO es una puerta trasera: lo que se restaura pasa por las mismas
 * reglas que una escritura normal (precio bajo el costo o con menos de 15 %,
 * producto sin costo, más de 30 % o 300 productos en 24 h, y SIEMPRE el despacho).
 * Si el valor restaurado las dispararía, queda pendiente de Jorge (misma
 * aprobación por correo) y no se toca nada hasta que apruebe; al repetir el
 * deshacer se aplica.
 */
import type { D1Like, EntradaAuditoria, UsuarioGestion } from "../gestion/index.ts";
import { huellaDeDatos } from "../gestion/util.ts";
import type { MotivoAprobacion } from "../mcp/aprobaciones.ts";
import { exigirAprobacion } from "./aprobacion.ts";
import { ErrorTopeDuro } from "./topes.ts";
import type { DepsGestion } from "./deps.ts";
import { precioLocalDe, precioWebDe } from "./modelo.ts";
import { type CambioEvaluable, evaluarCambioPrecios, registrarCambioAplicado } from "./reglas.ts";
import type { CamposFicha } from "./repo.ts";

export type ResultadoRevertir = { ok: true; mensaje?: string } | { ok: false; mensaje: string };

type Registro = Record<string, unknown>;
const esRegistro = (x: unknown): x is Registro => !!x && typeof x === "object" && !Array.isArray(x);

const CLAVES_PRODUCTO = ["precio", "precio_original", "en_oferta", "oferta_fin", "combo_cantidad", "combo_precio", "stock", "activo", "nombre", "descripcion", "imagen", "categoria_id", "costo"] as const;
const CLAVES_CATEGORIA = ["nombre", "orden", "activa", "descripcion"] as const;
const CLAVES_ZONA = ["costo", "gratis_desde", "activo"] as const;

function valorIgual(clave: string, a: unknown, b: unknown): boolean {
  const x = a === undefined ? null : a;
  const y = b === undefined ? null : b;
  if (clave === "oferta_fin") {
    if (x === null || y === null) return x === y;
    return Date.parse(String(x)) === Date.parse(String(y));
  }
  if (typeof x === "number" || typeof y === "number") return Number(x) === Number(y) && x !== null && y !== null;
  return x === y;
}

function coincide(claves: readonly string[], objetivo: Registro, actual: Registro): boolean {
  return claves.every((k) => valorIgual(k, objetivo[k], actual[k]));
}

interface Contador {
  hechas: number;
  yaEstaban: number;
  conflictos: string[];
}

function resultado(c: Contador): ResultadoRevertir {
  if (c.hechas === 0 && c.conflictos.length > 0) {
    return { ok: false, mensaje: `No se deshizo nada: ${c.conflictos.length} cambios fueron modificados después por otra persona (${c.conflictos.slice(0, 8).join(", ")}). Revisa los datos actuales antes de tocar.` };
  }
  const partes: string[] = [];
  if (c.hechas) partes.push(`Se deshicieron ${c.hechas} cambios.`);
  if (c.yaEstaban) partes.push(`${c.yaEstaban} ya estaban como antes.`);
  if (c.conflictos.length) partes.push(`${c.conflictos.length} NO se tocaron porque alguien los cambió después (${c.conflictos.slice(0, 8).join(", ")}${c.conflictos.length > 8 ? ", …" : ""}).`);
  return { ok: true, mensaje: partes.join(" ") };
}

const elegir = (claves: readonly string[], origen: Registro): Registro => Object.fromEntries(claves.filter((k) => k in origen).map((k) => [k, origen[k]]));

export interface CtxRevertir { db: D1Like; usuario: UsuarioGestion; ahora: number }

const CLAVES_PRECIO_REV = ["precio", "precio_original", "en_oferta", "combo_cantidad", "combo_precio"] as const;

export async function revertirEntradas(deps: DepsGestion, ctx: CtxRevertir, entradas: EntradaAuditoria[]): Promise<ResultadoRevertir> {
  const usuarioId = ctx.usuario.id;
  const cuenta: Contador = { hechas: 0, yaEstaban: 0, conflictos: [] };
  const productos = entradas.filter((e) => e.entidad === "producto");
  const categorias = entradas.filter((e) => e.entidad === "categoria");
  const zonas = entradas.filter((e) => e.entidad === "zona");

  try {
    // ── Fase 1: clasificar (sin escribir) ──
    type AccProd = { id: number; etiqueta: string; tipo: "desactivar" | "restaurar" | "ya" | "conflicto"; campos?: CamposFicha; esperado?: { precio?: number; precio_original?: number | null }; claves?: string[] };
    const accProd: AccProd[] = [];
    const fichas = new Map<number, Registro>();
    if (productos.length) {
      const ids = productos.map((e) => Number(e.entidadId)).filter((n) => Number.isInteger(n));
      for (const f of await deps.productos.fichasPorIds(ids)) fichas.set(f.id, f as unknown as Registro);
      for (const e of productos) {
        const id = Number(e.entidadId);
        const actual = fichas.get(id);
        const despues = esRegistro(e.despues) ? e.despues : null;
        const antes = esRegistro(e.antes) ? e.antes : null;
        const etiqueta = typeof despues?.codigo === "string" ? despues.codigo : `id ${id}`;
        if (!actual || !despues) { accProd.push({ id, etiqueta, tipo: "conflicto" }); continue; }
        if (!antes) { accProd.push({ id, etiqueta, tipo: actual.activo === false ? "ya" : "desactivar" }); continue; }
        const claves = CLAVES_PRODUCTO.filter((k) => k in despues);
        if (claves.length === 0) continue;
        if (coincide(claves, despues, actual)) {
          const campos = elegir(claves, antes) as CamposFicha;
          const esperado: { precio?: number; precio_original?: number | null } = {};
          if (claves.includes("precio")) esperado.precio = Number(despues.precio);
          if (claves.includes("precio_original")) esperado.precio_original = despues.precio_original === null || despues.precio_original === undefined ? null : Number(despues.precio_original);
          accProd.push({ id, etiqueta, tipo: "restaurar", campos, claves: [...claves], esperado: Object.keys(esperado).length ? esperado : undefined });
        } else if (coincide(claves, antes, actual)) accProd.push({ id, etiqueta, tipo: "ya" });
        else accProd.push({ id, etiqueta, tipo: "conflicto" });
      }
    }

    type AccZona = { id: string; etiqueta: string; tipo: "restaurar" | "ya" | "conflicto"; campos?: Registro; claves?: string[] };
    const accZona: AccZona[] = [];
    if (zonas.length) {
      const actuales = new Map((await deps.zonas.listar()).map((z) => [z.id, z as unknown as Registro]));
      for (const e of zonas) {
        const id = String(e.entidadId);
        const actual = actuales.get(id);
        const despues = esRegistro(e.despues) ? e.despues : null;
        const antes = esRegistro(e.antes) ? e.antes : null;
        const etiqueta = `zona ${id}`;
        if (!actual || !despues || !antes) { accZona.push({ id, etiqueta, tipo: "conflicto" }); continue; }
        const claves = CLAVES_ZONA.filter((k) => k in despues);
        if (coincide(claves, despues, actual)) accZona.push({ id, etiqueta, tipo: "restaurar", campos: elegir(claves, antes), claves: [...claves] });
        else if (coincide(claves, antes, actual)) accZona.push({ id, etiqueta, tipo: "ya" });
        else accZona.push({ id, etiqueta, tipo: "conflicto" });
      }
    }

    // ── Reglas de aprobación sobre lo que se restauraría ──
    const evaluables: CambioEvaluable[] = [];
    const idsEvaluables: number[] = [];
    for (const a of accProd) {
      if (a.tipo !== "restaurar" || !a.campos || !a.claves) continue;
      if (!a.claves.some((k) => (CLAVES_PRECIO_REV as readonly string[]).includes(k))) continue;
      const f = fichas.get(a.id) as Registro;
      const dp = { precio: Number(a.campos.precio ?? f.precio), precio_original: a.campos.precio_original !== undefined ? (a.campos.precio_original as number | null) : (f.precio_original as number | null), en_oferta: Boolean(a.campos.en_oferta ?? f.en_oferta) };
      const ap = { precio: Number(f.precio), precio_original: (f.precio_original as number | null) ?? null, en_oferta: Boolean(f.en_oferta) };
      const cant = a.campos.combo_cantidad !== undefined ? (a.campos.combo_cantidad as number | null) : (f.combo_cantidad as number | null);
      const pc = a.campos.combo_precio !== undefined ? (a.campos.combo_precio as number | null) : (f.combo_precio as number | null);
      const cantAntes = f.combo_cantidad as number | null;
      const pcAntes = f.combo_precio as number | null;
      const tocaCombo = a.campos.combo_cantidad !== undefined || a.campos.combo_precio !== undefined;
      evaluables.push({
        clave: String(f.codigo ?? a.id), precioAntes: precioWebDe(ap), precioDespues: precioWebDe(dp), localAntes: precioLocalDe(ap), localDespues: precioLocalDe(dp),
        costo: (f.costo as number | null) ?? null,
        precioComboUnitario: tocaCombo && cant && pc ? pc / cant : null,
        comboUnitarioAntes: cantAntes && pcAntes ? pcAntes / cantAntes : null,
      });
      idsEvaluables.push(a.id);
    }
    let requiere = false;
    const motivos: MotivoAprobacion[] = [];
    let textoMotivos: string[] = [];
    if (evaluables.length) {
      let ev;
      try {
        ev = await evaluarCambioPrecios(ctx.db, { usuarioId, cambios: evaluables, ahora: ctx.ahora });
      } catch (e) {
        // Tope duro (precio 0 o bajo el 50 % del costo de hoy): restaurar ese valor no se puede ni con el OK de Jorge.
        if (e instanceof ErrorTopeDuro) return { ok: false, mensaje: `No se puede deshacer: ${e.message}` };
        throw e;
      }
      if (ev.requiere) { requiere = true; motivos.push(...ev.motivos); textoMotivos = ev.motivosTexto; }
    }
    const zonasARestaurar = accZona.filter((z) => z.tipo === "restaurar");
    if (zonasARestaurar.length) {
      requiere = true;
      if (!motivos.includes("despacho")) motivos.push("despacho");
      if (zonasARestaurar.some((z) => z.claves?.includes("gratis_desde")) && !motivos.includes("envio_gratis")) motivos.push("envio_gratis");
    }
    let gastar: (() => Promise<boolean>) | null = null;
    if (requiere) {
      const huella = await huellaDeDatos({
        v: 1, h: "deshacer_lote",
        productos: accProd.filter((a) => a.tipo === "restaurar").map((a) => [a.id, a.campos, a.claves?.map((k) => (fichas.get(a.id) as Registro)[k] ?? null)]),
        zonas: zonasARestaurar.map((z) => [z.id, z.campos]),
      });
      const r = await exigirAprobacion(ctx.db, deps.aprobacion, {
        usuario: ctx.usuario, herramienta: "deshacer_lote", motivos, huella,
        resumen: `Deshacer un cambio: restaurar ${evaluables.length} precio(s) de producto y ${zonasARestaurar.length} zona(s) de despacho a como estaban. El valor restaurado cae en las reglas de aprobación.`,
        detalle: { precios: evaluables.slice(0, 40).map((c) => ({ codigo: c.clave, precioActual: c.precioAntes, precioRestaurado: c.precioDespues, costo: c.costo ?? null })), zonas: zonasARestaurar.map((z) => ({ zona: z.id, restaurar: z.campos })), motivos: textoMotivos },
        cambios: evaluables,
      }, ctx.ahora);
      if (r.tipo !== "aprobada") return { ok: false, mensaje: `Deshacer queda pendiente de Jorge: ${r.mensaje} Nada se restauró. Cuando apruebe, vuelve a pedir previsualizar_deshacer_lote y luego deshacer_lote (la vista previa de ahora ya se usó).` };
      gastar = r.gastar;
    }
    if (gastar && !(await gastar())) return { ok: false, mensaje: "La aprobación de Jorge ya se había usado. Nada se restauró; vuelve a pedir deshacer." };

    // ── Fase 2: aplicar ──
    const tocados: number[] = [];
    const aplicadosPrecio: CambioEvaluable[] = [];
    for (const a of accProd) {
      if (a.tipo === "ya") cuenta.yaEstaban++;
      else if (a.tipo === "conflicto") cuenta.conflictos.push(a.etiqueta);
      else if (a.tipo === "desactivar") { await deps.productos.actualizar(a.id, { activo: false }); cuenta.hechas++; tocados.push(a.id); }
      else {
        const ok = await deps.productos.actualizar(a.id, a.campos as CamposFicha, a.esperado);
        if (ok) {
          cuenta.hechas++; tocados.push(a.id);
          const k = idsEvaluables.indexOf(a.id);
          if (k >= 0) aplicadosPrecio.push(evaluables[k]);
        } else cuenta.conflictos.push(a.etiqueta);
      }
    }
    if (tocados.length) await deps.revalidar(tocados);
    if (aplicadosPrecio.length) await registrarCambioAplicado(ctx.db, usuarioId, aplicadosPrecio, { aprobado: requiere, ahora: ctx.ahora });

    if (categorias.length) {
      const filas = await deps.categorias.porIds(categorias.map((e) => Number(e.entidadId)).filter((n) => Number.isInteger(n)));
      const actuales = new Map(filas.map((c) => [c.id, c as unknown as Registro]));
      for (const e of categorias) {
        const id = Number(e.entidadId);
        const actual = actuales.get(id);
        const despues = esRegistro(e.despues) ? e.despues : null;
        const antes = esRegistro(e.antes) ? e.antes : null;
        const etiqueta = `categoría ${id}`;
        if (!actual || !despues) { cuenta.conflictos.push(etiqueta); continue; }
        if (!antes) {
          if (actual.activa === false) cuenta.yaEstaban++;
          else { await deps.categorias.actualizar(id, { activa: false }); cuenta.hechas++; }
          continue;
        }
        const claves = CLAVES_CATEGORIA.filter((k) => k in despues);
        if (coincide(claves, despues, actual)) { await deps.categorias.actualizar(id, elegir(claves, antes)); cuenta.hechas++; }
        else if (coincide(claves, antes, actual)) cuenta.yaEstaban++;
        else cuenta.conflictos.push(etiqueta);
      }
    }

    let toco = false;
    for (const z of accZona) {
      if (z.tipo === "ya") cuenta.yaEstaban++;
      else if (z.tipo === "conflicto") cuenta.conflictos.push(z.etiqueta);
      else { await deps.zonas.actualizar(z.id, z.campos as never, usuarioId); cuenta.hechas++; toco = true; }
    }
    if (toco) await deps.zonasCambiadas();
  } catch {
    return { ok: false, mensaje: "No se pudo deshacer por completo por un error. Lo que ya se restauró queda así; vuelve a intentar para terminar (es seguro repetirlo)." };
  }
  return resultado(cuenta);
}
