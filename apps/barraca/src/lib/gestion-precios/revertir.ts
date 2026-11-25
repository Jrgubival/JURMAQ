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
 */
import type { EntradaAuditoria } from "../gestion/index.ts";
import type { DepsGestion } from "./deps.ts";
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

export async function revertirEntradas(deps: DepsGestion, usuarioId: string, entradas: EntradaAuditoria[]): Promise<ResultadoRevertir> {
  const cuenta: Contador = { hechas: 0, yaEstaban: 0, conflictos: [] };
  const productos = entradas.filter((e) => e.entidad === "producto");
  const categorias = entradas.filter((e) => e.entidad === "categoria");
  const zonas = entradas.filter((e) => e.entidad === "zona");

  try {
    if (productos.length) {
      const ids = productos.map((e) => Number(e.entidadId)).filter((n) => Number.isInteger(n));
      const actuales = new Map((await deps.productos.fichasPorIds(ids)).map((f) => [f.id, f as unknown as Registro]));
      const tocados: number[] = [];
      for (const e of productos) {
        const id = Number(e.entidadId);
        const actual = actuales.get(id);
        const despues = esRegistro(e.despues) ? e.despues : null;
        const antes = esRegistro(e.antes) ? e.antes : null;
        const etiqueta = typeof despues?.codigo === "string" ? despues.codigo : `id ${id}`;
        if (!actual || !despues) { cuenta.conflictos.push(etiqueta); continue; }
        if (!antes) {
          // Creación: se desactiva (nunca se borra).
          if (actual.activo === false) cuenta.yaEstaban++;
          else { await deps.productos.actualizar(id, { activo: false }); cuenta.hechas++; tocados.push(id); }
          continue;
        }
        const claves = CLAVES_PRODUCTO.filter((k) => k in despues);
        if (claves.length === 0) continue;
        if (coincide(claves, despues, actual)) {
          const campos = elegir(claves, antes) as CamposFicha;
          const esperado: { precio?: number; precio_original?: number | null } = {};
          if (claves.includes("precio")) esperado.precio = Number(despues.precio);
          if (claves.includes("precio_original")) esperado.precio_original = despues.precio_original === null || despues.precio_original === undefined ? null : Number(despues.precio_original);
          const ok = await deps.productos.actualizar(id, campos, Object.keys(esperado).length ? esperado : undefined);
          if (ok) { cuenta.hechas++; tocados.push(id); } else cuenta.conflictos.push(etiqueta);
        } else if (coincide(claves, antes, actual)) cuenta.yaEstaban++;
        else cuenta.conflictos.push(etiqueta);
      }
      if (tocados.length) await deps.revalidar(tocados);
    }

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

    if (zonas.length) {
      const actuales = new Map((await deps.zonas.listar()).map((z) => [z.id, z as unknown as Registro]));
      let toco = false;
      for (const e of zonas) {
        const id = String(e.entidadId);
        const actual = actuales.get(id);
        const despues = esRegistro(e.despues) ? e.despues : null;
        const antes = esRegistro(e.antes) ? e.antes : null;
        const etiqueta = `zona ${id}`;
        if (!actual || !despues || !antes) { cuenta.conflictos.push(etiqueta); continue; }
        const claves = CLAVES_ZONA.filter((k) => k in despues);
        if (coincide(claves, despues, actual)) {
          await deps.zonas.actualizar(id, elegir(claves, antes), usuarioId);
          cuenta.hechas++;
          toco = true;
        } else if (coincide(claves, antes, actual)) cuenta.yaEstaban++;
        else cuenta.conflictos.push(etiqueta);
      }
      if (toco) await deps.zonasCambiadas();
    }
  } catch {
    return { ok: false, mensaje: "No se pudo deshacer por completo por un error. Lo que ya se restauró queda así; vuelve a intentar para terminar (es seguro repetirlo)." };
  }
  return resultado(cuenta);
}
