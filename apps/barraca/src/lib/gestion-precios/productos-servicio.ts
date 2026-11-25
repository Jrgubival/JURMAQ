/**
 * Edición de productos y categorías (cambios chicos, directos, con auditoría y
 * deshacer). Un cambio por código llega a TODAS las fichas de ese código.
 * Lo que cae en las reglas de aprobación (precio bajo el costo o con menos de
 * 15 % sobre el costo, más de 30 % de variación, etc.) pasa por el centro de
 * reglas y queda pendiente de Jorge: la herramienta se repite igual cuando él
 * aprueba y recién ahí se aplica.
 */
import { esUrlImagenPermitida, sanearTextoMultilinea, sanearTextoPlano } from "../contenido/markdown.ts";
import { parseFecha } from "../contenido/fechas.ts";
import { huellaDeDatos } from "../gestion/util.ts";
import { exigirAprobacion } from "./aprobacion.ts";
import { ofertaFinVencida } from "./aplicar.ts";
import type { CtxGestion, DepsGestion } from "./deps.ts";
import { type FichaProducto, esPesosValido, estadoDe, mismoEstado, precioLocalDe, precioWebDe, pesos } from "./modelo.ts";
import { estadoNuevoFicha } from "./plan.ts";
import { ErrorGestion, type Salida } from "./precios-masivos.ts";
import { type CambioEvaluable, evaluarCambioPrecios, registrarCambioAplicado } from "./reglas.ts";
import type { CamposFicha } from "./repo.ts";

// ───────── utilidades ─────────
export function slugificar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

async function slugLibre(existe: (s: string) => Promise<boolean>, base: string): Promise<string> {
  const raiz = base || "producto";
  for (let i = 0; i < 20; i++) {
    const candidato = i === 0 ? raiz : `${raiz}-${i + 1}`;
    if (!(await existe(candidato))) return candidato;
  }
  throw new ErrorGestion("No pude armar una dirección (slug) libre para ese nombre. Usa un nombre distinto.");
}

const CODIGO_OK = /^[A-Za-z0-9][A-Za-z0-9 ._/-]{0,39}$/;
const FECHA_SOLO_DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Cambia el valor solo si es distinto. */
function difiere(a: unknown, b: unknown): boolean {
  return (a ?? null) !== (b ?? null);
}

// ───────── editar producto ─────────
export interface EntradaEditarProducto {
  codigo: string;
  nombre?: string;
  descripcion?: string | null;
  precio_web?: number;
  /** null = quitar el precio local (tachado). */
  precio_local?: number | null;
  /** false = apagar el tachado; true = exige que el local sea mayor al web. */
  en_oferta?: boolean;
  /** AAAA-MM-DD informativo, o null para quitarla. No termina la oferta sola (para eso, programar_oferta). */
  oferta_fin?: string | null;
  combo_cantidad?: number | null;
  combo_precio?: number | null;
  stock?: number;
  activo?: boolean;
  imagen?: string | null;
  categoria_id?: number;
}

const CLAVES_PRECIO = ["precio", "precio_original", "en_oferta"] as const;

