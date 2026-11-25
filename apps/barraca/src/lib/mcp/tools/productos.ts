/**
 * Herramientas de productos y categorías: buscar, ver, listar, márgenes (lectura)
 * y editar/crear (escritura con auditoría, deshacer y reglas de aprobación).
 * La lógica vive en lib/gestion-precios/; aquí solo se declara la interfaz.
 */
import { buscarProductos as buscarSrv, listarCategorias as listarCatSrv, verMargenes as margenesSrv, verProducto as verSrv } from "../../gestion-precios/consultas.ts";
import { crearCategoria as crearCatSrv, crearProducto as crearSrv, editarCategoria as editarCatSrv, editarProducto as editarSrv } from "../../gestion-precios/productos-servicio.ts";
import { defineHerramienta, z } from "./registro.ts";
import { aCtxGestion, ejecutarServicio, obtenerDeps, revertidorGeneral } from "./productos-comun.ts";

const LECTURA = { readOnlyHint: true, destructiveHint: false, idempotentHint: true } as const;
const codigo = z.string().trim().min(1).max(40);

export const buscarProductos = defineHerramienta({
  nombre: "buscar_productos",
  titulo: "Buscar productos",
  descripcion:
    "Busca productos por texto (nombre o código), código exacto, categoría, estado, sin foto, sin stock o en oferta. Devuelve una página corta con precio web, precio normal (local), stock y si tiene foto; no muestra costos (usa ver_producto). Más resultados: pagina.",
  esquema: z.object({
    texto: z.string().trim().max(100).optional().describe("Parte del nombre o del código."),
    codigo: codigo.optional().describe("Código exacto del producto."),
    categoria_id: z.number().int().positive().optional().describe("Id (listar_categorias)."),
    incluir_subcategorias: z.boolean().optional().describe("Incluir subcategorías (sí por defecto)."),
    estado: z.enum(["activo", "inactivo", "todos"]).optional().describe("Por defecto, los visibles."),
    sin_foto: z.boolean().optional().describe("Solo productos sin imagen."),
    sin_stock: z.boolean().optional().describe("Stock 0 o sin dato."),
    solo_oferta: z.boolean().optional().describe("Solo con precio tachado."),
    pagina: z.number().int().min(1).max(500).optional(),
    por_pagina: z.number().int().min(1).max(50).optional().describe("Máx. 50 (20 por defecto)."),
  }),
  anotaciones: LECTURA,
  ejecutar: async (args) => ejecutarServicio(async () => buscarSrv(await obtenerDeps(), args)),
});

export const verProducto = defineHerramienta({
  nombre: "ver_producto",
  titulo: "Ver un producto",
  descripcion:
    "Muestra TODAS las fichas de un código (puede haber repetidas): precio web, precio normal, costo, utilidad, stock, visibilidad, categoría, imagen, combo y ofertas programadas. Indica el código (o el id de una ficha).",
  esquema: z.object({
    codigo: codigo.optional().describe("Código del producto."),
    id: z.number().int().positive().optional().describe("Id de una ficha (alternativa al código)."),
  }),
  anotaciones: LECTURA,
  ejecutar: async (args, ctx) => ejecutarServicio(async () => verSrv(await obtenerDeps(), ctx.db, args)),
});

export const listarCategorias = defineHerramienta({
  nombre: "listar_categorias",
  titulo: "Listar categorías",
  descripcion:
    "Lista las categorías con id, orden, productos activos y si está activa. Úsala para conocer los ids antes de buscar o cambiar precios por categoría.",
  esquema: z.object({ incluir_inactivas: z.boolean().optional().describe("Incluir las categorías ocultas. Por defecto no.") }),
  anotaciones: LECTURA,
  ejecutar: async (args) => ejecutarServicio(async () => listarCatSrv(await obtenerDeps(), args)),
});

export const verMargenes = defineHerramienta({
  nombre: "ver_margenes",
  titulo: "Ver márgenes",
  descripcion:
    "Utilidad sobre el costo de los productos activos: cuántos están bajo el costo, con menos de 15 % y sin costo cargado, más los casos más delgados. Se puede filtrar por categoría. Es el criterio con que la tienda pide el OK de Jorge.",
  esquema: z.object({
    categoria_id: z.number().int().positive().optional().describe("Solo esta categoría (y sus subcategorías)."),
    limite: z.number().int().min(1).max(50).optional().describe("Cuántos casos delgados listar (por defecto 25)."),
  }),
  anotaciones: LECTURA,
  ejecutar: async (args) => ejecutarServicio(async () => margenesSrv(await obtenerDeps(), args)),
});