export async function editarProducto(deps: DepsGestion, ctx: CtxGestion, e: EntradaEditarProducto, herramienta = "editar_producto"): Promise<Salida> {
  const codigo = e.codigo.trim();
  const fichas = await deps.productos.fichasPorCodigos([codigo]);
  if (fichas.length === 0) throw new ErrorGestion(`No encontré ningún producto con el código "${codigo}". Búscalo con buscar_productos.`);

  // ── validar y normalizar lo pedido (texto sin HTML, imagen propia, números sanos) ──
  const base: CamposFicha = {};
  if (e.nombre !== undefined) {
    const n = sanearTextoPlano(e.nombre, 200);
    if (!n) throw new ErrorGestion("El nombre no puede quedar vacío.");
    base.nombre = n;
  }
  if (e.descripcion !== undefined) base.descripcion = e.descripcion === null ? null : sanearTextoMultilinea(e.descripcion, 4000) || null;
  if (e.imagen !== undefined) {
    if (e.imagen !== null && !esUrlImagenPermitida(e.imagen)) {
      throw new ErrorGestion("Esa imagen no vale: debe estar ya subida a la tienda (ruta propia, barraca.jurmaq.cl o el bucket barraca-redes). Súbela primero y pega la URL que te devuelve.");
    }
    base.imagen = e.imagen;
  }
  if (e.categoria_id !== undefined) {
    const cat = await deps.categorias.porIds([e.categoria_id]);
    if (cat.length === 0) throw new ErrorGestion("No encontré esa categoría. Mira las ids con listar_categorias.");
    base.categoria_id = e.categoria_id;
  }
  if (e.stock !== undefined) {
    if (!Number.isFinite(e.stock) || e.stock < 0 || e.stock > 10_000_000) throw new ErrorGestion("El stock debe ser un número de 0 en adelante.");
    base.stock = Math.round(e.stock * 1000) / 1000;
  }
  if (e.activo !== undefined) base.activo = e.activo;
  if (e.oferta_fin !== undefined) {
    if (e.oferta_fin !== null && (!FECHA_SOLO_DIA.test(e.oferta_fin) || parseFecha(e.oferta_fin) === null)) throw new ErrorGestion("oferta_fin debe ser una fecha AAAA-MM-DD (o null para quitarla).");
    base.oferta_fin = e.oferta_fin;
  }
  const tocaCombo = e.combo_cantidad !== undefined || e.combo_precio !== undefined;
  if (tocaCombo) {
    const sinCombo = e.combo_cantidad === null && e.combo_precio === null;
    if (!sinCombo) {
      if (!Number.isInteger(e.combo_cantidad) || (e.combo_cantidad as number) < 2 || (e.combo_cantidad as number) > 999) throw new ErrorGestion("combo_cantidad debe ser un entero entre 2 y 999 (o null junto a combo_precio null para quitar el combo).");
      if (!esPesosValido(e.combo_precio)) throw new ErrorGestion("combo_precio debe ser un entero de pesos mayor a 0 (precio total del combo).");
    }
    base.combo_cantidad = sinCombo ? null : (e.combo_cantidad as number);
    base.combo_precio = sinCombo ? null : (e.combo_precio as number);
  }
  const tocaPrecio = e.precio_web !== undefined || e.precio_local !== undefined || e.en_oferta !== undefined;
  if (e.en_oferta === false && typeof e.precio_local === "number") throw new ErrorGestion("Pides apagar la oferta y a la vez un precio local: elige una de las dos cosas.");
  for (const [k, v] of [["precio_web", e.precio_web], ["precio_local", e.precio_local]] as const) {
    if (v !== undefined && v !== null && !esPesosValido(v)) throw new ErrorGestion(`${k} debe ser un entero de pesos mayor a 0 (sin decimales, nunca 0 ni negativo).`);
  }

  // ── cambios por ficha ──
  interface Plan { f: FichaProducto; campos: CamposFicha }
  const planes: Plan[] = [];
  for (const f of fichas) {
    const campos: CamposFicha = {};
    for (const k of Object.keys(base) as Array<keyof CamposFicha>) if (difiere(base[k], f[k as keyof FichaProducto])) (campos as Record<string, unknown>)[k] = base[k];

    if (tocaPrecio) {
      let local: number | null | undefined = e.precio_local;
      if (e.en_oferta === false) local = null;
      const r = estadoNuevoFicha(f, { web: e.precio_web, local });
      if ("error" in r) throw new ErrorGestion(`Código ${codigo} (ficha ${f.id}): ${r.error}`);
      if (e.en_oferta === true && !r.estado.en_oferta) throw new ErrorGestion("Para dejarlo en oferta el precio local debe ser mayor al precio web: indica precio_local y precio_web.");
      if (!mismoEstado(estadoDe(f), r.estado)) {
        Object.assign(campos, r.estado);
        // Una oferta_fin ya vencida con la oferta encendida la revertiría mal el "expirar" manual antiguo: se limpia.
        if (r.estado.en_oferta && e.oferta_fin === undefined && ofertaFinVencida(f, ctx.ahora)) campos.oferta_fin = null;
      }
    }
    // El combo no puede salir más caro que comprar las unidades sueltas.
    const cantidad = campos.combo_cantidad !== undefined ? campos.combo_cantidad : f.combo_cantidad;
    const precioCombo = campos.combo_precio !== undefined ? campos.combo_precio : f.combo_precio;
    const webFinal = campos.precio !== undefined ? precioWebDe({ precio: campos.precio, precio_original: campos.precio_original ?? null, en_oferta: !!campos.en_oferta }) : precioWebDe(f);
    if ((tocaCombo || tocaPrecio) && cantidad && precioCombo && precioCombo >= cantidad * webFinal) {
      throw new ErrorGestion(`El combo (${cantidad} por ${pesos(precioCombo)}) no ahorra nada frente a ${cantidad} × ${pesos(webFinal)}. Revisa el precio del combo.`);
    }
    if (Object.keys(campos).length > 0) planes.push({ f, campos });
  }
  if (planes.length === 0) return { texto: `No hay nada que cambiar en ${codigo}: ya estaba así.`, datos: { aplicado: false, codigo } };

  // ── centro de reglas (solo si toca precios) ──
  const camposPrecio = (p: Plan) => CLAVES_PRECIO.some((k) => k in p.campos) || "combo_precio" in p.campos || "combo_cantidad" in p.campos;
  const cambiosPrecio = planes.filter(camposPrecio);
  const evaluables: CambioEvaluable[] = cambiosPrecio.map(({ f, campos }) => {
    const despues = { precio: campos.precio ?? f.precio, precio_original: campos.precio_original !== undefined ? campos.precio_original : f.precio_original, en_oferta: campos.en_oferta ?? f.en_oferta };
    const cantidad = campos.combo_cantidad !== undefined ? campos.combo_cantidad : f.combo_cantidad;
    const pc = campos.combo_precio !== undefined ? campos.combo_precio : f.combo_precio;
    return {
      clave: codigo, precioAntes: precioWebDe(f), precioDespues: precioWebDe(despues), localAntes: precioLocalDe(f), localDespues: precioLocalDe(despues),
      costo: f.costo, precioComboUnitario: cantidad && pc && (campos.combo_precio !== undefined || campos.combo_cantidad !== undefined) ? Math.ceil(pc / cantidad) : null,
    };
  });
  let requiere = false;
  let gastar: (() => Promise<boolean>) | null = null;
  if (evaluables.length > 0) {
    const ev = await evaluarCambioPrecios(ctx.db, { usuarioId: ctx.usuario.id, cambios: evaluables, ahora: ctx.ahora });
    requiere = ev.requiere;
    if (ev.requiere) {
      const huella = await huellaDeDatos({ v: 1, h: herramienta, codigo, c: planes.map((p) => [p.f.id, resumenFicha(p.f, Object.keys(p.campos)), p.campos]) });
      const r = await exigirAprobacion(ctx.db, deps.aprobacion, {
        usuario: ctx.usuario, herramienta, motivos: ev.motivos, huella,
        resumen: `Cambiar el producto ${codigo} (${planes[0].f.nombre}): ${describir(planes[0].campos)}.`,
        detalle: { codigo, fichas: planes.length, antes: resumenFicha(planes[0].f, Object.keys(planes[0].campos)), despues: planes[0].campos, motivos: ev.motivosTexto },
      }, ctx.ahora);
      if (r.tipo !== "aprobada") return { texto: r.mensaje, datos: { aplicado: false, estado: r.tipo, motivos: ev.motivosTexto, codigo } };
      gastar = r.gastar;
    }
  }
  if (gastar && !(await gastar())) throw new ErrorGestion("La aprobación de Jorge ya se había usado. No se aplicó nada; vuelve a pedir el cambio.");

  // ── aplicar ──
  const hechos: Plan[] = [];
  const fallidos: number[] = [];
  for (const p of planes) {
    const esperado = camposPrecio(p) && ("precio" in p.campos || "precio_original" in p.campos) ? { precio: p.f.precio, precio_original: p.f.precio_original } : undefined;
    try {
      if (await deps.productos.actualizar(p.f.id, p.campos, esperado)) hechos.push(p);
      else fallidos.push(p.f.id);
    } catch {
      fallidos.push(p.f.id);
    }
  }
  if (hechos.length > 0) {
    await ctx.auditar(hechos.map((p) => {
      const claves = Object.keys(p.campos);
      return { entidad: "producto", entidadId: p.f.id, antes: { codigo, ...resumenFicha(p.f, claves) }, despues: { codigo, ...p.campos } };
    }));
    const hechosPrecio = hechos.filter(camposPrecio);
    if (hechosPrecio.length > 0) {
      const ids = new Set(hechosPrecio.map((p) => p.f.id));
      await registrarCambioAplicado(ctx.db, ctx.usuario.id, evaluables.filter((_, i) => ids.has(cambiosPrecio[i].f.id)), { aprobado: requiere, ahora: ctx.ahora });
    }
    await deps.revalidar(hechos.map((p) => p.f.id));
  }
  const partes = [hechos.length ? `Listo: ${codigo} actualizado en ${hechos.length} ficha(s): ${describir(hechos[0].campos)}.${requiere ? " Estaba aprobado por Jorge." : ""}` : `No se aplicó nada en ${codigo}.`];
  if (fallidos.length) partes.push(`${fallidos.length} ficha(s) no se tocaron (alguien cambió su precio justo ahora o hubo un error): ${fallidos.join(", ")}. Vuelve a intentar.`);
  if (hechos.length) partes.push("Se puede deshacer desde Administración > Conexiones.");
  return { texto: partes.join(" "), datos: { aplicado: hechos.length > 0, codigo, fichas: hechos.length, no_aplicadas: fallidos.length, lote_id: ctx.loteId } };
}

function resumenFicha(f: FichaProducto, claves: string[]): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const k of claves) o[k] = (f as unknown as Record<string, unknown>)[k] ?? null;
  return o;
}

function describir(c: CamposFicha): string {
  const t: string[] = [];
  if (c.nombre !== undefined) t.push("nombre");
  if (c.descripcion !== undefined) t.push("descripción");
  if (c.precio !== undefined) t.push(`precio web ${pesos(c.precio)}`);
  if (c.precio_original !== undefined) t.push(c.precio_original ? `precio local ${pesos(c.precio_original)}` : "sin precio tachado");
  if (c.oferta_fin !== undefined) t.push(c.oferta_fin ? `oferta_fin ${c.oferta_fin}` : "sin fecha de oferta");
  if (c.combo_cantidad !== undefined) t.push(c.combo_cantidad ? `combo ${c.combo_cantidad} por ${pesos(c.combo_precio ?? 0)}` : "sin combo");
  if (c.stock !== undefined) t.push(`stock ${c.stock}`);
  if (c.activo !== undefined) t.push(c.activo ? "visible" : "oculto");
  if (c.imagen !== undefined) t.push(c.imagen ? "imagen" : "sin imagen");
  if (c.categoria_id !== undefined) t.push(`categoría ${c.categoria_id}`);
  return t.join(", ");
}