export const editarProducto = defineHerramienta({
  nombre: "editar_producto",
  titulo: "Editar un producto",
  descripcion:
    "Cambia datos de UN producto por su código (llega a todas sus fichas repetidas): nombre, descripción, precio web (lo que se cobra), precio local (tachado; null lo quita), stock, activo (visible; nunca se borra), imagen (URL ya subida), categoría, combo (combo_cantidad y combo_precio juntos; null en ambos lo quita) y oferta_fin (fecha informativa; para ofertas automáticas usa programar_oferta). Bajo el costo, menos de 15 % de utilidad o más de 30 % de cambio pide el OK de Jorge (repite la misma llamada). Muchos productos: previsualizar_precios. Se puede deshacer.",
  esquema: z.object({
    codigo: codigo.describe("Código del producto."),
    nombre: z.string().trim().min(1).max(200).optional(),
    descripcion: z.string().max(4000).nullable().optional().describe("Texto plano; null la borra."),
    precio_web: z.number().optional().describe("Pesos enteros; lo que paga el cliente."),
    precio_local: z.number().nullable().optional().describe("Pesos enteros: precio normal (tachado). null lo quita."),
    en_oferta: z.boolean().optional().describe("Normalmente no hace falta: sale de precio_local y precio_web."),
    oferta_fin: z.string().max(10).nullable().optional().describe("AAAA-MM-DD, solo informativa. null la quita."),
    combo_cantidad: z.number().int().nullable().optional().describe("Unidades (2 a 999); null con combo_precio null quita el combo."),
    combo_precio: z.number().nullable().optional().describe("Precio TOTAL del combo, pesos enteros."),
    stock: z.number().min(0).max(10_000_000).optional(),
    activo: z.boolean().optional().describe("false lo oculta (no se borra)."),
    imagen: z.string().max(500).nullable().optional().describe("URL ya subida (subir_imagen)."),
    categoria_id: z.number().int().positive().optional(),
  }),
  anotaciones: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  ejecutar: async (args, ctx) => ejecutarServicio(async () => editarSrv(await obtenerDeps(), aCtxGestion(ctx), args)),
  revertidor: revertidorGeneral,
});

export const crearProducto = defineHerramienta({
  nombre: "crear_producto",
  titulo: "Crear un producto",
  descripcion:
    "Crea un producto nuevo (código, nombre y precio web; opcional: precio local, costo, stock, categoría, descripción, imagen ya subida). Queda OCULTO hasta activarlo (activo: true o editar_producto). No acepta un código existente. Bajo el costo o con menos de 15 % de utilidad pide el OK de Jorge. Se puede deshacer (queda oculto; nunca se borra).",
  esquema: z.object({
    codigo: codigo,
    nombre: z.string().trim().min(1).max(200),
    precio_web: z.number().describe("Pesos enteros mayores a 0."),
    precio_local: z.number().optional().describe("Precio normal (tachado); no menor al web."),
    costo: z.number().optional().describe("Costo en pesos enteros."),
    stock: z.number().min(0).max(10_000_000).optional(),
    categoria_id: z.number().int().positive().optional(),
    descripcion: z.string().max(4000).optional(),
    imagen: z.string().max(500).optional().describe("URL ya subida (subir_imagen)."),
    activo: z.boolean().optional().describe("Por defecto false: queda oculto hasta activarlo."),
  }),
  anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  ejecutar: async (args, ctx) => ejecutarServicio(async () => crearSrv(await obtenerDeps(), aCtxGestion(ctx), args)),
  revertidor: revertidorGeneral,
});

export const crearCategoria = defineHerramienta({
  nombre: "crear_categoria",
  titulo: "Crear una categoría",
  descripcion:
    "Crea una categoría nueva (opcional dentro de otra con padre_id), al final del orden. Se puede deshacer (queda inactiva; nunca se borra).",
  esquema: z.object({
    nombre: z.string().trim().min(1).max(80),
    descripcion: z.string().max(500).optional(),
    padre_id: z.number().int().positive().optional().describe("Id de la categoría madre (listar_categorias)."),
  }),
  anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  ejecutar: async (args, ctx) => ejecutarServicio(async () => crearCatSrv(await obtenerDeps(), aCtxGestion(ctx), args)),
  revertidor: revertidorGeneral,
});

export const editarCategoria = defineHerramienta({
  nombre: "editar_categoria",
  titulo: "Editar una categoría",
  descripcion:
    "Renombra, reordena (número menor se muestra primero), activa o desactiva una categoría (nunca se borra). Si la desactivas, avisa cuántos productos activos dejan de mostrarse. Se puede deshacer.",
  esquema: z.object({
    id: z.number().int().positive().describe("Id de la categoría (listar_categorias)."),
    nombre: z.string().trim().min(1).max(80).optional(),
    orden: z.number().int().min(0).max(100000).optional(),
    activa: z.boolean().optional(),
    descripcion: z.string().max(500).nullable().optional(),
  }),
  anotaciones: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  ejecutar: async (args, ctx) => ejecutarServicio(async () => editarCatSrv(await obtenerDeps(), aCtxGestion(ctx), args)),
  revertidor: revertidorGeneral,
});