// ───────── crear producto ─────────
export interface EntradaCrearProducto {
  codigo: string;
  nombre: string;
  precio_web: number;
  precio_local?: number;
  costo?: number;
  stock?: number;
  categoria_id?: number;
  descripcion?: string;
  imagen?: string;
  activo?: boolean;
}

export async function crearProducto(deps: DepsGestion, ctx: CtxGestion, e: EntradaCrearProducto): Promise<Salida> {
  const codigo = e.codigo.trim();
  if (!CODIGO_OK.test(codigo)) throw new ErrorGestion("El código debe tener hasta 40 caracteres: letras, números, espacio, punto, guion o barra.");
  const nombre = sanearTextoPlano(e.nombre, 200);
  if (!nombre) throw new ErrorGestion("Falta el nombre del producto.");
  if (!esPesosValido(e.precio_web)) throw new ErrorGestion("precio_web debe ser un entero de pesos mayor a 0.");
  if (e.precio_local !== undefined && (!esPesosValido(e.precio_local) || e.precio_local < e.precio_web)) throw new ErrorGestion("precio_local debe ser un entero de pesos igual o mayor al precio web.");
  if (e.costo !== undefined && !esPesosValido(e.costo)) throw new ErrorGestion("costo debe ser un entero de pesos mayor a 0.");
  if (e.stock !== undefined && (!Number.isFinite(e.stock) || e.stock < 0 || e.stock > 10_000_000)) throw new ErrorGestion("El stock debe ser un número de 0 en adelante.");
  if (e.imagen !== undefined && !esUrlImagenPermitida(e.imagen)) throw new ErrorGestion("Esa imagen no vale: debe estar ya subida a la tienda. Súbela primero y pega la URL que te devuelve.");
  if (e.categoria_id !== undefined && (await deps.categorias.porIds([e.categoria_id])).length === 0) throw new ErrorGestion("No encontré esa categoría. Mira las ids con listar_categorias.");
  if ((await deps.productos.fichasPorCodigos([codigo])).length > 0) throw new ErrorGestion(`Ya existe un producto con el código "${codigo}". Para cambiarlo usa editar_producto.`);

  const local = e.precio_local ?? e.precio_web;
  const precios = { precio: e.precio_web, precio_original: local > e.precio_web ? local : null, en_oferta: local > e.precio_web };
  const ev = await evaluarCambioPrecios(ctx.db, { usuarioId: ctx.usuario.id, cambios: [{ clave: codigo, precioAntes: e.precio_web, precioDespues: e.precio_web, costo: e.costo ?? null }], ahora: ctx.ahora });
  if (ev.requiere) {
    const huella = await huellaDeDatos({ v: 1, h: "crear_producto", codigo, nombre, precios, costo: e.costo ?? null });
    const r = await exigirAprobacion(ctx.db, deps.aprobacion, {
      usuario: ctx.usuario, herramienta: "crear_producto", motivos: ev.motivos, huella,
      resumen: `Crear el producto ${codigo} (${nombre}) a ${pesos(e.precio_web)}.`,
      detalle: { codigo, nombre, precio_web: e.precio_web, costo: e.costo ?? null, motivos: ev.motivosTexto },
    }, ctx.ahora);
    if (r.tipo !== "aprobada") return { texto: r.mensaje, datos: { aplicado: false, estado: r.tipo, motivos: ev.motivosTexto } };
    if (!(await r.gastar())) throw new ErrorGestion("La aprobación de Jorge ya se había usado. No se creó nada; vuelve a pedirlo.");
  }

  const slug = await slugLibre((s) => deps.productos.existeSlug(s), slugificar(`${nombre} ${codigo}`));
  const activo = e.activo ?? false;
  const r = await deps.productos.insertar({
    codigo, nombre, slug, descripcion: e.descripcion ? sanearTextoMultilinea(e.descripcion, 4000) || null : null,
    precio: precios.precio, precio_original: precios.precio_original, en_oferta: precios.en_oferta,
    costo: e.costo ?? null, stock: e.stock ?? 0, categoria_id: e.categoria_id ?? null, imagen: e.imagen ?? null, activo,
  });
  if (!r.ok) throw new ErrorGestion(r.motivo === "error" ? "No pude crear el producto. No se guardó nada; intenta de nuevo." : "Ya existe un producto con ese código o dirección. Usa editar_producto o cambia el nombre.");
  await ctx.auditar([{ entidad: "producto", entidadId: r.ficha.id, antes: null, despues: { codigo, nombre, activo, precio: precios.precio } }]);
  await deps.revalidar([r.ficha.id]);
  return {
    texto: `Producto creado: ${codigo} (${nombre}), id ${r.ficha.id}, precio web ${pesos(e.precio_web)}. ${activo ? "Ya se ve en la tienda." : "Queda OCULTO hasta que lo actives con editar_producto (activo: true)."} Se puede deshacer desde Administración > Conexiones (queda oculto, nunca se borra).`,
    datos: { id: r.ficha.id, codigo, slug, activo, lote_id: ctx.loteId },
  };
}

// ───────── categorías ─────────
export async function crearCategoria(deps: DepsGestion, ctx: CtxGestion, e: { nombre: string; descripcion?: string; padre_id?: number }): Promise<Salida> {
  const nombre = sanearTextoPlano(e.nombre, 80);
  if (!nombre) throw new ErrorGestion("Falta el nombre de la categoría.");
  const todas = await deps.categorias.listar({ incluirInactivas: true });
  if (e.padre_id !== undefined && !todas.some((c) => c.id === e.padre_id)) throw new ErrorGestion("No encontré la categoría padre. Mira las ids con listar_categorias.");
  if (todas.some((c) => c.nombre.trim().toLowerCase() === nombre.toLowerCase() && (c.padre_id ?? null) === (e.padre_id ?? null))) throw new ErrorGestion(`Ya existe una categoría llamada "${nombre}" en ese nivel.`);
  const slug = await slugLibre((s) => deps.categorias.existeSlug(s), slugificar(nombre));
  const orden = todas.reduce((m, c) => Math.max(m, c.orden ?? 0), 0) + 1;
  const c = await deps.categorias.insertar({ nombre, slug, descripcion: e.descripcion ? sanearTextoMultilinea(e.descripcion, 500) || null : null, orden, padre_id: e.padre_id ?? null });
  if (!c) throw new ErrorGestion("No pude crear la categoría. No se guardó nada; intenta de nuevo.");
  await ctx.auditar([{ entidad: "categoria", entidadId: c.id, antes: null, despues: { nombre, activa: true } }]);
  return { texto: `Categoría creada: "${nombre}" (id ${c.id}, orden ${orden}). Se puede deshacer desde Administración > Conexiones (queda inactiva, nunca se borra).`, datos: { id: c.id, slug, orden, lote_id: ctx.loteId } };
}

export async function editarCategoria(deps: DepsGestion, ctx: CtxGestion, e: { id: number; nombre?: string; orden?: number; activa?: boolean; descripcion?: string | null }): Promise<Salida> {
  const [actual] = await deps.categorias.porIds([e.id]);
  if (!actual) throw new ErrorGestion("No encontré esa categoría. Mira las ids con listar_categorias.");
  const campos: { nombre?: string; orden?: number; activa?: boolean; descripcion?: string | null } = {};
  if (e.nombre !== undefined) {
    const n = sanearTextoPlano(e.nombre, 80);
    if (!n) throw new ErrorGestion("El nombre no puede quedar vacío.");
    if (n !== actual.nombre) campos.nombre = n;
  }
  if (e.orden !== undefined && e.orden !== actual.orden) campos.orden = e.orden;
  if (e.activa !== undefined && e.activa !== actual.activa) campos.activa = e.activa;
  if (e.descripcion !== undefined) {
    const d = e.descripcion === null ? null : sanearTextoMultilinea(e.descripcion, 500) || null;
    if (d !== actual.descripcion) campos.descripcion = d;
  }
  if (Object.keys(campos).length === 0) return { texto: "No hay nada que cambiar: ya estaba así.", datos: { aplicado: false } };
  await deps.categorias.actualizar(e.id, campos);
  const antes: Record<string, unknown> = {};
  for (const k of Object.keys(campos)) antes[k] = (actual as unknown as Record<string, unknown>)[k] ?? null;
  await ctx.auditar([{ entidad: "categoria", entidadId: e.id, antes, despues: campos }]);
  let aviso = "";
  if (campos.activa === false) {
    const n = (await deps.productos.conteoPorCategoria()).get(e.id) ?? 0;
    if (n > 0) aviso = ` Ojo: tiene ${n} productos activos que dejarán de mostrarse en esa categoría.`;
  }
  return { texto: `Categoría "${campos.nombre ?? actual.nombre}" actualizada.${aviso} Se puede deshacer desde Administración > Conexiones. Su dirección (slug) no cambia para no romper enlaces.`, datos: { aplicado: true, id: e.id, lote_id: ctx.loteId } };
}
